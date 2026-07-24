# notey has zero runtime dependencies, so there is no install/build step —
# we just copy the source onto a small Node base image and run it.
FROM node:20-alpine

ENV NODE_ENV=production \
    NOTEY_HOST=0.0.0.0 \
    NOTEY_PORT=8080 \
    NOTEY_STORE=/data

WORKDIR /app

# Application source (backend server + static frontend).
COPY backend ./backend
COPY frontend ./frontend

# Durable notes location + drop root privileges.
RUN mkdir -p /data \
    && addgroup -S notey \
    && adduser -S notey -G notey \
    && chown -R notey:notey /data /app
USER notey

# Persist notes here — mount a volume at /data (compose does this for you).
VOLUME ["/data"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O - "http://127.0.0.1:${NOTEY_PORT}/" > /dev/null 2>&1 || exit 1

CMD ["node", "backend/src/server.js"]
