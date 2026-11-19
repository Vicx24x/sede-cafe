import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ChevronRight, CirclePlay, Package } from 'lucide-react';
import { api, mensajeError } from '../../api';
import { useAvisos } from '../../context/AvisosContext';
import { ESTADOS, cantidad, fecha, plural } from '../../lib/formato';
import { Cargando, Encabezado, ErrorCaja, EstadoBadge, Modal, PuntoEstado, Seguimiento } from '../../components/ui';

const TITULOS = {
  PENDIENTE: 'Pedidos pendientes',
  EN_PROCESO: 'Pedidos en proceso',
  ATENDIDO: 'Pedidos atendidos',
  RECHAZADO: 'Pedidos rechazados',
  TODOS: 'Todos los pedidos',
};

export default function Pedidos() {
  const avisar = useAvisos();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const filtro = params.get('estado') || 'PENDIENTE';
  const [resumen, setResumen] = useState(null);
  const [pedidos, setPedidos] = useState(null);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [error, setError] = useState('');
  const [atender, setAtender] = useState(null); // pedido a confirmar
  const [rechazar, setRechazar] = useState(null); // { pedido, motivo }
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const estado = filtro === 'TODOS' ? '' : `?estado=${filtro}`;
      const [r, p] = await Promise.all([api.get('/dashboard'), api.get(`/pedidos${estado}`)]);
      setResumen(r);
      setPedidos(p);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [filtro]);

  useEffect(() => {
    setPedidos(null);
    cargar();
  }, [cargar]);

  const elegir = (estado) => setParams(estado === 'PENDIENTE' ? {} : { estado });
  const alternar = (id) => setAbiertos((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  async function cambiarEstado(pedido, estado, comentario) {
    setProcesando(true);
    try {
      await api.patch(`/pedidos/${pedido.id}/estado`, { estado, comentario });
      const textos = {
        EN_PROCESO: `${pedido.folio} recepcionado: ahora está en proceso`,
        ATENDIDO: `${pedido.folio} atendido: el stock se descontó`,
        RECHAZADO: `${pedido.folio} rechazado`,
      };
      avisar(textos[estado]);
      setAtender(null);
      setRechazar(null);
      await cargar();
    } catch (e) {
      avisar(mensajeError(e), 'error');
      await cargar();
    } finally {
      setProcesando(false);
    }
  }

  function acciones(pedido, completo = false) {
    if (pedido.estado === 'PENDIENTE') {
      return (
        <div className="flex items-center justify-end gap-3">
          <button type="button" className="btn-secundario btn-chico" disabled={procesando} onClick={() => cambiarEstado(pedido, 'EN_PROCESO')}>
            <CirclePlay className="size-3.5" /> Recepcionar
          </button>
          <button type="button" className="enlace-peligro text-xs" onClick={() => setRechazar({ pedido, motivo: '' })}>Rechazar</button>
        </div>
      );
    }
    if (pedido.estado === 'EN_PROCESO') {
      return (
        <div className="flex items-center justify-end gap-3">
          <button type="button" className="btn-primario btn-chico" disabled={procesando} onClick={() => setAtender(pedido)}>
            <Package className="size-3.5" /> Marcar atendido
          </button>
          <button type="button" className="enlace-peligro text-xs" onClick={() => setRechazar({ pedido, motivo: '' })}>Rechazar</button>
        </div>
      );
    }
    return completo ? null : <span />;
  }

  const celdas = [
    ...Object.keys(ESTADOS).map((estado) => ({ clave: estado, numero: resumen?.pedidos[estado], estado })),
    { clave: 'STOCK', numero: resumen?.productosBajoStock, etiqueta: 'Productos con stock bajo' },
  ];

  return (
    <>
      <Encabezado titulo="Pedidos internos" descripcion="Recibe las solicitudes de las sucursales, prepáralas y márcalas como atendidas." />
      <ErrorCaja>{error}</ErrorCaja>

      {/* Franja de resumen: también funciona como filtro */}
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 md:grid-cols-5">
        {celdas.map((c) => {
          const activo = c.clave === filtro;
          const esStock = c.clave === 'STOCK';
          return (
            <button
              key={c.clave}
              type="button"
              aria-pressed={activo}
              onClick={() => (esStock ? navegar('/inventario?bajoStock=true') : elegir(c.clave))}
              className={`px-4 py-3 text-left transition-colors ${activo ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-50'} ${esStock ? 'col-span-2 md:col-span-1' : ''}`}
            >
              <p className={`font-mono text-2xl font-semibold ${esStock && c.numero > 0 ? 'text-rose-700' : ''}`}>{c.numero ?? '–'}</p>
              <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${activo ? 'text-neutral-200' : 'text-neutral-600'}`}>
                {c.estado && <PuntoEstado estado={c.estado} />}
                {c.estado ? ESTADOS[c.estado].etiqueta : c.etiqueta}
              </p>
            </button>
          );
        })}
      </div>

      <section className="tarjeta overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-semibold">{TITULOS[filtro] || TITULOS.TODOS}</h2>
          {filtro !== 'TODOS' && (
            <button type="button" className="text-xs font-medium text-neutral-600 hover:text-neutral-900" onClick={() => elegir('TODOS')}>Ver todos</button>
          )}
        </div>

        {!pedidos ? <Cargando /> : pedidos.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-neutral-400">
            {filtro === 'TODOS' ? 'Todavía no hay pedidos.' : `No hay pedidos ${ESTADOS[filtro]?.plural ?? ''}.`}
          </p>
        ) : (
          <>
            {/* Escritorio: tabla */}
            <table className="hidden w-full text-left md:table">
              <thead>
                <tr className="encabezado-tabla border-b border-neutral-100">
                  <th className="w-10 py-2" />
                  <th className="py-2 pr-4 font-medium">Pedido</th>
                  <th className="py-2 pr-4 font-medium">Solicitante</th>
                  <th className="py-2 pr-4 font-medium">Fecha</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const abierto = abiertos.has(p.id);
                  return (
                    <Fragment key={p.id}>
                      <tr className={`border-b border-neutral-100 text-[13px] last:border-0 ${abierto ? 'bg-neutral-50' : ''}`}>
                        <td className="py-2.5 pl-3">
                          <button type="button" className="btn-icono size-7" onClick={() => alternar(p.id)} aria-expanded={abierto} aria-label={`Detalle de ${p.folio}`}>
                            <ChevronRight className={`size-4 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                          </button>
                        </td>
                        <td className="py-2.5 pr-4">
                          <p className="font-medium">{p.folio}</p>
                          <p className="text-[11px] text-neutral-500">{plural(p.detalles.length, 'producto')}</p>
                        </td>
                        <td className="py-2.5 pr-4">
                          <p>{p.solicitante.nombre}</p>
                          <p className="text-[11px] text-neutral-500">{p.sucursal?.nombre || p.solicitante.area || '—'}</p>
                        </td>
                        <td className="py-2.5 pr-4 text-xs whitespace-nowrap text-neutral-700">{fecha(p.createdAt)}</td>
                        <td className="py-2.5 pr-4"><EstadoBadge estado={p.estado} /></td>
                        <td className="py-2.5 pr-4">{acciones(p)}</td>
                      </tr>
                      {abierto && (
                        <tr className="border-b border-neutral-100 last:border-0">
                          <td colSpan={6} className="px-4 pt-2 pb-5"><DetallePedido pedido={p} /></td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Celular: tarjetas */}
            <ul className="divide-y divide-neutral-100 md:hidden">
              {pedidos.map((p) => {
                const abierto = abiertos.has(p.id);
                return (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold">{p.folio}</p>
                        <p className="text-xs text-neutral-700">{p.solicitante.nombre} · {p.sucursal?.nombre || p.solicitante.area || '—'}</p>
                        <p className="text-[11px] text-neutral-500">{fecha(p.createdAt)} · {plural(p.detalles.length, 'producto')}</p>
                      </div>
                      <EstadoBadge estado={p.estado} />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      {acciones(p, true)}
                      <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-600" onClick={() => alternar(p.id)} aria-expanded={abierto}>
                        <ChevronRight className={`size-3.5 transition-transform ${abierto ? 'rotate-90' : ''}`} /> Detalle
                      </button>
                    </div>
                    {abierto && <div className="mt-3"><DetallePedido pedido={p} /></div>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Confirmación: marcar atendido descuenta el inventario */}
      <Modal abierto={!!atender} titulo={`Marcar ${atender?.folio ?? ''} como atendido`} onCerrar={() => setAtender(null)}>
        {atender && <ConfirmarAtendido pedido={atender} procesando={procesando} onCancelar={() => setAtender(null)} onConfirmar={() => cambiarEstado(atender, 'ATENDIDO')} />}
      </Modal>

      {/* Rechazo con motivo obligatorio */}
      <Modal abierto={!!rechazar} titulo={`Rechazar ${rechazar?.pedido.folio ?? ''}`} onCerrar={() => setRechazar(null)}>
        {rechazar && (
          <form onSubmit={(e) => { e.preventDefault(); cambiarEstado(rechazar.pedido, 'RECHAZADO', rechazar.motivo.trim()); }}>
            <label className="etiqueta" htmlFor="motivo">Motivo del rechazo</label>
            <textarea
              id="motivo"
              rows="3"
              maxLength={300}
              className="campo resize-y"
              value={rechazar.motivo}
              onChange={(e) => setRechazar({ ...rechazar, motivo: e.target.value })}
              required
              autoFocus
            />
            <p className="ayuda">El empleado verá este motivo en su historial.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secundario" onClick={() => setRechazar(null)}>Cancelar</button>
              <button type="submit" className="btn-peligro" disabled={procesando || !rechazar.motivo.trim()}>Rechazar pedido</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

function DetallePedido({ pedido }) {
  const abierto = pedido.estado === 'PENDIENTE' || pedido.estado === 'EN_PROCESO';
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div>
        <h3 className="mb-2 text-xs font-semibold">Productos solicitados</h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="encabezado-tabla">
              <th className="pb-1.5 font-medium">Producto</th>
              <th className="pb-1.5 text-right font-medium">Solicitado</th>
              {abierto && <th className="pb-1.5 pl-4 text-right font-medium">En almacén</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {pedido.detalles.map((d) => {
              const falta = Number(d.producto.stockActual) < Number(d.cantidad);
              return (
                <tr key={d.id}>
                  <td className="py-1.5 pr-3">{d.producto.nombre}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">{cantidad(d.cantidad, d.producto.unidadMedida)}</td>
                  {abierto && (
                    <td className={`py-1.5 pl-4 text-right whitespace-nowrap ${falta ? 'font-medium text-rose-700' : 'text-neutral-500'}`}>
                      {cantidad(d.producto.stockActual, d.producto.unidadMedida)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {pedido.observaciones && (
          <p className="mt-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
            Nota del solicitante: {pedido.observaciones}
          </p>
        )}
        {pedido.estado === 'RECHAZADO' && pedido.motivoRechazo && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <span className="font-semibold">Motivo del rechazo:</span> {pedido.motivoRechazo}
          </p>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold">Seguimiento</h3>
        <Seguimiento historial={pedido.historial} />
      </div>
    </div>
  );
}

function ConfirmarAtendido({ pedido, procesando, onCancelar, onConfirmar }) {
  const faltantes = pedido.detalles.filter((d) => Number(d.producto.stockActual) < Number(d.cantidad));
  return (
    <>
      <p className="mb-3 text-[13px] text-neutral-600">Al confirmar, se descuenta del inventario lo siguiente:</p>
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 text-xs">
        {pedido.detalles.map((d) => {
          const falta = Number(d.producto.stockActual) < Number(d.cantidad);
          return (
            <li key={d.id} className="flex justify-between gap-3 px-3 py-2">
              <span>{d.producto.nombre}</span>
              <span className="shrink-0 whitespace-nowrap">
                −{cantidad(d.cantidad, d.producto.unidadMedida)}{' '}
                <span className={falta ? 'font-medium text-rose-700' : 'text-neutral-400'}>(hay {Number(d.producto.stockActual).toLocaleString('es-MX')})</span>
              </span>
            </li>
          );
        })}
      </ul>
      {faltantes.length > 0 && (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">
          No hay existencia suficiente de {faltantes.map((d) => d.producto.nombre).join(', ')}. Registra la entrada en Inventario o rechaza el pedido.
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secundario" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="btn-primario" disabled={procesando || faltantes.length > 0} onClick={onConfirmar}>
          {procesando ? 'Descontando…' : 'Confirmar y descontar stock'}
        </button>
      </div>
    </>
  );
}
