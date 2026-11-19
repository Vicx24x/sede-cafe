// Configuración de PM2: mantiene el servidor corriendo en la VM
// y lo reinicia si se cae o si la máquina se reinicia.
//   pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'sede-cafe',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
