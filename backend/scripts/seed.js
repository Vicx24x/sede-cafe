// Datos de demostración (los mismos del documento del proyecto): npm run db:seed
// Es seguro ejecutarlo varias veces: no duplica usuarios, productos ni pedidos.
const bcrypt = require('bcryptjs');
const {
  sequelize, Sucursal, Usuario, Categoria, Producto, Pedido, DetallePedido, HistorialEstado, Movimiento,
} = require('../src/db');

const PRODUCTOS = [
  // código, nombre, categoría, unidad, stock, mínimo
  ['DES-001', 'Vaso 8 oz', 'Desechables', 'paquete', 40, 20],
  ['DES-002', 'Vaso 12 oz', 'Desechables', 'paquete', 35, 20],
  ['DES-003', 'Tapa para vaso 12 oz', 'Desechables', 'paquete', 30, 20],
  ['DES-004', 'Popotes', 'Desechables', 'caja', 8, 4],
  ['DES-005', 'Servilletas', 'Desechables', 'paquete', 60, 30],
  ['GRA-001', 'Café en grano espresso', 'Grano', 'bolsa', 24, 10],
  ['GRA-002', 'Café en grano para filtrado', 'Grano', 'bolsa', 18, 8],
  ['GRA-003', 'Café descafeinado', 'Grano', 'bolsa', 6, 6],
  ['JAR-001', 'Jarabe de vainilla', 'Jarabes', 'botella', 12, 6],
  ['JAR-002', 'Jarabe de caramelo', 'Jarabes', 'botella', 9, 6],
  ['JAR-003', 'Jarabe de avellana', 'Jarabes', 'botella', 2, 5],
  ['LAC-001', 'Leche entera', 'Lácteos', 'litro', 120, 60],
  ['LAC-002', 'Leche deslactosada', 'Lácteos', 'litro', 80, 40],
  ['LAC-003', 'Leche de avena', 'Lácteos', 'litro', 3, 12],
  ['LAC-004', 'Crema para batir', 'Lácteos', 'litro', 14, 8],
  ['LIM-001', 'Detergente multiusos', 'Limpieza', 'litro', 10, 5],
  ['LIM-002', 'Sanitizante', 'Limpieza', 'litro', 8, 4],
  ['LIM-003', 'Bolsas para basura', 'Limpieza', 'paquete', 25, 10],
  ['REP-001', 'Chocolate en polvo', 'Repostería', 'kilogramo', 15, 8],
  ['REP-002', 'Azúcar', 'Repostería', 'kilogramo', 40, 20],
];

const horasAtras = (h) => new Date(Date.now() - h * 3600 * 1000);

