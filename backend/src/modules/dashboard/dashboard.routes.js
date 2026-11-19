const { Router } = require('express');
const { Op, col, where: sqlWhere } = require('sequelize');
const { Pedido, Producto, Usuario, Sucursal } = require('../../db');
const { autenticar } = require('../../middleware/auth');

const router = Router();
router.use(autenticar);

router.get('/', async (req, res) => {
  const gestor = req.usuario.rol !== 'EMPLEADO';
  const filtroPedidos = gestor ? {} : { solicitanteId: req.usuario.id };

  const [porEstado, totalProductos, bajoStock, recientes] = await Promise.all([
    Pedido.count({ where: filtroPedidos, group: ['estado'] }),
    Producto.count({ where: { activo: true } }),
    gestor
      ? Producto.findAll({
        where: { [Op.and]: [{ activo: true }, sqlWhere(col('stock_actual'), Op.lte, col('stock_minimo'))] },
        attributes: ['id', 'codigo', 'nombre', 'stockActual', 'stockMinimo', 'unidadMedida'],
        order: [['nombre', 'ASC']],
        limit: 10,
      })
      : [],
    Pedido.findAll({
      where: filtroPedidos,
      include: [
        { model: Usuario, as: 'solicitante', attributes: ['nombre'] },
        { model: Sucursal, as: 'sucursal', attributes: ['nombre'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 5,
    }),
  ]);

  const pedidos = { PENDIENTE: 0, EN_PROCESO: 0, ATENDIDO: 0, RECHAZADO: 0 };
  for (const fila of porEstado) pedidos[fila.estado] = Number(fila.count);

  res.json({ pedidos, totalProductos, bajoStock, recientes });
});

module.exports = router;
