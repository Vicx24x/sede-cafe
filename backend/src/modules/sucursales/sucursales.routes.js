const { Router } = require('express');
const { z } = require('zod');
const { Sucursal } = require('../../db');
const { autenticar, permitir } = require('../../middleware/auth');
const { HttpError, validar, idParam } = require('../../utils/http');

const router = Router();
router.use(autenticar);

const esquema = z.object({
  nombre: z.string().trim().min(2).max(100),
  direccion: z.string().trim().max(200).optional().nullable(),
  activo: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  const where = req.query.todas === 'true' ? {} : { activo: true };
  res.json(await Sucursal.findAll({ where, order: [['nombre', 'ASC']] }));
});

router.post('/', permitir('ADMIN'), async (req, res) => {
  res.status(201).json(await Sucursal.create(validar(esquema, req.body)));
});

router.put('/:id', permitir('ADMIN'), async (req, res) => {
  const sucursal = await Sucursal.findByPk(idParam(req));
  if (!sucursal) throw new HttpError(404, 'Sucursal no encontrada');
  res.json(await sucursal.update(validar(esquema, req.body)));
});

module.exports = router;