async function main() {
  await sequelize.sync();

  const sucursales = {};
  for (const nombre of ['Sucursal 1', 'Sucursal 2']) {
    const [s] = await Sucursal.findOrCreate({ where: { nombre }, defaults: { nombre } });
    sucursales[nombre] = s.id;
  }

  const usuarios = {};
  for (const u of [
    { clave: 'admin', nombre: 'Almacén Central', email: 'admin@sedecafe.com', rol: 'ADMIN', area: 'Almacén y Logística', password: 'Admin123!' },
    { clave: 'ana', nombre: 'Ana Torres', email: 'empleado1@sedecafe.com', rol: 'EMPLEADO', sucursal: 'Sucursal 1', password: 'Empleado123!' },
    { clave: 'luis', nombre: 'Luis Ramírez', email: 'empleado2@sedecafe.com', rol: 'EMPLEADO', sucursal: 'Sucursal 2', password: 'Empleado123!' },
  ]) {
    const [usuario] = await Usuario.findOrCreate({
      where: { email: u.email },
      defaults: {
        nombre: u.nombre, email: u.email, rol: u.rol, area: u.area || null,
        sucursalId: u.sucursal ? sucursales[u.sucursal] : null,
        passwordHash: await bcrypt.hash(u.password, 10),
      },
    });
    usuarios[u.clave] = usuario;
  }

  const productos = {};
  for (const [codigo, nombre, categoria, unidadMedida, stock, minimo] of PRODUCTOS) {
    const [cat] = await Categoria.findOrCreate({ where: { nombre: categoria }, defaults: { nombre: categoria } });
    let p = await Producto.findOne({ where: { codigo } });
    if (!p) {
      p = await Producto.create({
        codigo, nombre, unidadMedida, stockActual: stock, stockMinimo: minimo, categoriaId: cat.id,
        tipo: ['Desechables', 'Limpieza'].includes(categoria) ? 'MATERIAL' : 'INSUMO',
      });
      await Movimiento.create({
        productoId: p.id, tipo: 'ENTRADA', cantidad: stock, stockFinal: stock,
        motivo: 'Existencia inicial', usuarioId: usuarios.admin.id, fecha: horasAtras(96),
      });
    }
    productos[codigo] = p;
  }

  // Pedidos de ejemplo, solo si la base todavía no tiene pedidos
  if ((await Pedido.count()) === 0) {
    const { admin, ana, luis } = usuarios;
    const ejemplos = [
      { // PED-0001
        solicitante: ana, sucursal: 'Sucursal 1', creado: horasAtras(26), observaciones: 'Para el turno de la tarde',
        lineas: [['GRA-001', 4], ['DES-002', 6], ['DES-003', 6]],
        historial: [],
      },
      { // PED-0002
        solicitante: luis, sucursal: 'Sucursal 2', creado: horasAtras(44),
        lineas: [['LAC-001', 12], ['JAR-001', 2]],
        historial: [{ estado: 'EN_PROCESO', horas: 40, comentario: 'Recibido por el almacén' }],
      },
      { // PED-0003
        solicitante: ana, sucursal: 'Sucursal 1', creado: horasAtras(70),
        lineas: [['DES-005', 5]],
        historial: [
          { estado: 'EN_PROCESO', horas: 69, comentario: 'Recibido por el almacén' },
          { estado: 'ATENDIDO', horas: 68, comentario: 'Entregado; el stock se descontó' },
        ],
      },
      { // PED-0004
        solicitante: luis, sucursal: 'Sucursal 2', creado: horasAtras(50),
        lineas: [['JAR-003', 10]],
        historial: [{ estado: 'RECHAZADO', horas: 48, comentario: 'No hay existencias suficientes; se surte el viernes.' }],
      },
    ];

    for (const e of ejemplos) {
      await sequelize.transaction(async (transaction) => {
        const final = e.historial.at(-1)?.estado ?? 'PENDIENTE';
        const pedido = await Pedido.create({
          folio: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, estado: final, observaciones: e.observaciones || null,
          solicitanteId: e.solicitante.id, sucursalId: sucursales[e.sucursal],
          atendidoPorId: e.historial.length ? admin.id : null,
          fechaAtencion: final === 'ATENDIDO' ? horasAtras(e.historial.at(-1).horas) : null,
          motivoRechazo: final === 'RECHAZADO' ? e.historial.at(-1).comentario : null,
          createdAt: e.creado,
        }, { transaction });
        await pedido.update({ folio: `PED-${String(pedido.id).padStart(4, '0')}` }, { transaction, silent: true });
        await DetallePedido.bulkCreate(
          e.lineas.map(([codigo, cantidad]) => ({ pedidoId: pedido.id, productoId: productos[codigo].id, cantidad })),
          { transaction },
        );
        await HistorialEstado.create({
          pedidoId: pedido.id, estadoNuevo: 'PENDIENTE', comentario: 'Solicitud creada', usuarioId: e.solicitante.id, fecha: e.creado,
        }, { transaction });
        let anterior = 'PENDIENTE';
        for (const h of e.historial) {
          await HistorialEstado.create({
            pedidoId: pedido.id, estadoAnterior: anterior, estadoNuevo: h.estado, comentario: h.comentario,
            usuarioId: admin.id, fecha: horasAtras(h.horas),
          }, { transaction });
          anterior = h.estado;
        }
        // El pedido atendido ya está reflejado en la existencia inicial; solo se deja el movimiento
        if (final === 'ATENDIDO') {
          for (const [codigo, cantidad] of e.lineas) {
            await Movimiento.create({
              productoId: productos[codigo].id, tipo: 'SALIDA', cantidad, stockFinal: productos[codigo].stockActual,
              motivo: `Surtido del pedido ${pedido.folio}`, pedidoId: pedido.id, usuarioId: admin.id,
              fecha: horasAtras(e.historial.at(-1).horas),
            }, { transaction });
          }
        }
      });
    }
  }

  console.log('Datos de demostración cargados.');
  console.log('Almacén: admin@sedecafe.com / Admin123!');
  console.log('Empleados: empleado1@sedecafe.com y empleado2@sedecafe.com / Empleado123!');
}

main()
  .catch((e) => {
    console.error('Error al cargar datos:', e.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
