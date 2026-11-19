const {
  UniqueConstraintError, ForeignKeyConstraintError, ValidationError, DatabaseError,
} = require('sequelize');
const { HttpError } = require('../utils/http');

function noEncontrado(req, _res, next) {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, detalles: err.detalles });
  }
  if (err instanceof UniqueConstraintError) {
    const campos = Object.keys(err.fields || {}).join(', ');
    return res.status(409).json({ error: `Ya existe un registro con ese valor (${campos})` });
  }
  if (err instanceof ForeignKeyConstraintError) {
    return res.status(400).json({ error: 'La referencia a otro registro no es válida' });
  }
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.errors.map((e) => ({ campo: e.path, mensaje: e.message })),
    });
  }
  if (err instanceof DatabaseError && err.parent?.code === '22P02') {
    return res.status(400).json({ error: 'Valor con formato inválido' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { noEncontrado, manejadorErrores };
