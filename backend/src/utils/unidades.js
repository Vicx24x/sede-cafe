// Unidades de medida permitidas (lista cerrada) y formato "24 bolsas", "14 L"
const UNIDADES = ['kilogramo', 'gramo', 'litro', 'mililitro', 'pieza', 'paquete', 'caja', 'bolsa', 'botella'];

const ABREVIADAS = { kilogramo: 'kg', gramo: 'g', litro: 'L', mililitro: 'mL' };

function formatoCantidad(cantidad, unidad) {
  const n = Number(cantidad);
  const texto = n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  if (ABREVIADAS[unidad]) return `${texto} ${ABREVIADAS[unidad]}`;
  return `${texto} ${n === 1 ? unidad : `${unidad}s`}`;
}

module.exports = { UNIDADES, formatoCantidad };
