const { Router } = require('express');
const { Op, col, where: sqlWhere } = require('sequelize');
const { Pedido, Producto } = require('../../db');
const { autenticar } = require('../../middleware/auth');

const router = Router();
router.use(autenticar);

// Resumen para la franja de estados: pedidos por estado y productos con stock bajo
router.get('/', async (req, res) => {
  const gestor = req.usuario.rol !== 'EMPLEADO';
  const filtroPedidos = gestor ? {} : { solicitanteId: req.usuario.id };

  const [porEstado, totalProductos, productosBajoStock] = await Promise.all([
    Pedido.count({ where: filtroPedidos, group: ['estado'] }),
    Producto.count({ where: { activo: true } }),
    gestor
      ? Producto.count({
        where: { [Op.and]: [{ activo: true }, sqlWhere(col('stock_actual'), Op.lte, col('stock_minimo'))] },
      })
      : 0,
  ]);

  const pedidos = { PENDIENTE: 0, EN_PROCESO: 0, ATENDIDO: 0, RECHAZADO: 0 };
  for (const fila of porEstado) pedidos[fila.estado] = Number(fila.count);

  res.json({ pedidos, totalProductos, productosBajoStock });
});

module.exports = router;
