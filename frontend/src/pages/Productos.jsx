import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, mensajeError, qs } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Alerta, Badge, Cargando, ETIQUETA_TIPO, Encabezado, Modal, Vacio, formatoFecha, formatoNumero,
} from '../components/ui';

const VACIO = {
  codigo: '', nombre: '', descripcion: '', tipo: 'INSUMO', unidadMedida: 'pza',
  stockActual: 0, stockMinimo: 0, categoriaId: '', disponible: true,
};

export default function Productos() {
  const { esGestor } = useAuth();
  const [params] = useSearchParams();
  const [filtros, setFiltros] = useState({
    q: '', categoriaId: '', tipo: '', bajoStock: params.get('bajoStock') === 'true', incluirInactivos: false,
  });
  const [productos, setProductos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [formulario, setFormulario] = useState(null); // producto en edición
  const [movimiento, setMovimiento] = useState(null); // { producto, tipo, cantidad, motivo }
  const [historial, setHistorial] = useState(null); // { producto, lista }

  const cargar = useCallback(() => {
    api.get(`/productos${qs(filtros)}`).then(setProductos).catch((e) => setError(mensajeError(e)));
  }, [filtros]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  useEffect(() => {
    api.get('/categorias').then(setCategorias).catch(() => {});
  }, []);

  async function accion(fn, mensaje) {
    setError('');
    try {
      await fn();
      setAviso(mensaje);
      cargar();
      return true;
    } catch (e) {
      setError(mensajeError(e));
      return false;
    }
  }

  async function guardar(e) {
    e.preventDefault();
    const { id, categoria, createdAt, updatedAt, activo, ...datos } = formulario;
    const ok = await accion(
      () => (id ? api.put(`/productos/${id}`, datos) : api.post('/productos', datos)),
      id ? 'Producto actualizado' : 'Producto registrado',
    );
    if (ok) setFormulario(null);
  }

  async function registrarMovimiento(e) {
    e.preventDefault();
    const { producto, ...datos } = movimiento;
    const ok = await accion(() => api.post(`/productos/${producto.id}/movimientos`, datos), 'Inventario actualizado');
    if (ok) setMovimiento(null);
  }

  async function verHistorial(producto) {
    try {
      setHistorial({ producto, lista: await api.get(`/productos/${producto.id}/movimientos`) });
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  const cambiar = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const campo = (nombre) => (e) => setFormulario({ ...formulario, [nombre]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <>
      <Encabezado titulo="Productos e insumos" descripcion="Catálogo, existencias y disponibilidad">
        {esGestor && <button type="button" className="btn-primary" onClick={() => setFormulario({ ...VACIO, categoriaId: categorias[0]?.id ?? '' })}>+ Nuevo producto</button>}
      </Encabezado>

      <Alerta onCerrar={() => setError('')}>{error}</Alerta>
      <Alerta tipo="ok" onCerrar={() => setAviso('')}>{aviso}</Alerta>

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <input className="input max-w-xs" placeholder="Buscar por nombre o código…" value={filtros.q} onChange={cambiar('q')} />
        <select className="input w-auto" value={filtros.categoriaId} onChange={cambiar('categoriaId')}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select className="input w-auto" value={filtros.tipo} onChange={cambiar('tipo')}>
          <option value="">Todos los tipos</option>
          {Object.entries(ETIQUETA_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filtros.bajoStock} onChange={cambiar('bajoStock')} /> Solo stock bajo</label>
        {esGestor && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filtros.incluirInactivos} onChange={cambiar('incluirInactivos')} /> Incluir dados de baja</label>}
      </div>

      <div className="card overflow-x-auto">
        {!productos ? <Cargando /> : productos.length === 0 ? <Vacio>No hay productos con esos filtros.</Vacio> : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Código</th><th>Nombre</th><th>Categoría</th><th>Tipo</th>
                <th className="text-right">Stock</th><th className="text-right">Mínimo</th><th>Estado</th>
                {esGestor && <th className="text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const bajo = Number(p.stockActual) <= Number(p.stockMinimo);
                return (
                  <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                    <td className="whitespace-nowrap font-mono text-xs">{p.codigo}</td>
                    <td><p className="font-medium text-stone-800">{p.nombre}</p>{p.descripcion && <p className="text-xs text-stone-400">{p.descripcion}</p>}</td>
                    <td>{p.categoria?.nombre}</td>
                    <td>{ETIQUETA_TIPO[p.tipo]}</td>
                    <td className={`text-right font-semibold ${bajo ? 'text-red-600' : 'text-stone-800'}`}>{formatoNumero(p.stockActual)} {p.unidadMedida}</td>
                    <td className="text-right text-stone-500">{formatoNumero(p.stockMinimo)}</td>
                    <td className="space-x-1">
                      {!p.activo ? <Badge>Dado de baja</Badge>
                        : p.disponible ? <Badge color="bg-emerald-100 text-emerald-700">Disponible</Badge>
                          : <Badge color="bg-stone-200 text-stone-600">No disponible</Badge>}
                      {p.activo && bajo && <Badge color="bg-red-100 text-red-700">Stock bajo</Badge>}
                    </td>
                    {esGestor && (
                      <td className="whitespace-nowrap text-right">
                        {p.activo ? (
                          <div className="flex justify-end gap-1">
                            <button type="button" className="btn-secondary btn-sm" onClick={() => setMovimiento({ producto: p, tipo: 'ENTRADA', cantidad: '', motivo: '' })}>Stock</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => verHistorial(p)}>Historial</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => setFormulario({ ...p, descripcion: p.descripcion ?? '' })}>Editar</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => accion(() => api.patch(`/productos/${p.id}/disponibilidad`, { disponible: !p.disponible }), 'Disponibilidad actualizada')}>
                              {p.disponible ? 'Pausar' : 'Habilitar'}
                            </button>
                            <button type="button" className="btn-danger btn-sm" onClick={() => window.confirm(`¿Dar de baja "${p.nombre}"?`) && accion(() => api.del(`/productos/${p.id}`), 'Producto dado de baja')}>Baja</button>
                          </div>
                        ) : (
                          <button type="button" className="btn-secondary btn-sm" onClick={() => accion(() => api.patch(`/productos/${p.id}/reactivar`), 'Producto reactivado')}>Reactivar</button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal abierto={!!formulario} titulo={formulario?.id ? 'Editar producto' : 'Nuevo producto'} onCerrar={() => setFormulario(null)}>
        {formulario && (
          <form onSubmit={guardar} className="grid grid-cols-2 gap-4">
            <div><label className="label">Código</label><input className="input" value={formulario.codigo} onChange={campo('codigo')} required /></div>
            <div><label className="label">Tipo</label>
              <select className="input" value={formulario.tipo} onChange={campo('tipo')}>
                {Object.entries(ETIQUETA_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Nombre</label><input className="input" value={formulario.nombre} onChange={campo('nombre')} required /></div>
            <div className="col-span-2"><label className="label">Descripción</label><input className="input" value={formulario.descripcion} onChange={campo('descripcion')} /></div>
            <div><label className="label">Categoría</label>
              <select className="input" value={formulario.categoriaId} onChange={campo('categoriaId')} required>
                <option value="" disabled>Selecciona…</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label className="label">Unidad de medida</label>
              <input className="input" list="unidades" value={formulario.unidadMedida} onChange={campo('unidadMedida')} required />
              <datalist id="unidades">{['pza', 'kg', 'g', 'l', 'ml', 'caja', 'paquete', 'rollo'].map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            {!formulario.id && <div><label className="label">Existencia inicial</label><input type="number" step="0.01" min="0" className="input" value={formulario.stockActual} onChange={campo('stockActual')} /></div>}
            <div><label className="label">Stock mínimo</label><input type="number" step="0.01" min="0" className="input" value={formulario.stockMinimo} onChange={campo('stockMinimo')} required /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={formulario.disponible} onChange={campo('disponible')} /> Disponible para pedidos</label>
            {formulario.id && <p className="col-span-2 text-xs text-stone-500">Para cambiar existencias usa el botón “Stock” (entrada o ajuste), así queda registro del movimiento.</p>}
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setFormulario(null)}>Cancelar</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal abierto={!!movimiento} titulo={`Movimiento de inventario · ${movimiento?.producto.nombre ?? ''}`} onCerrar={() => setMovimiento(null)}>
        {movimiento && (
          <form onSubmit={registrarMovimiento} className="space-y-4">
            <p className="text-sm text-stone-500">Stock actual: <b>{formatoNumero(movimiento.producto.stockActual)} {movimiento.producto.unidadMedida}</b></p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={movimiento.tipo === 'ENTRADA'} onChange={() => setMovimiento({ ...movimiento, tipo: 'ENTRADA' })} /> Entrada (sumar)</label>
              <label className="flex items-center gap-2"><input type="radio" checked={movimiento.tipo === 'AJUSTE'} onChange={() => setMovimiento({ ...movimiento, tipo: 'AJUSTE' })} /> Ajuste (conteo físico)</label>
            </div>
            <div>
              <label className="label">{movimiento.tipo === 'ENTRADA' ? 'Cantidad que entra' : 'Nuevo stock real'}</label>
              <input type="number" step="0.01" min="0" className="input" value={movimiento.cantidad} onChange={(e) => setMovimiento({ ...movimiento, cantidad: e.target.value })} required autoFocus />
            </div>
            <div><label className="label">Motivo</label><input className="input" placeholder="Compra a proveedor, merma, conteo…" value={movimiento.motivo} onChange={(e) => setMovimiento({ ...movimiento, motivo: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setMovimiento(null)}>Cancelar</button>
              <button type="submit" className="btn-primary">Registrar</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal abierto={!!historial} titulo={`Historial · ${historial?.producto.nombre ?? ''}`} onCerrar={() => setHistorial(null)} ancho="max-w-2xl">
        {historial && (historial.lista.length === 0 ? <Vacio>Sin movimientos.</Vacio> : (
          <div className="max-h-96 overflow-y-auto">
            <table className="table-base">
              <thead><tr><th>Fecha</th><th>Tipo</th><th className="text-right">Cantidad</th><th className="text-right">Stock final</th><th>Detalle</th></tr></thead>
              <tbody>
                {historial.lista.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs">{formatoFecha(m.fecha)}</td>
                    <td>{m.tipo}</td>
                    <td className="text-right">{formatoNumero(m.cantidad)}</td>
                    <td className="text-right">{formatoNumero(m.stockFinal)}</td>
                    <td className="text-xs text-stone-500">{m.motivo}{m.pedido ? ` (${m.pedido.folio})` : ''} · {m.usuario?.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Modal>
    </>
  );
}
