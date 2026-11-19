// Utilidades de formato compartidas por todas las pantallas

export const UNIDADES = [
  { valor: 'kilogramo', etiqueta: 'Kilogramo' },
  { valor: 'gramo', etiqueta: 'Gramo' },
  { valor: 'litro', etiqueta: 'Litro' },
  { valor: 'mililitro', etiqueta: 'Mililitro' },
  { valor: 'pieza', etiqueta: 'Pieza' },
  { valor: 'paquete', etiqueta: 'Paquete' },
  { valor: 'caja', etiqueta: 'Caja' },
  { valor: 'bolsa', etiqueta: 'Bolsa' },
  { valor: 'botella', etiqueta: 'Botella' },
];

const ABREVIADAS = { kilogramo: 'kg', gramo: 'g', litro: 'L', mililitro: 'mL' };

// 24 + "bolsa" -> "24 bolsas" · 14 + "litro" -> "14 L"
export function cantidad(n, unidad) {
  const num = Number(n);
  const texto = num.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  if (ABREVIADAS[unidad]) return `${texto} ${ABREVIADAS[unidad]}`;
  if (!unidad) return texto;
  return `${texto} ${num === 1 ? unidad : `${unidad}s`}`;
}

// "10 nov 2026, 11:39 p.m."
export function fecha(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function iniciales(nombre = '') {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function plural(n, singular, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

export const ESTADOS = {
  PENDIENTE: { etiqueta: 'Pendiente', punto: 'bg-amber-500', plural: 'pendientes' },
  EN_PROCESO: { etiqueta: 'En proceso', punto: 'bg-sky-500', plural: 'en proceso' },
  ATENDIDO: { etiqueta: 'Atendido', punto: 'bg-emerald-500', plural: 'atendidos' },
  RECHAZADO: { etiqueta: 'Rechazado', punto: 'bg-rose-600', plural: 'rechazados' },
};

export const esAlmacen = (usuario) => usuario?.rol === 'ADMIN' || usuario?.rol === 'ALMACEN';

// Texto bajo el nombre del usuario: su sucursal o su área
export const subtituloUsuario = (usuario) => usuario?.sucursal?.nombre || usuario?.area || '';
