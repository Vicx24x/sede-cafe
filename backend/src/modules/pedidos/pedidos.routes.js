const { Router } = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const {
  sequelize, Pedido, DetallePedido, HistorialEstado, Producto, Categoria, Usuario, Sucursal, Movimiento,
} = require('../../db');
const { autenticar, permitir } = require('../../middleware/auth');
const { HttpError, validar, idParam } = require('../../utils/http');

const router = Router();
router.use(autenticar);

// Flujo de estados permitido: Pendiente -> En proceso -> Atendido (o Rechazado)
const TRANSICIONES = {
  PENDIENTE: ['EN_PROCESO', 'RECHAZADO'],
  EN_PROCESO: ['ATENDIDO', 'RECHAZADO'],
  ATENDIDO: [],
  RECHAZADO: [],
};

const esquemaCrear = z.object({
  area: z.string().trim().max(80).optional().nullable(),
  sucursalId: z.coerce.number().int().positive().optional().nullable(),
  observaciones: z.string().trim().max(500).optional().nullable(),
  productos: z.array(z.object({
    productoId: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  })).min(1, 'El pedido debe incluir al menos un producto'),
});

const esquemaEstado = z.object({
  estado: z.enum(['EN_PROCESO', 'ATENDIDO', 'RECHAZADO']),
  comentario: z.string().trim().max(300).optional().nullable(),
});

const usuarioCorto = (as) => ({ model: Usuario, as, attributes: ['id', 'nombre'] });
const sucursalCorta = { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] };

const incluirDetalle = [
  { model: Usuario, as: 'solicitante', attributes: ['id', 'nombre', 'email'] },
  sucursalCorta,
  usuarioCorto('atendidoPor'),
  {
    model: DetallePedido, as: 'detalles',
    include: [{
      model: Producto, as: 'producto',
      attributes: ['id', 'codigo', 'nombre', 'unidadMedida', 'stockActual'],
      include: [{ model: Categoria, as: 'categoria', attributes: ['nombre'] }],
    }],
  },
  { model: HistorialEstado, as: 'historial', include: [usuarioCorto('usuario')] },
];

function esGestor(usuario) {
  return usuario.rol === 'ADMIN' || usuario.rol === 'ALMACEN';
}

async function obtenerPedido(id, usuario) {
  const pedido = await Pedido.findByPk(id, {
    include: incluirDetalle,
    order: [[{ model: DetallePedido, as: 'detalles' }, 'id', 'ASC'], [{ model: HistorialEstado, as: 'historial' }, 'fecha', 'ASC']],
  });
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
  if (!esGestor(usuario) && pedido.solicitanteId !== usuario.id) {
    throw new HttpError(403, 'No puedes ver pedidos de otros usuarios');
  }
  return pedido;
}

router.get('/', async (req, res) => {
  const { estado, sucursalId, q } = req.query;
  const where = {};
  if (!esGestor(req.usuario)) where.solicitanteId = req.usuario.id;
  if (estado) where.estado = estado;
  if (sucursalId) where.sucursalId = Number(sucursalId);
  if (q) {
    where[Op.or] = [
      { folio: { [Op.iLike]: `%${q}%` } },
      { area: { [Op.iLike]: `%${q}%` } },
      { '$solicitante.nombre$': { [Op.iLike]: `%${q}%` } },
    ];
  }
  const pedidos = await Pedido.findAll({
    where,
    include: [usuarioCorto('solicitante'), sucursalCorta],
    attributes: {
      include: [[sequelize.literal('(SELECT COUNT(*) FROM detalle_pedidos d WHERE d.pedido_id = "Pedido"."id")::int'), 'totalProductos']],
    },
    order: [['createdAt', 'DESC']],
  });
  res.json(pedidos);
});

router.get('/:id', async (req, res) => {
  res.json(await obtenerPedido(idParam(req), req.usuario));
});

