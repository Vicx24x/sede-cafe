const { z } = require('zod');

// Mensajes de validación de Zod en español
z.config(z.locales.es());

// Error con código HTTP que el middleware de errores sabe responder
class HttpError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

// Valida req.body / req.query con un esquema de Zod y devuelve los datos limpios
function validar(esquema, datos) {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((i) => ({
      campo: i.path.join('.'),
      mensaje: i.message,
    }));
    throw new HttpError(400, 'Datos inválidos', detalles);
  }
  return resultado.data;
}

function idParam(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identificador inválido');
  return id;
}

module.exports = { HttpError, validar, idParam };
