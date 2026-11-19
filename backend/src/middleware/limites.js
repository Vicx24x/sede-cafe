const { rateLimit } = require('express-rate-limit');

// Máximo 50 intentos cada 15 minutos por equipo en inicio de sesión y registro
const limiteAcceso = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

module.exports = { limiteAcceso };
