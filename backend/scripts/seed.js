// Datos de demostración: npm run db:seed
// Es seguro ejecutarlo varias veces (no duplica registros).
const bcrypt = require('bcryptjs');
const { sequelize, Sucursal, Usuario, Categoria, Producto, Movimiento } = require('../src/db');

async function main() {
  await sequelize.sync();
  const passwordHash = await bcrypt.hash('SedeCafe2026', 10);

  const sucursales = {};
  for (const s of [
    { nombre: 'Almacén Central', direccion: 'Matriz' },
    { nombre: 'Sucursal Centro', direccion: 'Centro, CDMX' },
    { nombre: 'Sucursal Norte', direccion: 'Zona Norte, CDMX' },
  ]) {
    const [suc] = await Sucursal.findOrCreate({ where: { nombre: s.nombre }, defaults: s });
    sucursales[s.nombre] = suc.id;
  }

  for (const u of [
    { nombre: 'Administrador General', email: 'admin@sedecafe.com', rol: 'ADMIN', area: 'Administración', sucursal: 'Almacén Central' },
    { nombre: 'Encargado de Almacén', email: 'almacen@sedecafe.com', rol: 'ALMACEN', area: 'Almacén', sucursal: 'Almacén Central' },
    { nombre: 'Barista Centro', email: 'centro@sedecafe.com', rol: 'EMPLEADO', area: 'Barra', sucursal: 'Sucursal Centro' },
    { nombre: 'Cocina Norte', email: 'norte@sedecafe.com', rol: 'EMPLEADO', area: 'Cocina', sucursal: 'Sucursal Norte' },
  ]) {
    const { sucursal, ...datos } = u;
    await Usuario.findOrCreate({
      where: { email: u.email },
      defaults: { ...datos, passwordHash, sucursalId: sucursales[sucursal] },
    });
  }

  const categorias = {};
  for (const c of [
    { nombre: 'Café y té', descripcion: 'Granos, molidos y tés' },
    { nombre: 'Lácteos', descripcion: 'Leches y cremas' },
    { nombre: 'Panadería', descripcion: 'Pan y repostería' },
    { nombre: 'Desechables', descripcion: 'Vasos, tapas, popotes, servilletas' },
    { nombre: 'Limpieza', descripcion: 'Material de limpieza' },
  ]) {
    const [cat] = await Categoria.findOrCreate({ where: { nombre: c.nombre }, defaults: c });
    categorias[c.nombre] = cat.id;
  }

  const admin = await Usuario.findOne({ where: { email: 'admin@sedecafe.com' } });
  const productos = [
    ['CAF-001', 'Café en grano tostado medio', 'INSUMO', 'kg', 25, 10, 'Café y té'],
    ['CAF-002', 'Café descafeinado molido', 'INSUMO', 'kg', 6, 3, 'Café y té'],
    ['TE-001', 'Té chai concentrado', 'INSUMO', 'l', 4, 5, 'Café y té'],
    ['LAC-001', 'Leche entera', 'INSUMO', 'l', 60, 20, 'Lácteos'],
    ['LAC-002', 'Leche de almendra', 'INSUMO', 'l', 12, 8, 'Lácteos'],
    ['PAN-001', 'Croissant de mantequilla', 'PRODUCTO', 'pza', 40, 15, 'Panadería'],
    ['PAN-002', 'Muffin de arándano', 'PRODUCTO', 'pza', 10, 12, 'Panadería'],
    ['DES-001', 'Vaso térmico 12 oz', 'MATERIAL', 'pza', 500, 200, 'Desechables'],
    ['DES-002', 'Tapa para vaso 12 oz', 'MATERIAL', 'pza', 450, 200, 'Desechables'],
    ['LIM-001', 'Desengrasante multiusos', 'MATERIAL', 'l', 8, 4, 'Limpieza'],
  ];
  for (const [codigo, nombre, tipo, unidadMedida, stock, minimo, cat] of productos) {
    if (await Producto.findOne({ where: { codigo } })) continue;
    const p = await Producto.create({
      codigo, nombre, tipo, unidadMedida, stockActual: stock, stockMinimo: minimo, categoriaId: categorias[cat],
    });
    await Movimiento.create({
      productoId: p.id, tipo: 'ENTRADA', cantidad: stock, stockFinal: stock, motivo: 'Existencia inicial', usuarioId: admin.id,
    });
  }

  console.log('Datos de demostración cargados.');
  console.log('Usuarios (contraseña SedeCafe2026): admin@sedecafe.com, almacen@sedecafe.com, centro@sedecafe.com, norte@sedecafe.com');
}

main()
  .catch((e) => {
    console.error('Error al cargar datos:', e.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
