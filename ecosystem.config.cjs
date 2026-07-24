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
      env: {
        NODE_ENV: "production",
        NOTEY_HOST: "0.0.0.0",
        NOTEY_PORT: "8080",
        // NOTEY_STORE: "/var/lib/notey",   // set an absolute path in production
      },
    },
  ],
};
