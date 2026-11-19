import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, mensajeError } from '../api';
import { useAuth } from '../context/AuthContext';
import { Alerta, Cargando, ETIQUETA_ESTADO, Encabezado, EstadoBadge, Modal, formatoFecha, formatoNumero } from '../components/ui';

const PASOS = ['PENDIENTE', 'EN_PROCESO', 'ATENDIDO'];

export default function PedidoDetalle() {
  const { id } = useParams();
  const { usuario, esGestor } = useAuth();
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState('');
  const [rechazo, setRechazo] = useState(null); // texto del motivo
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    api.get(`/pedidos/${id}`).then(setPedido).catch((e) => setError(mensajeError(e)));
  }, [id]);

  async function ejecutar(fn) {
    setError('');
    setProcesando(true);
    try {
      setPedido(await fn());
      return true;
    } catch (e) {
      setError(mensajeError(e));
      return false;
    } finally {
      setProcesando(false);
    }
  }

  const cambiarEstado = (estado, comentario) => ejecutar(() => api.patch(`/pedidos/${id}/estado`, { estado, comentario }));

  if (!pedido) return error ? <Alerta>{error}</Alerta> : <Cargando />;

  const indice = PASOS.indexOf(pedido.estado);
  const faltaStock = pedido.detalles.some((d) => Number(d.producto.stockActual) < Number(d.cantidad));
  const abierto = ['PENDIENTE', 'EN_PROCESO'].includes(pedido.estado);

  return (
    <>
      <Encabezado titulo={`Pedido ${pedido.folio}`} descripcion={`Registrado el ${formatoFecha(pedido.createdAt)}`}>
        <Link to="/pedidos" className="btn-secondary">← Volver</Link>
        {esGestor && pedido.estado === 'PENDIENTE' && (
          <button type="button" className="btn-primary" disabled={procesando} onClick={() => cambiarEstado('EN_PROCESO', 'Pedido en preparación')}>Pasar a En proceso</button>
        )}
        {esGestor && pedido.estado === 'EN_PROCESO' && (
          <button type="button" className="btn-primary" disabled={procesando} onClick={() => window.confirm('Se descontarán las existencias del inventario. ¿Marcar como atendido?') && cambiarEstado('ATENDIDO', 'Pedido entregado')}>Marcar como Atendido</button>
        )}
        {esGestor && abierto && <button type="button" className="btn-danger" disabled={procesando} onClick={() => setRechazo('')}>Rechazar</button>}
        {!esGestor && pedido.estado === 'PENDIENTE' && pedido.solicitante.id === usuario.id && (
          <button type="button" className="btn-danger" disabled={procesando} onClick={() => window.confirm('¿Cancelar este pedido?') && ejecutar(() => api.patch(`/pedidos/${id}/cancelar`))}>Cancelar pedido</button>
        )}
      </Encabezado>

      <Alerta onCerrar={() => setError('')}>{error}</Alerta>

      <div className="card mb-6 p-5">
        {pedido.estado === 'RECHAZADO' ? (
          <div className="flex items-center gap-3">
            <EstadoBadge estado="RECHAZADO" />
            <span className="text-sm text-stone-600">Motivo: {pedido.motivoRechazo}</span>
          </div>
        ) : (
          <ol className="flex items-center">
            {PASOS.map((paso, i) => (
              <li key={paso} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${i <= indice ? 'bg-cafe-700 text-white' : 'bg-stone-200 text-stone-500'}`}>{i + 1}</span>
                  <span className={`text-sm ${i <= indice ? 'font-semibold text-cafe-800' : 'text-stone-400'}`}>{ETIQUETA_ESTADO[paso]}</span>
                </div>
                {i < PASOS.length - 1 && <div className={`mx-3 h-0.5 flex-1 ${i < indice ? 'bg-cafe-700' : 'bg-stone-200'}`} />}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card overflow-x-auto lg:col-span-2">
          <h2 className="border-b border-stone-200 px-5 py-3 font-semibold text-stone-700">Productos solicitados</h2>
          <table className="table-base">
            <thead><tr><th>Código</th><th>Producto</th><th className="text-right">Cantidad</th>{esGestor && abierto && <th className="text-right">Existencia</th>}</tr></thead>
            <tbody>
              {pedido.detalles.map((d) => {
                const insuficiente = Number(d.producto.stockActual) < Number(d.cantidad);
                return (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap font-mono text-xs">{d.producto.codigo}</td>
                    <td>{d.producto.nombre} <span className="text-xs text-stone-400">{d.producto.categoria?.nombre}</span></td>
                    <td className="text-right font-semibold">{formatoNumero(d.cantidad)} {d.producto.unidadMedida}</td>
                    {esGestor && abierto && (
                      <td className={`text-right ${insuficiente ? 'font-semibold text-red-600' : 'text-stone-500'}`}>{formatoNumero(d.producto.stockActual)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {esGestor && abierto && faltaStock && (
            <p className="px-5 py-3 text-sm text-red-600">Hay productos sin existencia suficiente. Registra una entrada en Productos o rechaza el pedido.</p>
          )}
        </section>

        <section className="space-y-6">
          <div className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold text-stone-700">Datos del pedido</h2>
            <dl className="space-y-2">
              <div><dt className="text-stone-400">Estado</dt><dd><EstadoBadge estado={pedido.estado} /></dd></div>
              <div><dt className="text-stone-400">Solicitante</dt><dd>{pedido.solicitante.nombre}</dd></div>
              <div><dt className="text-stone-400">Sucursal / área</dt><dd>{pedido.sucursal?.nombre || '—'}{pedido.area ? ` · ${pedido.area}` : ''}</dd></div>
              {pedido.observaciones && <div><dt className="text-stone-400">Observaciones</dt><dd>{pedido.observaciones}</dd></div>}
              {pedido.atendidoPor && <div><dt className="text-stone-400">Atendido por</dt><dd>{pedido.atendidoPor.nombre}</dd></div>}
              {pedido.fechaAtencion && <div><dt className="text-stone-400">Fecha de entrega</dt><dd>{formatoFecha(pedido.fechaAtencion)}</dd></div>}
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-stone-700">Seguimiento</h2>
            <ol className="space-y-3 border-l-2 border-cafe-200 pl-4">
              {pedido.historial.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="font-medium text-stone-800">{ETIQUETA_ESTADO[h.estadoNuevo]}</p>
                  <p className="text-xs text-stone-500">{formatoFecha(h.fecha)} · {h.usuario?.nombre}</p>
                  {h.comentario && <p className="text-xs text-stone-600">{h.comentario}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      <Modal abierto={rechazo !== null} titulo="Rechazar pedido" onCerrar={() => setRechazo(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await cambiarEstado('RECHAZADO', rechazo)) setRechazo(null);
          }}
          className="space-y-4"
        >
          <div><label className="label">Motivo del rechazo</label><textarea className="input" rows="3" value={rechazo ?? ''} onChange={(e) => setRechazo(e.target.value)} required autoFocus /></div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setRechazo(null)}>Cancelar</button>
            <button type="submit" className="btn-danger" disabled={procesando}>Rechazar pedido</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
