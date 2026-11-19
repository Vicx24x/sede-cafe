import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, mensajeError, qs } from '../api';
import { useAuth } from '../context/AuthContext';
import { Alerta, Cargando, ETIQUETA_ESTADO, Encabezado, EstadoBadge, Vacio, formatoFecha } from '../components/ui';

export default function Pedidos() {
  const { esGestor } = useAuth();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const estado = params.get('estado') || '';
  const [q, setQ] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/pedidos${qs({ estado, q, sucursalId })}`).then(setPedidos).catch((e) => setError(mensajeError(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [estado, q, sucursalId]);

  useEffect(() => {
    if (esGestor) api.get('/sucursales').then(setSucursales).catch(() => {});
  }, [esGestor]);

  const pestanas = [['', 'Todos'], ...Object.entries(ETIQUETA_ESTADO)];

  return (
    <>
      <Encabezado titulo="Pedidos internos" descripcion={esGestor ? 'Solicitudes de todas las sucursales y áreas' : 'Tus solicitudes de insumos y materiales'}>
        <Link to="/pedidos/nuevo" className="btn-primary">+ Nuevo pedido</Link>
      </Encabezado>
      <Alerta onCerrar={() => setError('')}>{error}</Alerta>

      <div className="mb-4 flex flex-wrap gap-2">
        {pestanas.map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setParams(valor ? { estado: valor } : {})}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${estado === valor ? 'bg-cafe-700 text-white' : 'bg-white text-stone-600 hover:bg-cafe-100'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <input className="input max-w-xs" placeholder={esGestor ? 'Buscar folio, área o solicitante…' : 'Buscar folio o área…'} value={q} onChange={(e) => setQ(e.target.value)} />
        {esGestor && (
          <select className="input w-auto" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
      </div>

      <div className="card overflow-x-auto">
        {!pedidos ? <Cargando /> : pedidos.length === 0 ? <Vacio>No hay pedidos.</Vacio> : (
          <table className="table-base">
            <thead>
              <tr><th>Folio</th><th>Fecha</th><th>Solicitante</th><th>Sucursal / área</th><th className="text-right">Productos</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-cafe-50" onClick={() => navegar(`/pedidos/${p.id}`)}>
                  <td className="whitespace-nowrap font-mono text-xs font-semibold text-cafe-700">{p.folio}</td>
                  <td className="text-xs">{formatoFecha(p.createdAt)}</td>
                  <td>{p.solicitante?.nombre}</td>
                  <td>{p.sucursal?.nombre || '—'}{p.area ? <span className="text-stone-400"> · {p.area}</span> : ''}</td>
                  <td className="text-right">{p.totalProductos}</td>
                  <td><EstadoBadge estado={p.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
