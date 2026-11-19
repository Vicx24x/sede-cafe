const { Router } = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const {
  sequelize, Pedido, DetallePedido, HistorialEstado, Producto, Categoria, Usuario, Sucursal, Movimiento,
} = require('../../db');
const { autenticar, permitir } = require('../../middleware/auth');
const { HttpError, validar, idParam } = require('../../utils/http');
const { formatoCantidad } = require('../../utils/unidades');

const router = Router();
router.use(autenticar);

// Flujo de estados permitido: Pendiente -> En proceso -> Atendido (o Rechazado)
const TRANSICIONES = {
  PENDIENTE: ['EN_PROCESO', 'RECHAZADO'],
  EN_PROCESO: ['ATENDIDO', 'RECHAZADO'],
  ATENDIDO: [],
  RECHAZADO: [],
};

const COMENTARIO_POR_ESTADO = {
  EN_PROCESO: 'Recibido por el almacén',
  ATENDIDO: 'Entregado; el stock se descontó',
};

const esquemaCrear = z.object({
  area: z.string().trim().max(80).optional().nullable(),
  sucursalId: z.coerce.number().int().positive().optional().nullable(),
  observaciones: z.string().trim().max(500).optional().nullable(),
  productos: z.array(z.object({
    productoId: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().int('La cantidad debe ser un número entero').min(1, 'La cantidad mínima es 1'),
  })).min(1, 'Agrega al menos un producto a la solicitud'),
});

const esquemaEstado = z.object({
  estado: z.enum(['EN_PROCESO', 'ATENDIDO', 'RECHAZADO']),
  comentario: z.string().trim().max(300).optional().nullable(),
});

const incluirPedido = [
  {
    model: Usuario, as: 'solicitante', attributes: ['id', 'nombre', 'email', 'area'],
    include: [{ model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] }],
  },
  { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
  { model: Usuario, as: 'atendidoPor', attributes: ['id', 'nombre'] },
  {
    model: DetallePedido, as: 'detalles',
    include: [{
      model: Producto, as: 'producto',
      attributes: ['id', 'codigo', 'nombre', 'unidadMedida', 'stockActual'],
      include: [{ model: Categoria, as: 'categoria', attributes: ['nombre'] }],
    }],
  },
  { model: HistorialEstado, as: 'historial', include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] }] },
];

const ordenInterno = [
  [{ model: DetallePedido, as: 'detalles' }, 'id', 'ASC'],
  [{ model: HistorialEstado, as: 'historial' }, 'fecha', 'ASC'],
  [{ model: HistorialEstado, as: 'historial' }, 'id', 'ASC'],
];

function esGestor(usuario) {
  return usuario.rol === 'ADMIN' || usuario.rol === 'ALMACEN';
}

async function obtenerPedido(id, usuario) {
  const pedido = await Pedido.findByPk(id, { include: incluirPedido, order: ordenInterno });
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
  if (!esGestor(usuario) && pedido.solicitanteId !== usuario.id) {
    throw new HttpError(403, 'No puedes ver pedidos de otros usuarios');
  }
  return pedido;
}

