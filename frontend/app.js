/* notey frontend — React (CDN, no build). Ported from Notepad Editor.dc.html and
   wired to the backend note API. UI uses React.createElement (no JSX transform). */
(function () {
  "use strict";
  const h = React.createElement;

  // ---- Save-status labels (no magic strings scattered in the view) ----
  const SaveLabel = {
    LOADING: "Loading…",
    SAVING: "Saving…",
    SAVED: "Saved just now",
    NEW: "New note",
    FAILED: "Save failed — retrying on next edit",
    LOCKED: "Locked — enter the password to edit",
  };
  const SAVE_DEBOUNCE_MS = 700;

  // ---- API client: talks to the backend note routes on the same origin ----
  const NoteApi = {
    path(slug) { return "/api/note/" + slug.split("/").map(encodeURIComponent).join("/"); },
    async read(slug) { return (await fetch(this.path(slug))).json(); },
    async save(slug, content, password) {
      const res = await fetch(this.path(slug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, password: password ?? undefined }),
      });
      return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
    },
    async unlock(slug, password) {
      const res = await fetch("/api/note-unlock/" + slug.split("/").map(encodeURIComponent).join("/"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      return { ok: res.ok, data: await res.json().catch(() => ({})) };
    },
    async lock(slug, password, current) {
      const res = await fetch("/api/note-lock/" + slug.split("/").map(encodeURIComponent).join("/"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, current }),
      });
      return { ok: res.ok, data: await res.json().catch(() => ({})) };
    },
  };

  // ---- Slug helpers: the URL path IS the note ----
  const WORDS_A = ["quiet", "amber", "misty", "brave", "lunar", "swift", "wild", "calm", "solar", "north"];
  const WORDS_B = ["harbor", "meadow", "cipher", "ember", "willow", "signal", "pebble", "canyon", "orbit", "delta"];
  function randomSlug() {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    return pick(WORDS_A) + "-" + pick(WORDS_B) + "-" + Math.floor(100 + Math.random() * 900);
  }
  function slugFromLocation() {
    return window.location.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  }

  // ---- Markdown renderer (ported verbatim from the design's md()) ----
  function inlineMd(s) {
    const out = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      const t = m[0];
      if (t.startsWith("**")) out.push(h("strong", { key: out.length, style: { fontWeight: 600 } }, t.slice(2, -2)));
      else out.push(h("code", { key: out.length, style: { fontFamily: "'JetBrains Mono', monospace", fontSize: "0.88em", padding: "1px 5px", borderRadius: 5, background: "var(--np-glow)", color: "var(--np-accent)" } }, t.slice(1, -1)));
      last = m.index + t.length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  }
  function renderMd(src) {
    const nodes = [];
    (src || "").split("\n").forEach((raw, i) => {
      const line = raw.trimEnd();
      const key = "l" + i;
      if (!line.trim()) return nodes.push(h("div", { key, style: { height: 12 } }));
      if (/^#\s/.test(line)) return nodes.push(h("h1", { key, style: { fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 14px" } }, inlineMd(line.slice(2))));
      if (/^##\s/.test(line)) return nodes.push(h("h2", { key, style: { fontSize: 15, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--np-accent)", margin: "22px 0 8px" } }, inlineMd(line.slice(3))));
      if (/^>\s/.test(line)) return nodes.push(h("blockquote", { key, style: { margin: "14px 0", padding: "2px 0 2px 14px", borderLeft: "2px solid var(--np-accent)", color: "var(--np-muted)", fontStyle: "italic" } }, inlineMd(line.slice(2))));
      const task = line.match(/^-\s\[( |x)\]\s(.*)$/);
      if (task) return nodes.push(renderTask(key, task));
      if (/^-\s/.test(line)) return nodes.push(h("div", { key, style: { display: "flex", gap: 9, alignItems: "baseline", padding: "3px 0" } }, h("span", { style: { color: "var(--np-accent)" } }, "—"), h("span", null, inlineMd(line.slice(2)))));
      if (/^-{4,}$/.test(line) || /^\s*\S+\s{2,}[\d,.]+$/.test(line)) return nodes.push(h("div", { key, style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, whiteSpace: "pre", color: "var(--np-muted)" } }, line));
      nodes.push(h("p", { key, style: { margin: "0 0 8px", textWrap: "pretty" } }, inlineMd(line)));
    });
    return nodes;
  }
  function renderTask(key, task) {
    const done = task[1] === "x";
    return h("div", { key, style: { display: "flex", gap: 9, alignItems: "baseline", padding: "3px 0", color: done ? "var(--np-faint)" : "inherit", textDecoration: done ? "line-through" : "none" } },
      h("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: done ? "var(--np-accent)" : "var(--np-faint)" } }, done ? "✓" : "○"),
      h("span", null, inlineMd(task[2])));
  }

  function themeIcon(theme) {
    const dark = "M233 150.1a8 8 0 0 0-8.2-2.9 88.6 88.6 0 0 1-20.8 2.5A88.1 88.1 0 0 1 116 61.6a89.6 89.6 0 0 1 2.5-20.8 8 8 0 0 0-9.9-9.7A104 104 0 1 0 236 161.8a8 8 0 0 0-3-11.7Z";
    const light = "M120 40V16a8 8 0 0 1 16 0v24a8 8 0 0 1-16 0Zm8 24a64 64 0 1 0 64 64 64.1 64.1 0 0 0-64-64Zm-69.7 5.7a8 8 0 0 0 11.4-11.4l-16-16a8 8 0 0 0-11.4 11.4Zm0 116.6-16 16a8 8 0 0 0 11.4 11.4l16-16a8 8 0 0 0-11.4-11.4ZM192 72a8 8 0 0 0 5.7-2.3l16-16a8 8 0 0 0-11.4-11.4l-16 16A8 8 0 0 0 192 72Zm5.7 114.3a8 8 0 0 0-11.4 11.4l16 16a8 8 0 0 0 11.4-11.4ZM48 128a8 8 0 0 0-8-8H16a8 8 0 0 0 0 16h24a8 8 0 0 0 8-8Zm80 80a8 8 0 0 0-8 8v24a8 8 0 0 0 16 0v-24a8 8 0 0 0-8-8Zm112-88h-24a8 8 0 0 0 0 16h24a8 8 0 0 0 0-16Z";
    return h("svg", { viewBox: "0 0 256 256", fill: "currentColor", width: 16, height: 16 }, h("path", { d: theme === "dark" ? dark : light }));
  }

  window.__notey = { h, SaveLabel, SAVE_DEBOUNCE_MS, NoteApi, randomSlug, slugFromLocation, renderMd, themeIcon };
})();

