const { Router } = require('express');
const { z } = require('zod');
const { Op, col, where: sqlWhere } = require('sequelize');
const { sequelize, Producto, Categoria, Movimiento, Usuario, Pedido } = require('../../db');
const { autenticar, permitir } = require('../../middleware/auth');
const { HttpError, validar, idParam } = require('../../utils/http');
const { UNIDADES } = require('../../utils/unidades');

const router = Router();
router.use(autenticar);

const gestores = permitir('ADMIN', 'ALMACEN');

const entero = (mensaje) => z.coerce.number({ error: mensaje }).int('Debe ser un número entero').min(0, 'No puede ser negativo');

const esquema = z.object({
  codigo: z.string().trim().toUpperCase().min(1, 'El código es obligatorio').max(30),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  descripcion: z.string().trim().max(300).optional().nullable(),
  tipo: z.enum(['PRODUCTO', 'INSUMO', 'MATERIAL']).optional(),
  unidadMedida: z.enum(UNIDADES, { error: 'Elige una unidad de la lista' }),
  stockMinimo: entero('Indica el stock mínimo'),
  stockActual: entero('Indica el stock actual').optional(),
  // Se acepta el id de una categoría existente o el nombre (si no existe, se crea)
  categoriaId: z.coerce.number().int().positive().optional(),
  categoria: z.string().trim().min(2, 'Indica la categoría').max(80).optional(),
  disponible: z.boolean().optional(),
}).refine((d) => d.categoriaId || d.categoria, { message: 'Indica la categoría', path: ['categoria'] });

const esquemaMovimiento = z.object({
  tipo: z.enum(['ENTRADA', 'AJUSTE']),
  cantidad: entero('Indica la cantidad'),
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

async function resolverCategoria({ categoriaId, categoria }, transaction) {
  if (categoriaId) return categoriaId;
  const existente = await Categoria.findOne({
    where: sqlWhere(sequelize.fn('lower', col('nombre')), categoria.toLowerCase()), transaction,
  });
  if (existente) {
    if (!existente.activo) await existente.update({ activo: true }, { transaction });
    return existente.id;
  }
  const nueva = await Categoria.create({ nombre: categoria }, { transaction });
  return nueva.id;
}

router.get('/', async (req, res) => {
  const { q, categoriaId, tipo, bajoStock, incluirInactivos, soloInactivos, soloDisponibles } = req.query;
  const filtros = [];
  if (soloInactivos === 'true') filtros.push({ activo: false });
  else if (incluirInactivos !== 'true') filtros.push({ activo: true });
  if (soloDisponibles === 'true') filtros.push({ disponible: true });
  if (categoriaId) filtros.push({ categoriaId: Number(categoriaId) });
  if (tipo) filtros.push({ tipo });
  if (bajoStock === 'true') filtros.push(condicionBajoStock);
  if (q) filtros.push({ [Op.or]: [{ nombre: { [Op.iLike]: `%${q}%` } }, { codigo: { [Op.iLike]: `%${q}%` } }] });
  const productos = await Producto.findAll({
    where: { [Op.and]: filtros },
    include: incluir,
    order: [[{ model: Categoria, as: 'categoria' }, 'nombre', 'ASC'], ['nombre', 'ASC']],
  });
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
  const { stockActual = 0, categoria, ...datos } = validar(esquema, req.body);
  const id = await sequelize.transaction(async (transaction) => {
    datos.categoriaId = await resolverCategoria({ categoriaId: datos.categoriaId, categoria }, transaction);
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

// Editar: si cambia el stock actual, se registra un movimiento de ajuste para dejar rastro
router.put('/:id', gestores, async (req, res) => {
  const id = idParam(req);
  const { stockActual, categoria, ...datos } = validar(esquema, req.body);
  await sequelize.transaction(async (transaction) => {
    const producto = await Producto.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!producto) throw new HttpError(404, 'Producto no encontrado');
    datos.categoriaId = await resolverCategoria({ categoriaId: datos.categoriaId, categoria }, transaction);
    if (stockActual !== undefined && stockActual !== Number(producto.stockActual)) {
      datos.stockActual = stockActual;
      await Movimiento.create({
        productoId: id, tipo: 'AJUSTE', cantidad: stockActual, stockFinal: stockActual,
        motivo: 'Ajuste desde la edición del producto', usuarioId: req.usuario.id,
      }, { transaction });
    }
    await producto.update(datos, { transaction });
  });
  res.json(await buscar(id));
});

router.patch('/:id/disponibilidad', gestores, async (req, res) => {
  const producto = await buscar(idParam(req));
  const { disponible } = validar(z.object({ disponible: z.boolean() }), req.body);
  res.json(await producto.update({ disponible }));
});

// Baja lógica: el producto no se borra para conservar el historial de pedidos
router.delete('/:id', gestores, async (req, res) => {
  const producto = await buscar(idParam(req));
  res.json(await producto.update({ activo: false, disponible: false }));
});

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
