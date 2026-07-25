// PM2 process file — start with:  pm2 start ecosystem.config.cjs
// Single fork instance ONLY: notey stores notes on the local filesystem and keeps
// rate-limit state in memory, so multiple workers would race on writes and diverge.
module.exports = {
  apps: [
    {
      name: "notey",
      script: "backend/src/server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      // Defaults below, but the shell env wins at start time — so
      //   NOTEY_PORT=80 NOTEY_STORE=/var/lib/notey pm2 start ecosystem.config.cjs
      // actually takes effect (a plain string here would override your env).
      env: {
        NODE_ENV: "production",
        NOTEY_HOST: process.env.NOTEY_HOST || "0.0.0.0",
        NOTEY_PORT: process.env.NOTEY_PORT || "8080",
        NOTEY_STORE: process.env.NOTEY_STORE || "./note-store",
      },
    },
  ],
};
