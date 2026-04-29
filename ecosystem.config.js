module.exports = {
  apps: [{
    name: 'srr330',
    script: 'index.js',
    autorestart: true,
    max_memory_restart: '500M',
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
