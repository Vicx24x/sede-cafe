import { useEffect, useState } from 'react';
import { api, mensajeError } from '../api';
import { Alerta, Badge, Cargando, Encabezado, Modal, Vacio } from '../components/ui';

export default function Categorias() {
  const [categorias, setCategorias] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/categorias?todas=true').then(setCategorias).catch((e) => setError(mensajeError(e)));
  useEffect(() => { cargar(); }, []);

  async function ejecutar(fn) {
    setError('');
    try {
      await fn();
      cargar();
      return true;
    } catch (e) {
      setError(mensajeError(e));
      return false;
    }
  }

  async function guardar(e) {
    e.preventDefault();
    const { id, nombre, descripcion } = formulario;
    const datos = { nombre, descripcion };
    if (await ejecutar(() => (id ? api.put(`/categorias/${id}`, datos) : api.post('/categorias', datos)))) setFormulario(null);
  }

  return (
    <>
      <Encabezado titulo="Categorías" descripcion="Clasificación de productos e insumos">
        <button type="button" className="btn-primary" onClick={() => setFormulario({ nombre: '', descripcion: '' })}>+ Nueva categoría</button>
      </Encabezado>
      <Alerta onCerrar={() => setError('')}>{error}</Alerta>
      <div className="card overflow-x-auto">
        {!categorias ? <Cargando /> : categorias.length === 0 ? <Vacio>No hay categorías.</Vacio> : (
          <table className="table-base">
            <thead><tr><th>Nombre</th><th>Descripción</th><th className="text-right">Productos activos</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id} className={c.activo ? '' : 'opacity-50'}>
                  <td className="font-medium">{c.nombre}</td>
                  <td className="text-stone-500">{c.descripcion}</td>
                  <td className="text-right">{c.totalProductos}</td>
                  <td>{c.activo ? <Badge color="bg-emerald-100 text-emerald-700">Activa</Badge> : <Badge>Inactiva</Badge>}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setFormulario({ ...c, descripcion: c.descripcion ?? '' })}>Editar</button>
                      {c.activo
                        ? <button type="button" className="btn-danger btn-sm" onClick={() => ejecutar(() => api.del(`/categorias/${c.id}`))}>Baja</button>
                        : <button type="button" className="btn-secondary btn-sm" onClick={() => ejecutar(() => api.put(`/categorias/${c.id}`, { nombre: c.nombre, descripcion: c.descripcion, activo: true }))}>Reactivar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal abierto={!!formulario} titulo={formulario?.id ? 'Editar categoría' : 'Nueva categoría'} onCerrar={() => setFormulario(null)}>
        {formulario && (
          <form onSubmit={guardar} className="space-y-4">
            <div><label className="label">Nombre</label><input className="input" value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} required autoFocus /></div>
            <div><label className="label">Descripción</label><input className="input" value={formulario.descripcion} onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setFormulario(null)}>Cancelar</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
