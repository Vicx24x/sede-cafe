const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const config = require('../../config');
const { Usuario, Sucursal } = require('../../db');
const { autenticar } = require('../../middleware/auth');
const { HttpError, validar } = require('../../utils/http');

const router = Router();

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const esquemaCambioPassword = z.object({
  actual: z.string().min(1),
  nueva: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

const incluirSucursal = { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] };

router.post('/login', async (req, res) => {
  const { email, password } = validar(esquemaLogin, req.body);

  const usuario = await Usuario.scope('conPassword').findOne({ where: { email }, include: incluirSucursal });
  const valido = usuario && usuario.activo && (await bcrypt.compare(password, usuario.passwordHash));
  if (!valido) throw new HttpError(401, 'Correo o contraseña incorrectos');

  const token = jwt.sign({ sub: usuario.id, rol: usuario.rol }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  const { passwordHash, ...datos } = usuario.get({ plain: true });
  res.json({ token, usuario: datos });
});

router.get('/me', autenticar, async (req, res) => {
  res.json(await Usuario.findByPk(req.usuario.id, { include: incluirSucursal }));
});

router.put('/password', autenticar, async (req, res) => {
  const { actual, nueva } = validar(esquemaCambioPassword, req.body);
  const usuario = await Usuario.scope('conPassword').findByPk(req.usuario.id);
  if (!(await bcrypt.compare(actual, usuario.passwordHash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta');
  }
  await usuario.update({ passwordHash: await bcrypt.hash(nueva, 10) });
  res.json({ mensaje: 'Contraseña actualizada' });
});

module.exports = router;
