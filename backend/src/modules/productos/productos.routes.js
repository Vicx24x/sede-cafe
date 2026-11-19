const { Router } = require('express');
const { z } = require('zod');
const { Op, col, where: sqlWhere } = require('sequelize');
const { sequelize, Producto, Categoria, Movimiento, Usuario, Pedido } = require('../../db');
const { autenticar, permitir } = require('../../middleware/auth');
const { HttpError, validar, idParam } = require('../../utils/http');

const router = Router();
router.use(autenticar);

const gestores = permitir('ADMIN', 'ALMACEN');

const esquema = z.object({
  codigo: z.string().trim().toUpperCase().min(1).max(30),
  nombre: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(300).optional().nullable(),
  tipo: z.enum(['PRODUCTO', 'INSUMO', 'MATERIAL']),
  unidadMedida: z.string().trim().min(1).max(20),
  stockMinimo: z.coerce.number().min(0),
  stockActual: z.coerce.number().min(0).optional(), // solo se usa al crear
  categoriaId: z.coerce.number().int().positive(),
  disponible: z.boolean().optional(),
});

const esquemaMovimiento = z.object({
  tipo: z.enum(['ENTRADA', 'AJUSTE']),
  cantidad: z.coerce.number().min(0),
  motivo: z.string().trim().max(200).optional().nullable(),
});

const incluir = [{ model: Categoria, as: 'categoria', attributes: ['id', 'nombre'] }];

// Condición SQL: stock_actual <= stock_minimo
const condicionBajoStock = sqlWhere(col('Producto.stock_actual'), Op.lte, col('Producto.stock_minimo'));

async function buscar(id, transaction) {
  const producto = await Producto.findByPk(id, { include: incluir, transaction });
  if (!producto) throw new HttpError(404, 'Producto no encontrado');
  return producto;
}

router.get('/', async (req, res) => {
  const { q, categoriaId, tipo, bajoStock, incluirInactivos, soloDisponibles } = req.query;
  const filtros = [];
  if (incluirInactivos !== 'true') filtros.push({ activo: true });
  if (soloDisponibles === 'true') filtros.push({ disponible: true });
  if (categoriaId) filtros.push({ categoriaId: Number(categoriaId) });
  if (tipo) filtros.push({ tipo });
  if (bajoStock === 'true') filtros.push(condicionBajoStock);
  if (q) filtros.push({ [Op.or]: [{ nombre: { [Op.iLike]: `%${q}%` } }, { codigo: { [Op.iLike]: `%${q}%` } }] });
  const productos = await Producto.findAll({ where: { [Op.and]: filtros }, include: incluir, order: [['nombre', 'ASC']] });
  res.json(productos);
});

router.get('/:id', async (req, res) => {
  res.json(await buscar(idParam(req)));
});

router.get('/:id/movimientos', gestores, async (req, res) => {
  const movimientos = await Movimiento.findAll({
    where: { productoId: idParam(req) },
    include: [
      { model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] },
      { model: Pedido, as: 'pedido', attributes: ['id', 'folio'] },
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']],
    limit: 100,
  });
  res.json(movimientos);
});

router.post('/', gestores, async (req, res) => {
  const { stockActual = 0, ...datos } = validar(esquema, req.body);
  const id = await sequelize.transaction(async (transaction) => {
    const nuevo = await Producto.create({ ...datos, stockActual }, { transaction });
    if (stockActual > 0) {
      await Movimiento.create({
        productoId: nuevo.id, tipo: 'ENTRADA', cantidad: stockActual, stockFinal: stockActual,
        motivo: 'Existencia inicial', usuarioId: req.usuario.id,
      }, { transaction });
    }
    return nuevo.id;
  });
  res.status(201).json(await buscar(id));
});

// La edición no cambia el stock: eso se hace con movimientos para dejar rastro
router.put('/:id', gestores, async (req, res) => {
  const producto = await buscar(idParam(req));
  const { stockActual, ...datos } = validar(esquema, req.body);
  await producto.update(datos);
  res.json(await buscar(producto.id));
});

router.patch('/:id/disponibilidad', gestores, async (req, res) => {
  const producto = await buscar(idParam(req));
  const { disponible } = validar(z.object({ disponible: z.boolean() }), req.body);
  res.json(await producto.update({ disponible }));
});

// Baja lógica
router.delete('/:id', gestores, async (req, res) => {
  const producto = await buscar(idParam(req));
  res.json(await producto.update({ activo: false, disponible: false }));
});

// Reactivar un producto dado de baja
router.patch('/:id/reactivar', gestores, async (req, res) => {
  const producto = await buscar(idParam(req));
  res.json(await producto.update({ activo: true, disponible: true }));
});

// Entrada de mercancía (suma) o ajuste de inventario (fija el stock al conteo físico)
router.post('/:id/movimientos', gestores, async (req, res) => {
  const id = idParam(req);
  const { tipo, cantidad, motivo } = validar(esquemaMovimiento, req.body);
  if (tipo === 'ENTRADA' && cantidad <= 0) throw new HttpError(400, 'La cantidad de entrada debe ser mayor a 0');

  await sequelize.transaction(async (transaction) => {
    const producto = await Producto.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!producto || !producto.activo) throw new HttpError(404, 'Producto no encontrado o dado de baja');
    const stockFinal = tipo === 'ENTRADA' ? Number(producto.stockActual) + cantidad : cantidad;
    await producto.update({ stockActual: stockFinal }, { transaction });
    await Movimiento.create({ productoId: id, tipo, cantidad, stockFinal, motivo, usuarioId: req.usuario.id }, { transaction });
  });
  res.status(201).json(await buscar(id));
});

module.exports = router;
