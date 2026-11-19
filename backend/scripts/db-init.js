// Crea las tablas en la base de datos a partir de los modelos.
//   npm run db:init           -> crea las tablas que falten (no borra datos)
//   node scripts/db-init.js --reset -> BORRA todo y vuelve a crear las tablas
const { sequelize } = require('../src/db');

async function main() {
  const reset = process.argv.includes('--reset');
  await sequelize.authenticate();
  console.log('Conexión a PostgreSQL correcta.');
  await sequelize.sync(reset ? { force: true } : {});
  console.log(reset ? 'Tablas eliminadas y creadas de nuevo.' : 'Tablas creadas / verificadas.');
}

main()
  .catch((e) => {
    console.error('Error al inicializar la base de datos:', e.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
