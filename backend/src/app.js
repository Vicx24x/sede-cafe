const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const config = require('./config');
const { sequelize } = require('./db');
const { noEncontrado, manejadorErrores } = require('./middleware/errores');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // detrás de Nginx
// Cabeceras de seguridad. Se quita "upgrade-insecure-requests" porque la VM se sirve por HTTP.
app.use(helmet({
  contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
  strictTransportSecurity: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
if (config.nodeEnv !== 'production') app.use(cors({ origin: config.corsOrigin }));

// Verificación de salud (útil para probar el despliegue en la VM)
app.get('/api/health', async (_req, res) => {
  await sequelize.authenticate();
  res.json({ estado: 'ok', baseDeDatos: 'conectada', fecha: new Date().toISOString() });
});

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/usuarios', require('./modules/usuarios/usuarios.routes'));
app.use('/api/sucursales', require('./modules/sucursales/sucursales.routes'));
app.use('/api/categorias', require('./modules/categorias/categorias.routes'));
app.use('/api/productos', require('./modules/productos/productos.routes'));
app.use('/api/pedidos', require('./modules/pedidos/pedidos.routes'));
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));
app.use('/api', noEncontrado);

// En producción el mismo servidor entrega el frontend compilado (monolito)
if (fs.existsSync(config.frontendDist)) {
  app.use(express.static(config.frontendDist));
  app.get('/{*ruta}', (_req, res) => res.sendFile(path.join(config.frontendDist, 'index.html')));
}

app.use(noEncontrado);
app.use(manejadorErrores);

module.exports = app;
