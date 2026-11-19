const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const config = require('../../config');
const { sequelize, Usuario, Sucursal } = require('../../db');
const { autenticar } = require('../../middleware/auth');
const { limiteAcceso } = require('../../middleware/limites');
const { HttpError, validar } = require('../../utils/http');

const router = Router();

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(3, 'Escribe tu nombre completo').max(120),
  sucursal: z.string().trim().min(2, 'Indica tu sucursal o área').max(100),
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
});

const esquemaCambioPassword = z.object({
  actual: z.string().min(1),
  nueva: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

const incluirSucursal = { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] };

function firmar(usuario) {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

router.post('/login', limiteAcceso, async (req, res) => {
  const { email, password } = validar(esquemaLogin, req.body);

  const usuario = await Usuario.scope('conPassword').findOne({ where: { email }, include: incluirSucursal });
  const valido = usuario && usuario.activo && (await bcrypt.compare(password, usuario.passwordHash));
  if (!valido) throw new HttpError(401, 'Correo o contraseña incorrectos');

  const { passwordHash, ...datos } = usuario.get({ plain: true });
  res.json({ token: firmar(usuario), usuario: datos });
});

// Registro de empleados: las cuentas nuevas SIEMPRE son de perfil empleado
router.post('/registro', limiteAcceso, async (req, res) => {
  const { nombre, sucursal, email, password } = validar(esquemaRegistro, req.body);

  if (await Usuario.findOne({ where: { email } })) {
    throw new HttpError(409, 'Ya existe una cuenta con ese correo');
  }

  const id = await sequelize.transaction(async (transaction) => {
    const [suc] = await Sucursal.findOrCreate({ where: { nombre: sucursal }, defaults: { nombre: sucursal }, transaction });
    const nuevo = await Usuario.create({
      nombre, email, rol: 'EMPLEADO', sucursalId: suc.id, passwordHash: await bcrypt.hash(password, 10),
    }, { transaction });
    return nuevo.id;
  });

  const usuario = await Usuario.findByPk(id, { include: incluirSucursal });
  res.status(201).json({ token: firmar(usuario), usuario });
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
