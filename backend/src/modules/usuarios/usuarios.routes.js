const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { Op } = require('sequelize');
const { Usuario, Sucursal } = require('../../db');
const { autenticar, permitir } = require('../../middleware/auth');
const { HttpError, validar, idParam } = require('../../utils/http');

const router = Router();
router.use(autenticar, permitir('ADMIN'));

const incluir = [{ model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] }];

const base = {
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(120),
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  rol: z.enum(['ADMIN', 'ALMACEN', 'EMPLEADO']),
  area: z.string().trim().max(80).optional().nullable(),
  sucursalId: z.coerce.number().int().positive().optional().nullable(),
};

const esquemaCrear = z.object({
  ...base,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const esquemaEditar = z.object({
  ...base,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
});

async function buscar(id) {
  const usuario = await Usuario.findByPk(id, { include: incluir });
  if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
  return usuario;
}

router.get('/', async (req, res) => {
  const { q, rol } = req.query;
  const where = {};
  if (rol) where.rol = rol;
  if (q) where[Op.or] = [{ nombre: { [Op.iLike]: `%${q}%` } }, { email: { [Op.iLike]: `%${q}%` } }];
  res.json(await Usuario.findAll({ where, include: incluir, order: [['nombre', 'ASC']] }));
});

router.post('/', async (req, res) => {
  const { password, ...datos } = validar(esquemaCrear, req.body);
  const usuario = await Usuario.create({ ...datos, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json(await buscar(usuario.id));
});

router.put('/:id', async (req, res) => {
  const id = idParam(req);
  const { password, ...datos } = validar(esquemaEditar, req.body);
  if (id === req.usuario.id && datos.rol !== 'ADMIN') {
    throw new HttpError(400, 'No puedes quitarte a ti mismo el rol de administrador');
  }
  const usuario = await buscar(id);
  if (password) datos.passwordHash = await bcrypt.hash(password, 10);
  await usuario.update(datos);
  res.json(await buscar(id));
});

// Activar / desactivar (baja lógica)
router.patch('/:id/estado', async (req, res) => {
  const id = idParam(req);
  const { activo } = validar(z.object({ activo: z.boolean() }), req.body);
  if (id === req.usuario.id && !activo) throw new HttpError(400, 'No puedes desactivar tu propia cuenta');
  const usuario = await buscar(id);
  await usuario.update({ activo });
  res.json(usuario);
});

module.exports = router;