// Lista con productos y bitácora: el empleado ve solo los suyos, el almacén todos
router.get('/', async (req, res) => {
  const { estado, sucursalId, q } = req.query;
  const where = {};
  if (!esGestor(req.usuario)) where.solicitanteId = req.usuario.id;
  if (estado) where.estado = estado;
  if (sucursalId) where.sucursalId = Number(sucursalId);
  if (q) {
    where[Op.or] = [
      { folio: { [Op.iLike]: `%${q}%` } },
      { '$solicitante.nombre$': { [Op.iLike]: `%${q}%` } },
    ];
  }
  const pedidos = await Pedido.findAll({
    where,
    include: incluirPedido,
    order: [['createdAt', 'DESC'], ['id', 'DESC'], ...ordenInterno],
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

  const productos = await Producto.findAll({
    where: { id: [...cantidades.keys()], activo: true, disponible: true },
  });
  if (productos.length !== cantidades.size) {
    throw new HttpError(400, 'Uno o más productos no existen o no están disponibles');
  }
  // El empleado no puede pedir más de lo que hay en existencia
  const excedidos = productos.filter((p) => cantidades.get(p.id) > Number(p.stockActual));
  if (excedidos.length) {
    throw new HttpError(409, excedidos
      .map((p) => `Solo hay ${formatoCantidad(p.stockActual, p.unidadMedida)} de ${p.nombre} en existencia`)
      .join('. '));
  }

  // El empleado siempre pide para su propia sucursal; el almacén puede elegirla
  const sucursalId = esGestor(req.usuario) ? (datos.sucursalId ?? req.usuario.sucursalId) : req.usuario.sucursalId;

  const id = await sequelize.transaction(async (transaction) => {
    const pedido = await Pedido.create({
      folio: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      area: datos.area ?? req.usuario.area,
      observaciones: datos.observaciones || null,
      solicitanteId: req.usuario.id,
      sucursalId,
    }, { transaction });

    await pedido.update({ folio: `PED-${String(pedido.id).padStart(4, '0')}` }, { transaction });
    await DetallePedido.bulkCreate(
      [...cantidades].map(([productoId, cantidad]) => ({ pedidoId: pedido.id, productoId, cantidad })),
      { transaction },
    );
    await HistorialEstado.create({
      pedidoId: pedido.id, estadoNuevo: 'PENDIENTE', usuarioId: req.usuario.id, comentario: 'Solicitud creada',
    }, { transaction });
    return pedido.id;
  });

  res.status(201).json(await obtenerPedido(id, req.usuario));
});

// Cambio de estado por el almacén
router.patch('/:id/estado', permitir('ADMIN', 'ALMACEN'), async (req, res) => {
  const id = idParam(req);
  const { estado, comentario } = validar(esquemaEstado, req.body);

  await sequelize.transaction(async (transaction) => {
    // Bloquea el pedido: si otra persona lo está cambiando, esta operación espera y luego valida
    const pedido = await Pedido.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
    if (!TRANSICIONES[pedido.estado].includes(estado)) {
      throw new HttpError(409, `El pedido ${pedido.folio} ya está ${pedido.estado.replace('_', ' ').toLowerCase()}; no se puede cambiar a ${estado.replace('_', ' ').toLowerCase()}`);
    }
    if (estado === 'RECHAZADO' && !comentario) throw new HttpError(400, 'Escribe el motivo del rechazo');

    // Al marcar ATENDIDO se descuenta el inventario: todo o nada, en orden fijo por producto
    if (estado === 'ATENDIDO') {
      const detalles = await DetallePedido.findAll({ where: { pedidoId: id }, order: [['productoId', 'ASC']], transaction });
      const faltantes = [];
      for (const d of detalles) {
        const producto = await Producto.findByPk(d.productoId, { transaction, lock: transaction.LOCK.UPDATE });
        const disponible = Number(producto.stockActual);
        const solicitado = Number(d.cantidad);
        if (disponible < solicitado) {
          faltantes.push(`${producto.nombre}: hay ${formatoCantidad(disponible, producto.unidadMedida)} y se piden ${formatoCantidad(solicitado, producto.unidadMedida)}`);
          continue;
        }
        const stockFinal = disponible - solicitado;
        await producto.update({ stockActual: stockFinal }, { transaction });
        await Movimiento.create({
          productoId: producto.id, tipo: 'SALIDA', cantidad: solicitado, stockFinal,
          motivo: `Surtido del pedido ${pedido.folio}`, pedidoId: pedido.id, usuarioId: req.usuario.id,
        }, { transaction });
      }
      // Si falta cualquier producto, la transacción se revierte y no se descuenta ninguno
      if (faltantes.length) throw new HttpError(409, `Existencia insuficiente. ${faltantes.join('; ')}`);
    }

    const anterior = pedido.estado;
    await pedido.update({
      estado,
      atendidoPorId: req.usuario.id,
      ...(estado === 'ATENDIDO' ? { fechaAtencion: new Date() } : {}),
      ...(estado === 'RECHAZADO' ? { motivoRechazo: comentario } : {}),
    }, { transaction });
    await HistorialEstado.create({
      pedidoId: id, estadoAnterior: anterior, estadoNuevo: estado,
      comentario: comentario || COMENTARIO_POR_ESTADO[estado], usuarioId: req.usuario.id,
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
