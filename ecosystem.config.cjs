module.exports = {
  apps: [
    {
      name: 'cryptex-controller',
      cwd: './controller',
      script: 'index.js',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'cryptex-serve',
      cwd: './ui',
      script: 'node_modules/.bin/serve',
      args: '. -l 8080',
      restart_delay: 3000,
    },
  ],
};
