import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, mensajeError } from '../api';
import { useAuth } from '../context/AuthContext';
import { Alerta, Cargando, Encabezado, EstadoBadge, Vacio, formatoFecha, formatoNumero } from '../components/ui';

const TARJETAS = [
  { estado: 'PENDIENTE', texto: 'Pendientes', color: 'text-amber-600' },
  { estado: 'EN_PROCESO', texto: 'En proceso', color: 'text-sky-600' },
  { estado: 'ATENDIDO', texto: 'Atendidos', color: 'text-emerald-600' },
  { estado: 'RECHAZADO', texto: 'Rechazados', color: 'text-red-600' },
];

export default function Inicio() {
  const { usuario, esGestor } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(setDatos).catch((e) => setError(mensajeError(e)));
  }, []);

  return (
    <>
      <Encabezado titulo={`Hola, ${usuario.nombre.split(' ')[0]}`} descripcion={esGestor ? 'Resumen general de pedidos e inventario' : 'Resumen de tus pedidos'}>
        <Link to="/pedidos/nuevo" className="btn-primary">+ Nuevo pedido</Link>
      </Encabezado>
      <Alerta>{error}</Alerta>
      {!datos ? <Cargando /> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {TARJETAS.map((t) => (
              <Link key={t.estado} to={`/pedidos?estado=${t.estado}`} className="card p-5 transition hover:shadow-md">
                <p className="text-sm text-stone-500">{t.texto}</p>
                <p className={`mt-1 text-3xl font-bold ${t.color}`}>{datos.pedidos[t.estado]}</p>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card">
              <h2 className="border-b border-stone-200 px-5 py-3 font-semibold text-stone-700">Pedidos recientes</h2>
              {datos.recientes.length === 0 ? <Vacio>Aún no hay pedidos.</Vacio> : (
                <ul>
                  {datos.recientes.map((p) => (
                    <li key={p.id} className="border-b border-stone-100 last:border-0">
                      <Link to={`/pedidos/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                        <div>
                          <p className="font-medium text-stone-800">{p.folio}</p>
                          <p className="text-xs text-stone-500">{p.solicitante?.nombre} · {p.sucursal?.nombre || 'Sin sucursal'} · {formatoFecha(p.createdAt)}</p>
                        </div>
                        <EstadoBadge estado={p.estado} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {esGestor && (
              <section className="card">
                <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
                  <h2 className="font-semibold text-stone-700">Productos con stock bajo</h2>
                  <Link to="/productos?bajoStock=true" className="text-xs text-cafe-600 hover:underline">Ver todos</Link>
                </div>
                {datos.bajoStock.length === 0 ? <Vacio>Todo el inventario está por encima del mínimo.</Vacio> : (
                  <table className="table-base">
                    <thead><tr><th>Producto</th><th className="text-right">Actual</th><th className="text-right">Mínimo</th></tr></thead>
                    <tbody>
                      {datos.bajoStock.map((p) => (
                        <tr key={p.id}>
                          <td><span className="font-medium">{p.nombre}</span> <span className="text-xs text-stone-400">{p.codigo}</span></td>
                          <td className="text-right font-semibold text-red-600">{formatoNumero(p.stockActual)} {p.unidadMedida}</td>
                          <td className="text-right text-stone-500">{formatoNumero(p.stockMinimo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </div>
          <p className="mt-6 text-xs text-stone-400">Productos activos en catálogo: {datos.totalProductos}</p>
        </>
      )}
    </>
  );
}
