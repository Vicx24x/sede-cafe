const { Router } = require('express');
const { z } = require('zod');
const { Categoria, Producto } = require('../../db');
const { autenticar, permitir } = require('../../middleware/auth');
const { HttpError, validar, idParam } = require('../../utils/http');

const router = Router();
router.use(autenticar);

const esquema = z.object({
  nombre: z.string().trim().min(2).max(80),
  descripcion: z.string().trim().max(200).optional().nullable(),
  activo: z.boolean().optional(),
});

async function buscar(id) {
  const categoria = await Categoria.findByPk(id);
  if (!categoria) throw new HttpError(404, 'Categoría no encontrada');
  return categoria;
}

router.get('/', async (req, res) => {
  const where = req.query.todas === 'true' ? {} : { activo: true };
  const categorias = await Categoria.findAll({ where, order: [['nombre', 'ASC']], raw: true });
  // Número de productos activos por categoría
  const conteos = await Producto.count({ where: { activo: true }, group: ['categoriaId'] });
  const porCategoria = Object.fromEntries(conteos.map((c) => [c.categoriaId, Number(c.count)]));
  res.json(categorias.map((c) => ({ ...c, totalProductos: porCategoria[c.id] || 0 })));
});

router.post('/', permitir('ADMIN', 'ALMACEN'), async (req, res) => {
  res.status(201).json(await Categoria.create(validar(esquema, req.body)));
});

router.put('/:id', permitir('ADMIN', 'ALMACEN'), async (req, res) => {
  const categoria = await buscar(idParam(req));
  res.json(await categoria.update(validar(esquema, req.body)));
});

// Baja lógica: solo si no tiene productos activos
router.delete('/:id', permitir('ADMIN', 'ALMACEN'), async (req, res) => {
  const categoria = await buscar(idParam(req));
  const activos = await Producto.count({ where: { categoriaId: categoria.id, activo: true } });
  if (activos > 0) {
    throw new HttpError(409, `No se puede dar de baja: la categoría tiene ${activos} producto(s) activo(s)`);
  }
  res.json(await categoria.update({ activo: false }));
});

module.exports = router;