router.post('/', async (req, res) => {
  const datos = validar(esquemaCrear, req.body);

  // Une renglones repetidos del mismo producto
  const cantidades = new Map();
  for (const { productoId, cantidad } of datos.productos) {
    cantidades.set(productoId, (cantidades.get(productoId) || 0) + cantidad);
  }

  const encontrados = await Producto.count({
    where: { id: [...cantidades.keys()], activo: true, disponible: true },
  });
  if (encontrados !== cantidades.size) {
    throw new HttpError(400, 'Uno o más productos no existen o no están disponibles');
  }

  // El empleado siempre pide para su propia sucursal; almacén/admin pueden elegirla
  const sucursalId = esGestor(req.usuario) ? (datos.sucursalId ?? req.usuario.sucursalId) : req.usuario.sucursalId;

  const id = await sequelize.transaction(async (transaction) => {
    const pedido = await Pedido.create({
      folio: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      area: datos.area ?? req.usuario.area,
      observaciones: datos.observaciones,
      solicitanteId: req.usuario.id,
      sucursalId,
    }, { transaction });

    await pedido.update({ folio: `SC-${new Date().getFullYear()}-${String(pedido.id).padStart(5, '0')}` }, { transaction });
    await DetallePedido.bulkCreate(
      [...cantidades].map(([productoId, cantidad]) => ({ pedidoId: pedido.id, productoId, cantidad })),
      { transaction },
    );
    await HistorialEstado.create({
      pedidoId: pedido.id, estadoNuevo: 'PENDIENTE', usuarioId: req.usuario.id, comentario: 'Pedido registrado',
    }, { transaction });
    return pedido.id;
  });

  res.status(201).json(await obtenerPedido(id, req.usuario));
});

// Cambio de estado por Almacén / Administración
router.patch('/:id/estado', permitir('ADMIN', 'ALMACEN'), async (req, res) => {
  const id = idParam(req);
  const { estado, comentario } = validar(esquemaEstado, req.body);

  await sequelize.transaction(async (transaction) => {
    const pedido = await Pedido.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
    if (!TRANSICIONES[pedido.estado].includes(estado)) {
      throw new HttpError(409, `No se puede pasar de ${pedido.estado} a ${estado}`);
    }
    if (estado === 'RECHAZADO' && !comentario) throw new HttpError(400, 'Indica el motivo del rechazo');

    // Al marcar como ATENDIDO se descuenta el inventario
    if (estado === 'ATENDIDO') {
      const detalles = await DetallePedido.findAll({ where: { pedidoId: id }, transaction });
      for (const d of detalles) {
        const producto = await Producto.findByPk(d.productoId, { transaction, lock: transaction.LOCK.UPDATE });
        const disponible = Number(producto.stockActual);
        const solicitado = Number(d.cantidad);
        if (disponible < solicitado) {
          throw new HttpError(409, `Stock insuficiente de "${producto.nombre}": hay ${disponible} ${producto.unidadMedida} y se piden ${solicitado}`);
        }
        const stockFinal = Math.round((disponible - solicitado) * 100) / 100;
        await producto.update({ stockActual: stockFinal }, { transaction });
        await Movimiento.create({
          productoId: producto.id, tipo: 'SALIDA', cantidad: solicitado, stockFinal,
          motivo: `Surtido del pedido ${pedido.folio}`, pedidoId: pedido.id, usuarioId: req.usuario.id,
        }, { transaction });
      }
    }

    const anterior = pedido.estado;
    await pedido.update({
      estado,
      atendidoPorId: req.usuario.id,
      ...(estado === 'ATENDIDO' ? { fechaAtencion: new Date() } : {}),
      ...(estado === 'RECHAZADO' ? { motivoRechazo: comentario } : {}),
    }, { transaction });
    await HistorialEstado.create({
      pedidoId: id, estadoAnterior: anterior, estadoNuevo: estado, comentario, usuarioId: req.usuario.id,
    }, { transaction });
  });

  res.json(await obtenerPedido(id, req.usuario));
});

// El solicitante puede cancelar su pedido mientras siga PENDIENTE
router.patch('/:id/cancelar', async (req, res) => {
  const id = idParam(req);
  const pedido = await obtenerPedido(id, req.usuario);
  if (pedido.estado !== 'PENDIENTE') throw new HttpError(409, 'Solo se pueden cancelar pedidos pendientes');

  await sequelize.transaction(async (transaction) => {
    await pedido.update({ estado: 'RECHAZADO', motivoRechazo: 'Cancelado por el solicitante' }, { transaction });
    await HistorialEstado.create({
      pedidoId: id, estadoAnterior: 'PENDIENTE', estadoNuevo: 'RECHAZADO',
      comentario: 'Cancelado por el solicitante', usuarioId: req.usuario.id,
    }, { transaction });
  });
  res.json(await obtenerPedido(id, req.usuario));
});

module.exports = router;
