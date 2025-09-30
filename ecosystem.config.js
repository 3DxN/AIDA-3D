module.exports = {
  apps: [
    {
      name: 'aida-3d',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/AIDA-3D_deploy',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: '/home/ubuntu/.pm2/logs/aida-3d.log',
      out_file: '/home/ubuntu/.pm2/logs/aida-3d-out.log',
      error_file: '/home/ubuntu/.pm2/logs/aida-3d-error.log',
      time: true
    }
  ]
};