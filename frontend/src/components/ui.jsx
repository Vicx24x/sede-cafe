import { useEffect } from 'react';
import { Coffee, X } from 'lucide-react';
import { ESTADOS, fecha } from '../lib/formato';

export function Logo({ claro = false }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
      <span className={`flex size-7 items-center justify-center rounded-md ${claro ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'}`}>
        <Coffee className="size-4" strokeWidth={2.2} />
      </span>
      Sede Café
    </span>
  );
}

export function PuntoEstado({ estado, className = '' }) {
  return <span className={`inline-block size-1.5 shrink-0 rounded-full ${ESTADOS[estado].punto} ${className}`} />;
}

export function EstadoBadge({ estado }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700">
      <PuntoEstado estado={estado} />
      {ESTADOS[estado].etiqueta}
    </span>
  );
}

// Bitácora de estados como línea de tiempo
export function Seguimiento({ historial }) {
  return (
    <ol className="relative ml-1 space-y-3 border-l border-neutral-200 pl-4">
      {historial.map((h) => (
        <li key={h.id} className="relative">
          <span className={`absolute top-1 -left-[21px] size-2.5 rounded-full ring-2 ring-white ${ESTADOS[h.estadoNuevo].punto}`} />
          <p className="text-[13px] font-medium text-neutral-900">{ESTADOS[h.estadoNuevo].etiqueta}</p>
          <p className="text-[11px] text-neutral-500">{fecha(h.fecha)}</p>
          {h.comentario && <p className="mt-0.5 text-xs text-neutral-700">{h.comentario}</p>}
          {h.usuario && <p className="text-[11px] text-neutral-500">Por {h.usuario.nombre}</p>}
        </li>
      ))}
    </ol>
  );
}

export function Modal({ abierto, titulo, onCerrar, children, ancho = 'max-w-md' }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const alPresionar = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/50 p-4 pt-[12vh]" onMouseDown={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`w-full ${ancho} rounded-xl bg-white p-5 shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-[15px] font-semibold text-neutral-900">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="btn-icono -mr-1.5" aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Encabezado({ titulo, descripcion, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{titulo}</h1>
        {descripcion && <p className="mt-0.5 text-[13px] text-neutral-500">{descripcion}</p>}
      </div>
      {children}
    </div>
  );
}

export function Vacio({ children, className = '' }) {
  return <p className={`rounded-lg bg-neutral-100 px-4 py-4 text-center text-[13px] text-neutral-500 ${className}`}>{children}</p>;
}

export function Cargando() {
  return <p className="px-4 py-10 text-center text-[13px] text-neutral-400">Cargando…</p>;
}

export function ErrorCaja({ children }) {
  if (!children) return null;
  return <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-800">{children}</p>;
}