(function () {
  "use strict";
  const { h, SaveLabel, SAVE_DEBOUNCE_MS, NoteApi, randomSlug, slugFromLocation, renderMd, themeIcon } = window.__notey;

  // Root component. Loads the note for the current URL, autosaves edits, and drives
  // the theme / preview / lock interactions ported from the design.
  class NoteApp extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        slug: slugFromLocation(), theme: "dark", text: "", preview: false,
        lockOpen: false, copied: false, saved: SaveLabel.LOADING,
        phase: "loading", locked: false, password: null,
        pwInput: "", gateInput: "", gateError: "",
        narrow: window.innerWidth < 720,
      };
      this._t = null;
      this._onResize = () => this.setState({ narrow: window.innerWidth < 720 });
    }

    componentDidMount() {
      window.addEventListener("resize", this._onResize);
      this.ensureSlug().then(() => this.load());
    }
    componentWillUnmount() { window.removeEventListener("resize", this._onResize); }

    async ensureSlug() {
      if (this.state.slug) return;
      const slug = randomSlug();
      window.history.replaceState(null, "", "/" + slug);
      await new Promise((r) => this.setState({ slug }, r));
    }

    async load() {
      const data = await NoteApi.read(this.state.slug);
      if (data.locked) return this.setState({ phase: "gate", locked: true, saved: SaveLabel.LOCKED });
      this.setState({
        phase: "ready", locked: false, text: data.content || "",
        saved: data.exists ? SaveLabel.SAVED : SaveLabel.NEW,
      });
    }

    // ---- editing + autosave ----
    onType(value) {
      this.setState({ text: value, saved: SaveLabel.SAVING });
      clearTimeout(this._t);
      this._t = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS);
    }
    async save() {
      const { slug, text, password } = this.state;
      const res = await NoteApi.save(slug, text, password);
      if (res.ok) return this.setState({ saved: SaveLabel.SAVED, locked: res.data.locked });
      this.setState({ saved: res.status === 401 ? SaveLabel.LOCKED : SaveLabel.FAILED });
    }

    // ---- password gate (reading a locked note) ----
    async submitGate() {
      const res = await NoteApi.unlock(this.state.slug, this.state.gateInput);
      if (!res.ok) return this.setState({ gateError: "Wrong password. Try again." });
      this.setState({ phase: "ready", locked: true, text: res.data.content || "", password: this.state.gateInput, gateError: "", saved: SaveLabel.SAVED });
    }

    // ---- lock panel (setting / changing / clearing the password) ----
    async applyLock() {
      const next = this.state.pwInput;
      const res = await NoteApi.lock(this.state.slug, next, this.state.password ?? "");
      if (!res.ok) return this.setState({ gateError: "Couldn't update the password." });
      this.setState({ locked: res.data.locked, password: next || null, lockOpen: false, pwInput: "", gateError: "" });
    }

    copyLink() {
      const done = () => { this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(window.location.href).then(done, done);
      else done();
    }

    render() {
      if (this.state.phase === "gate") return this.wrap(this.renderGate());
      return this.wrap(h(React.Fragment, null, this.renderHeader(), this.state.lockOpen ? this.renderLockPanel() : null, this.renderMain(), this.renderFooter()));
    }

    wrap(children) {
      return h("div", { "data-np": this.state.theme, style: { height: "100vh", display: "flex", flexDirection: "column", background: "var(--np-bg)", color: "var(--np-text)", fontFamily: "Inter, system-ui, sans-serif", transition: "background .25s ease, color .25s ease" } }, children);
    }

    renderHeader() {
      const s = this.state;
      const n = s.narrow;
      return h("header", { style: { flex: "0 0 auto", display: "flex", flexWrap: n ? "wrap" : "nowrap", alignItems: "center", justifyContent: "space-between", gap: n ? 8 : 16, padding: n ? "8px 14px" : "0 20px", minHeight: 46, borderBottom: "1px solid var(--np-line)" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 } },
          h("span", { style: { display: "flex", width: 15, height: 15, color: "var(--np-faint)" } }, this.lockGlyph(15)),
          h("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--np-faint)", letterSpacing: "-0.01em" } }, "notey.space/"),
          h("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: "var(--np-text)", letterSpacing: "-0.01em" } }, s.slug),
          h("button", { type: "button", className: "np-btn np-copy", onClick: () => this.copyLink(), style: { display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 4, padding: "3px 8px", font: "inherit", fontSize: 11, color: "var(--np-muted)", background: "transparent", border: "1px solid var(--np-line)", borderRadius: 999, cursor: "pointer" } }, s.copied ? "Link copied" : "Copy link")),
        h("div", { style: { display: "flex", alignItems: "center", gap: 4 } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 7, paddingRight: 10, marginRight: 6, borderRight: "1px solid var(--np-line)", fontSize: 12, color: "var(--np-muted)" } },
            h("span", { style: { width: 6, height: 6, borderRadius: 999, background: "var(--np-accent)", animation: "np-pulse 2.4s ease-in-out infinite" } }),
            h("span", null, s.saved)),
          this.iconButton("Markdown preview", () => this.setState({ preview: !s.preview }), this.previewGlyph(), s.preview ? "Editing + preview" : "Preview"),
          this.iconButton("Password protect", () => this.setState({ lockOpen: !s.lockOpen, pwInput: "" }), this.lockGlyph(16)),
          this.iconButton("Light / dark", () => this.setState({ theme: s.theme === "dark" ? "light" : "dark" }), themeIcon(s.theme))));
    }

    iconButton(title, onClick, glyph, label) {
      const wide = Boolean(label);
      return h("button", { type: "button", title, onClick, className: "np-btn np-icon-btn", style: { display: "inline-flex", alignItems: "center", justifyContent: wide ? "flex-start" : "center", gap: 6, height: 28, width: wide ? "auto" : 28, padding: wide ? "0 10px" : 0, font: "inherit", fontSize: 12, color: "var(--np-muted)", background: "transparent", border: "1px solid transparent", borderRadius: 8, cursor: "pointer" } }, glyph, label ? h("span", null, label) : null);
    }

    lockGlyph(size) { return h("svg", { viewBox: "0 0 256 256", fill: "currentColor", width: size, height: size }, h("path", { d: "M208 80h-28V56a52 52 0 0 0-104 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16ZM92 56a36 36 0 0 1 72 0v24H92Zm44 128.6V200a8 8 0 0 1-16 0v-15.4a20 20 0 1 1 16 0Z" })); }
    previewGlyph() { return h("svg", { viewBox: "0 0 256 256", fill: "currentColor", width: 15, height: 15 }, h("path", { d: "M224 56H32a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h192a16 16 0 0 0 16-16V72a16 16 0 0 0-16-16ZM72 168v-48l24 24 24-24v48h-16v-20l-8 8-8-8v20Zm112-16 24-32h-16V96h-16v24h-16Z" })); }

    renderLockPanel() {
      const locked = this.state.locked;
      return h("div", { style: { position: "absolute", top: 52, right: 14, zIndex: 20, width: "min(268px, calc(100vw - 28px))", padding: 14, background: "var(--np-surface)", border: "1px solid var(--np-line)", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,0.35)" } },
        h("div", { style: { fontSize: 13, fontWeight: 500, marginBottom: 3 } }, locked ? "Change or remove password" : "Lock this note"),
        h("div", { style: { fontSize: 12, color: "var(--np-muted)", marginBottom: 10, textWrap: "pretty" } }, "Anyone with the link will need the password. We can't recover it for you. Leave blank to remove."),
        h("input", { type: "password", value: this.state.pwInput, autoFocus: true, placeholder: "New password", onChange: (e) => this.setState({ pwInput: e.target.value }), style: { width: "100%", boxSizing: "border-box", height: 32, padding: "0 10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--np-text)", background: "var(--np-bg)", border: "1px solid var(--np-accent)", borderRadius: 8, outline: "none" } }),
        this.state.gateError ? h("div", { style: { color: "#e06c75", fontSize: 11, marginTop: 6 } }, this.state.gateError) : null,
        h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
          h("button", { type: "button", onClick: () => this.applyLock(), style: { flex: 1, height: 30, font: "inherit", fontSize: 12, color: "var(--np-accent)", background: "transparent", border: "1px solid var(--np-accent)", borderRadius: 8, cursor: "pointer" } }, this.state.pwInput ? "Set password" : "Remove password"),
          h("button", { type: "button", onClick: () => this.setState({ lockOpen: false, pwInput: "", gateError: "" }), style: { height: 30, padding: "0 12px", font: "inherit", fontSize: 12, color: "var(--np-muted)", background: "transparent", border: "1px solid var(--np-line)", borderRadius: 8, cursor: "pointer" } }, "Cancel")));
    }

    renderMain() {
      const s = this.state;
      const n = s.narrow;
      const pad = n ? "24px 18px 60px" : "44px 32px 80px";
      return h("main", { style: { flex: "1 1 auto", display: "flex", flexDirection: n ? "column" : "row", minHeight: 0, justifyContent: "center" } },
        h("div", { style: { flex: "1 1 0", display: "flex", justifyContent: "center", minWidth: 0, minHeight: 0, overflow: "auto" } },
          h("textarea", { value: s.text, onChange: (e) => this.onType(e.target.value), spellCheck: false, placeholder: "Start typing. It saves itself.", style: { width: "100%", maxWidth: 760, boxSizing: "border-box", padding: pad, border: "none", outline: "none", resize: "none", background: "transparent", color: "var(--np-text)", caretColor: "var(--np-accent)", fontFamily: "'JetBrains Mono', monospace", fontSize: 15, lineHeight: 1.85, letterSpacing: "-0.01em", tabSize: 2 } })),
        s.preview ? h("div", { style: { flex: "1 1 0", minWidth: 0, minHeight: 0, overflow: "auto", borderLeft: n ? "none" : "1px solid var(--np-line)", borderTop: n ? "1px solid var(--np-line)" : "none", background: "var(--np-surface)" } },
          h("div", { style: { maxWidth: 700, padding: n ? "24px 18px 60px" : "44px 40px 80px", fontSize: 15, lineHeight: 1.7 } }, renderMd(s.text))) : null);
    }

    renderFooter() {
      const t = this.state.text;
      const words = t.trim() ? t.trim().split(/\s+/).length : 0;
      const n = this.state.narrow;
      return h("footer", { style: { flex: "0 0 auto", display: "flex", flexWrap: n ? "wrap" : "nowrap", alignItems: "center", justifyContent: "space-between", gap: n ? 6 : 16, padding: n ? "6px 14px" : "0 20px", minHeight: 34, borderTop: "1px solid var(--np-line)", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--np-faint)", letterSpacing: "0.01em" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 14 } },
          h("span", null, words.toLocaleString() + " words"),
          h("span", null, t.length.toLocaleString() + " characters"),
          h("span", null, t.split("\n").length + " lines")),
        h("div", { style: { display: "flex", alignItems: "center", gap: 14 } },
          h("span", null, "Plain text · UTF-8"),
          h("span", { style: { color: "var(--np-muted)" } }, this.state.locked ? "Locked · password required" : "No account needed — the URL is the note.")));
    }

    renderGate() {
      return h("div", { style: { flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
        h("div", { style: { width: "min(320px, calc(100vw - 40px))", boxSizing: "border-box", padding: 22, background: "var(--np-surface)", border: "1px solid var(--np-line)", borderRadius: 14, textAlign: "center" } },
          h("div", { style: { display: "flex", justifyContent: "center", color: "var(--np-accent)", marginBottom: 10 } }, this.lockGlyph(28)),
          h("div", { style: { fontSize: 15, fontWeight: 500, marginBottom: 4 } }, "This note is locked"),
          h("div", { style: { fontSize: 12, color: "var(--np-muted)", marginBottom: 14 } }, "Enter the password to read and edit " + this.state.slug + "."),
          h("input", { type: "password", value: this.state.gateInput, autoFocus: true, placeholder: "Password", onKeyDown: (e) => { if (e.key === "Enter") this.submitGate(); }, onChange: (e) => this.setState({ gateInput: e.target.value }), style: { width: "100%", boxSizing: "border-box", height: 34, padding: "0 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--np-text)", background: "var(--np-bg)", border: "1px solid var(--np-accent)", borderRadius: 8, outline: "none" } }),
          this.state.gateError ? h("div", { style: { color: "#e06c75", fontSize: 11, marginTop: 8 } }, this.state.gateError) : null,
          h("button", { type: "button", onClick: () => this.submitGate(), style: { width: "100%", height: 34, marginTop: 12, font: "inherit", fontSize: 13, color: "var(--np-bg)", background: "var(--np-accent)", border: "none", borderRadius: 8, cursor: "pointer" } }, "Unlock")));
    }
  }

  ReactDOM.createRoot(document.getElementById("root")).render(h(NoteApp));
})();

