const jwt = require('jsonwebtoken');
const config = require('../config');
const { Usuario } = require('../db');
const { HttpError } = require('../utils/http');

// Verifica el token JWT enviado en el encabezado Authorization: Bearer <token>
async function autenticar(req, _res, next) {
  const encabezado = req.headers.authorization || '';
  const [tipo, token] = encabezado.split(' ');
  if (tipo !== 'Bearer' || !token) throw new HttpError(401, 'Se requiere iniciar sesión');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Sesión inválida o expirada');
  }

  const usuario = await Usuario.findByPk(payload.sub);
  if (!usuario || !usuario.activo) throw new HttpError(401, 'Usuario inactivo o inexistente');

  req.usuario = usuario.get({ plain: true });
  next();
}

// Restringe una ruta a ciertos roles
function permitir(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      throw new HttpError(403, 'No tienes permiso para realizar esta acción');
    }
    next();
  };
}

module.exports = { autenticar, permitir };
