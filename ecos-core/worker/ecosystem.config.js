module.exports = {
  apps: [{
    name: 'claude-bridge',
    script: 'src/index.js',
    cwd: 'C:\\claude-bridge',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    log_file: 'C:\\claude-bridge\\logs\\combined.log',
    error_file: 'C:\\claude-bridge\\logs\\error.log',
    time: true,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
