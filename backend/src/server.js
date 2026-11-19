const config = require('./config');
const app = require('./app');
const { sequelize } = require('./db');

async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('Conexión a PostgreSQL correcta.');
  } catch (e) {
    console.error('No se pudo conectar a PostgreSQL. Revisa DATABASE_URL en backend/.env');
    console.error(e.message);
    process.exit(1);
  }

  const servidor = app.listen(config.port, () => {
    console.log(`Sede Café escuchando en http://localhost:${config.port} (${config.nodeEnv})`);
  });

  const cerrar = (senal) => {
    console.log(`${senal} recibido, cerrando servidor...`);
    servidor.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));
}

iniciar();
