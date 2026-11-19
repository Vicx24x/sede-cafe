// Conexión a PostgreSQL y modelo de datos (ORM: Sequelize)
const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config');

const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true, // columnas en snake_case: stock_actual, created_at...
    freezeTableName: true,
  },
});

const ROLES = ['ADMIN', 'ALMACEN', 'EMPLEADO'];
const TIPOS_PRODUCTO = ['PRODUCTO', 'INSUMO', 'MATERIAL'];
const ESTADOS_PEDIDO = ['PENDIENTE', 'EN_PROCESO', 'ATENDIDO', 'RECHAZADO'];
const TIPOS_MOVIMIENTO = ['ENTRADA', 'SALIDA', 'AJUSTE'];

const Sucursal = sequelize.define('Sucursal', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  direccion: { type: DataTypes.STRING(200) },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'sucursales', updatedAt: false });

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  rol: { type: DataTypes.ENUM(...ROLES), allowNull: false, defaultValue: 'EMPLEADO' },
  area: { type: DataTypes.STRING(80) },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'usuarios',
  defaultScope: { attributes: { exclude: ['passwordHash'] } },
  scopes: { conPassword: { attributes: { include: ['passwordHash'] } } },
});

const Categoria = sequelize.define('Categoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  descripcion: { type: DataTypes.STRING(200) },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'categorias', updatedAt: false });

const Producto = sequelize.define('Producto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
  descripcion: { type: DataTypes.STRING(300) },
  tipo: { type: DataTypes.ENUM(...TIPOS_PRODUCTO), allowNull: false, defaultValue: 'INSUMO' },
  unidadMedida: { type: DataTypes.STRING(20), allowNull: false },
  stockActual: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  stockMinimo: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  disponible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, // se puede pedir
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }, // baja lógica
}, { tableName: 'productos' });

const Pedido = sequelize.define('Pedido', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  estado: { type: DataTypes.ENUM(...ESTADOS_PEDIDO), allowNull: false, defaultValue: 'PENDIENTE' },
  area: { type: DataTypes.STRING(80) },
  observaciones: { type: DataTypes.STRING(500) },
  motivoRechazo: { type: DataTypes.STRING(300) },
  fechaAtencion: { type: DataTypes.DATE },
}, { tableName: 'pedidos', indexes: [{ fields: ['estado'] }] });

const DetallePedido = sequelize.define('DetallePedido', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cantidad: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, {
  tableName: 'detalle_pedidos',
  timestamps: false,
  indexes: [{ unique: true, fields: ['pedido_id', 'producto_id'] }],
});

const HistorialEstado = sequelize.define('HistorialEstado', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  estadoAnterior: { type: DataTypes.ENUM(...ESTADOS_PEDIDO) },
  estadoNuevo: { type: DataTypes.ENUM(...ESTADOS_PEDIDO), allowNull: false },
  comentario: { type: DataTypes.STRING(300) },
}, { tableName: 'historial_estados_pedido', createdAt: 'fecha', updatedAt: false });

const Movimiento = sequelize.define('Movimiento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo: { type: DataTypes.ENUM(...TIPOS_MOVIMIENTO), allowNull: false },
  cantidad: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stockFinal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  motivo: { type: DataTypes.STRING(200) },
}, { tableName: 'movimientos_inventario', createdAt: 'fecha', updatedAt: false });

// ---------- Relaciones ----------
Sucursal.hasMany(Usuario, { foreignKey: 'sucursalId', as: 'usuarios' });
Usuario.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });

Categoria.hasMany(Producto, { foreignKey: { name: 'categoriaId', allowNull: false }, as: 'productos' });
Producto.belongsTo(Categoria, { foreignKey: { name: 'categoriaId', allowNull: false }, as: 'categoria' });

Usuario.hasMany(Pedido, { foreignKey: { name: 'solicitanteId', allowNull: false }, as: 'pedidosSolicitados' });
Pedido.belongsTo(Usuario, { foreignKey: { name: 'solicitanteId', allowNull: false }, as: 'solicitante' });
Pedido.belongsTo(Usuario, { foreignKey: 'atendidoPorId', as: 'atendidoPor' });
Pedido.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });
Sucursal.hasMany(Pedido, { foreignKey: 'sucursalId', as: 'pedidos' });

Pedido.hasMany(DetallePedido, { foreignKey: { name: 'pedidoId', allowNull: false }, as: 'detalles', onDelete: 'CASCADE' });
DetallePedido.belongsTo(Pedido, { foreignKey: { name: 'pedidoId', allowNull: false }, as: 'pedido' });
DetallePedido.belongsTo(Producto, { foreignKey: { name: 'productoId', allowNull: false }, as: 'producto' });
Producto.hasMany(DetallePedido, { foreignKey: { name: 'productoId', allowNull: false }, as: 'detalles' });

Pedido.hasMany(HistorialEstado, { foreignKey: { name: 'pedidoId', allowNull: false }, as: 'historial', onDelete: 'CASCADE' });
HistorialEstado.belongsTo(Pedido, { foreignKey: { name: 'pedidoId', allowNull: false }, as: 'pedido' });
HistorialEstado.belongsTo(Usuario, { foreignKey: { name: 'usuarioId', allowNull: false }, as: 'usuario' });

Producto.hasMany(Movimiento, { foreignKey: { name: 'productoId', allowNull: false }, as: 'movimientos' });
Movimiento.belongsTo(Producto, { foreignKey: { name: 'productoId', allowNull: false }, as: 'producto' });
Movimiento.belongsTo(Pedido, { foreignKey: 'pedidoId', as: 'pedido' });
Movimiento.belongsTo(Usuario, { foreignKey: { name: 'usuarioId', allowNull: false }, as: 'usuario' });

module.exports = {
  sequelize,
  Sucursal, Usuario, Categoria, Producto, Pedido, DetallePedido, HistorialEstado, Movimiento,
  ROLES, TIPOS_PRODUCTO, ESTADOS_PEDIDO, TIPOS_MOVIMIENTO,
};
