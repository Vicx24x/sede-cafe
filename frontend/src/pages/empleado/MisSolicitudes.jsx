import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Minus, Plus, RefreshCw, Search, Send, Trash2 } from 'lucide-react';
import { api, mensajeError } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useAvisos } from '../../context/AvisosContext';
import { cantidad, fecha, plural } from '../../lib/formato';
import { Cargando, ErrorCaja, EstadoBadge, Seguimiento, Vacio } from '../../components/ui';

const DESCRIPCION_ESTADO = {
  PENDIENTE: 'Esperando a que el almacén la reciba.',
  EN_PROCESO: 'El almacén está preparando tu pedido.',
  ATENDIDO: 'Entregada. El stock ya fue descontado.',
  RECHAZADO: 'El almacén no pudo surtir esta solicitud.',
};

export default function MisSolicitudes() {
  const { usuario } = useAuth();
  const avisar = useAvisos();
  const [catalogo, setCatalogo] = useState(null);
  const [solicitudes, setSolicitudes] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [renglones, setRenglones] = useState([]); // [{ producto, cantidad }]
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');

  const cargarCatalogo = useCallback(
    () => api.get('/productos?soloDisponibles=true').then(setCatalogo).catch((e) => setError(mensajeError(e))),
    [],
  );
  const cargarSolicitudes = useCallback(
    () => api.get('/pedidos').then(setSolicitudes).catch((e) => setError(mensajeError(e))),
    [],
  );

  useEffect(() => {
    cargarCatalogo();
    cargarSolicitudes();
  }, [cargarCatalogo, cargarSolicitudes]);

  async function actualizar() {
    setActualizando(true);
    await Promise.all([cargarCatalogo(), cargarSolicitudes()]);
    setActualizando(false);
  }

  const categorias = useMemo(
    () => [...new Set((catalogo || []).map((p) => p.categoria?.nombre).filter(Boolean))].sort(),
    [catalogo],
  );

  const filtrados = useMemo(() => {
    if (!catalogo) return [];
    const t = busqueda.trim().toLowerCase();
    return catalogo.filter((p) => (!categoria || p.categoria?.nombre === categoria)
      && (!t || p.nombre.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t)));
  }, [catalogo, busqueda, categoria]);

  const elegidos = new Set(renglones.map((r) => r.producto.id));
  const abiertas = (solicitudes || []).filter((s) => s.estado === 'PENDIENTE' || s.estado === 'EN_PROCESO').length;

  function errorRenglon({ producto, cantidad: valor }) {
    const n = Number(valor);
    if (valor === '' || !Number.isInteger(n) || n < 1) return 'La cantidad mínima es 1';
    if (n > Number(producto.stockActual)) return `Solo hay ${cantidad(producto.stockActual, producto.unidadMedida)} en existencia`;
    return '';
  }
  const hayErrores = renglones.some((r) => errorRenglon(r));

  const agregar = (producto) => setRenglones([...renglones, { producto, cantidad: 1 }]);
  const quitar = (id) => setRenglones(renglones.filter((r) => r.producto.id !== id));
  const fijar = (id, valor) => setRenglones(renglones.map((r) => (r.producto.id === id ? { ...r, cantidad: valor } : r)));
  const sumar = (id, delta) => setRenglones(renglones.map((r) => (
    r.producto.id === id ? { ...r, cantidad: Math.max(1, (Number(r.cantidad) || 0) + delta) } : r
  )));

  async function enviar() {
    setError('');
    setEnviando(true);
    try {
      await api.post('/pedidos', {
        observaciones: nota.trim() || null,
        productos: renglones.map((r) => ({ productoId: r.producto.id, cantidad: Number(r.cantidad) })),
      });
      setRenglones([]);
      setNota('');
      avisar('Solicitud enviada. El almacén la revisará en breve.');
      await Promise.all([cargarCatalogo(), cargarSolicitudes()]);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {usuario.nombre.split(' ')[0]}</h1>
        <p className="mt-0.5 text-[13px] text-neutral-500">
          {solicitudes === null ? ' ' : abiertas
            ? `Tienes ${plural(abiertas, 'solicitud abierta', 'solicitudes abiertas')}.`
            : 'No tienes solicitudes abiertas.'}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Nueva solicitud */}
        <section className="tarjeta">
          <div className="p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold">1. Elige lo que necesitas</h2>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
                <input className="campo pl-9" placeholder="Buscar producto o código" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </label>
              <select className="campo sm:w-48" value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría">
                <option value="">Todas las categorías</option>
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="max-h-[19rem] overflow-y-auto rounded-lg border border-neutral-200">
              {!catalogo ? <Cargando /> : filtrados.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-neutral-400">No hay productos que coincidan.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {filtrados.map((p) => {
                    const agotado = Number(p.stockActual) <= 0;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{p.nombre}</p>
                          <p className="text-[11px] text-neutral-500">
                            {p.categoria?.nombre} · Disponible: {cantidad(p.stockActual, p.unidadMedida)}
                          </p>
                        </div>
                        {elegidos.has(p.id) ? (
                          <span className="inline-flex h-8 items-center gap-1 px-3 text-xs text-neutral-400"><Check className="size-3.5" /> Agregado</span>
                        ) : agotado ? (
                          <span className="inline-flex h-8 items-center px-3 text-xs text-neutral-400">Sin existencia</span>
                        ) : (
                          <button type="button" className="btn-secundario btn-chico" onClick={() => agregar(p)}>
                            <Plus className="size-3.5" /> Agregar
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="border-t border-neutral-200 p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold">2. Revisa tu solicitud</h2>
            {renglones.length === 0 ? (
              <Vacio className="mb-4">Aún no agregas productos. Elígelos de la lista de arriba.</Vacio>
            ) : (
              <ul className="mb-4 divide-y divide-neutral-100">
                {renglones.map((r) => {
                  const problema = errorRenglon(r);
                  return (
                    <li key={r.producto.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0 pt-1">
                        <p className="text-[13px] font-medium">{r.producto.nombre}</p>
                        <p className="text-[11px] text-neutral-500">Disponible: {cantidad(r.producto.stockActual, r.producto.unidadMedida)}</p>
                        {problema && <p className="mt-0.5 text-xs text-rose-700">{problema}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" className="btn-icono" onClick={() => sumar(r.producto.id, -1)} aria-label="Quitar uno"><Minus className="size-3.5" /></button>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          aria-label={`Cantidad de ${r.producto.nombre}`}
                          className={`campo h-9 w-16 px-2 text-center ${problema ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-600' : ''}`}
                          value={r.cantidad}
                          onChange={(e) => fijar(r.producto.id, e.target.value)}
                        />
                        <button type="button" className="btn-icono" onClick={() => sumar(r.producto.id, 1)} aria-label="Agregar uno"><Plus className="size-3.5" /></button>
                        <button type="button" className="btn-icono hover:text-rose-700" onClick={() => quitar(r.producto.id)} aria-label={`Quitar ${r.producto.nombre}`}><Trash2 className="size-3.5" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <label className="etiqueta" htmlFor="nota">Nota para el almacén <span className="font-normal text-neutral-400">(opcional)</span></label>
            <textarea id="nota" rows="2" maxLength={500} className="campo mb-4 resize-y" placeholder="Ej. Lo necesitamos antes del turno de la tarde" value={nota} onChange={(e) => setNota(e.target.value)} />
            <ErrorCaja>{error}</ErrorCaja>
            <button type="button" className="btn-primario" onClick={enviar} disabled={enviando || renglones.length === 0 || hayErrores}>
              <Send className="size-3.5" /> {enviando ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </section>

        {/* Historial propio */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Mis solicitudes</h2>
            <button type="button" onClick={actualizar} className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900">
              <RefreshCw className={`size-3.5 ${actualizando ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>
          {!solicitudes ? <Cargando /> : solicitudes.length === 0 ? (
            <Vacio>Todavía no has hecho solicitudes.</Vacio>
          ) : (
            <div className="space-y-3">
              {solicitudes.map((s) => <TarjetaSolicitud key={s.id} solicitud={s} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function TarjetaSolicitud({ solicitud: s }) {
  return (
    <article className="tarjeta p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold">{s.folio}</p>
          <p className="text-[11px] text-neutral-500">{fecha(s.createdAt)}</p>
        </div>
        <EstadoBadge estado={s.estado} />
      </div>
      <p className="mt-2 text-xs text-neutral-600">{DESCRIPCION_ESTADO[s.estado]}</p>
      <ul className="mt-2.5 space-y-1">
        {s.detalles.map((d) => (
          <li key={d.id} className="flex justify-between gap-3 text-xs">
            <span className="text-neutral-800">{d.producto.nombre}</span>
            <span className="shrink-0 text-neutral-500">{cantidad(d.cantidad, d.producto.unidadMedida)}</span>
          </li>
        ))}
      </ul>
      {s.observaciones && (
        <p className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">Tu nota: {s.observaciones}</p>
      )}
      {s.estado === 'RECHAZADO' && s.motivoRechazo && (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span className="font-semibold">Motivo del rechazo:</span> {s.motivoRechazo}
        </p>
      )}
      <details className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" /> Ver seguimiento
        </summary>
        <div className="mt-3">
          <Seguimiento historial={s.historial} />
        </div>
      </details>
    </article>
  );
}
