import { useEffect } from 'react';

export const ETIQUETA_ESTADO = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  ATENDIDO: 'Atendido',
  RECHAZADO: 'Rechazado',
};

const COLOR_ESTADO = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  EN_PROCESO: 'bg-sky-100 text-sky-800',
  ATENDIDO: 'bg-emerald-100 text-emerald-800',
  RECHAZADO: 'bg-red-100 text-red-700',
};

export const ETIQUETA_ROL = { ADMIN: 'Administración', ALMACEN: 'Almacén', EMPLEADO: 'Empleado / Sucursal' };
export const ETIQUETA_TIPO = { PRODUCTO: 'Producto', INSUMO: 'Insumo', MATERIAL: 'Material' };

export function EstadoBadge({ estado }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

export function Badge({ children, color = 'bg-stone-100 text-stone-700' }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{children}</span>;
}

export function Encabezado({ titulo, descripcion, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-stone-500">{descripcion}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Alerta({ tipo = 'error', children, onCerrar }) {
  if (!children) return null;
  const estilos = tipo === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${estilos}`}>
      <span>{children}</span>
      {onCerrar && <button type="button" onClick={onCerrar} className="font-bold opacity-60 hover:opacity-100">×</button>}
    </div>
  );
}

export function Modal({ abierto, titulo, onCerrar, children, ancho = 'max-w-lg' }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const alPresionar = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16" onMouseDown={onCerrar}>
      <div className={`card w-full ${ancho} p-6`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="text-2xl leading-none text-stone-400 hover:text-stone-600">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Vacio({ children }) {
  return <p className="px-3 py-10 text-center text-sm text-stone-400">{children}</p>;
}

export function Cargando() {
  return <p className="px-3 py-10 text-center text-sm text-stone-400">Cargando…</p>;
}

export const formatoFecha = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const formatoNumero = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
