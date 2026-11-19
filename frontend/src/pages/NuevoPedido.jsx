import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, mensajeError } from '../api';
import { useAuth } from '../context/AuthContext';
import { Alerta, Cargando, ETIQUETA_TIPO, Encabezado, Vacio, formatoNumero } from '../components/ui';

export default function NuevoPedido() {
  const { usuario, esGestor } = useAuth();
  const navegar = useNavigate();
  const [catalogo, setCatalogo] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [renglones, setRenglones] = useState([]); // [{ producto, cantidad }]
  const [area, setArea] = useState(usuario.area || '');
  const [sucursalId, setSucursalId] = useState(usuario.sucursal?.id ?? '');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/productos?soloDisponibles=true').then(setCatalogo).catch((e) => setError(mensajeError(e)));
    if (esGestor) api.get('/sucursales').then(setSucursales).catch(() => {});
  }, [esGestor]);

  const filtrados = useMemo(() => {
    if (!catalogo) return [];
    const t = busqueda.trim().toLowerCase();
    const elegidos = new Set(renglones.map((r) => r.producto.id));
    return catalogo.filter((p) => !elegidos.has(p.id) && (!t || p.nombre.toLowerCase().includes(t) || p.codigo.toLowerCase().includes(t)));
  }, [catalogo, busqueda, renglones]);

  const agregar = (producto) => setRenglones([...renglones, { producto, cantidad: 1 }]);
  const quitar = (id) => setRenglones(renglones.filter((r) => r.producto.id !== id));
  const cambiarCantidad = (id, cantidad) => setRenglones(renglones.map((r) => (r.producto.id === id ? { ...r, cantidad } : r)));

  async function enviar() {
    setError('');
    if (renglones.length === 0) return setError('Agrega al menos un producto al pedido');
    setEnviando(true);
    try {
      const pedido = await api.post('/pedidos', {
        area: area || null,
        sucursalId: esGestor && sucursalId ? Number(sucursalId) : undefined,
        observaciones: observaciones || null,
        productos: renglones.map((r) => ({ productoId: r.producto.id, cantidad: Number(r.cantidad) })),
      });
      navegar(`/pedidos/${pedido.id}`);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado titulo="Nuevo pedido interno" descripcion="Selecciona los insumos, materiales o productos que necesitas" />
      <Alerta onCerrar={() => setError('')}>{error}</Alerta>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="border-b border-stone-200 p-4">
            <input className="input" placeholder="Buscar producto por nombre o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {!catalogo ? <Cargando /> : filtrados.length === 0 ? <Vacio>Sin resultados.</Vacio> : (
              <ul>
                {filtrados.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                    <div>
                      <p className="font-medium text-stone-800">{p.nombre}</p>
                      <p className="text-xs text-stone-500">{p.codigo} · {p.categoria?.nombre} · {ETIQUETA_TIPO[p.tipo]} · Existencia: {formatoNumero(p.stockActual)} {p.unidadMedida}</p>
                    </div>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => agregar(p)}>Agregar</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card h-fit p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-stone-700">Tu pedido</h2>
          {renglones.length === 0 ? <p className="mb-4 text-sm text-stone-400">Aún no agregas productos.</p> : (
            <ul className="mb-4 space-y-2">
              {renglones.map((r) => (
                <li key={r.producto.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{r.producto.nombre}</span>
                  <input type="number" min="0.01" step="0.01" className="input w-24" value={r.cantidad} onChange={(e) => cambiarCantidad(r.producto.id, e.target.value)} />
                  <span className="w-10 text-xs text-stone-500">{r.producto.unidadMedida}</span>
                  <button type="button" className="text-lg text-red-500 hover:text-red-700" onClick={() => quitar(r.producto.id)}>×</button>
                </li>
              ))}
            </ul>
          )}

          {esGestor ? (
            <div className="mb-3">
              <label className="label">Sucursal que solicita</label>
              <select className="input" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
                <option value="">Sin sucursal</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          ) : (
            <p className="mb-3 text-sm text-stone-500">Sucursal: <b>{usuario.sucursal?.nombre || 'Sin asignar'}</b></p>
          )}
          <div className="mb-3"><label className="label">Área</label><input className="input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Barra, cocina, limpieza…" /></div>
          <div className="mb-4"><label className="label">Observaciones</label><textarea className="input" rows="3" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></div>
          <button type="button" className="btn-primary w-full" onClick={enviar} disabled={enviando || renglones.length === 0}>
            {enviando ? 'Enviando…' : `Enviar pedido (${renglones.length})`}
          </button>
        </section>
      </div>
    </>
  );
}
