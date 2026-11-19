const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const requeridas = ['DATABASE_URL', 'JWT_SECRET'];
for (const nombre of requeridas) {
  if (!process.env[nombre]) {
    console.error(`Falta la variable de entorno ${nombre}. Revisa backend/.env (usa .env.example como base).`);
    process.exit(1);
  }
}

module.exports = {
  databaseUrl: process.env.DATABASE_URL,
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  frontendDist: path.join(__dirname, '..', '..', 'frontend', 'dist'),
};
