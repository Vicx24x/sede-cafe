import { useEffect, useState } from 'react';
import { api, mensajeError } from '../api';
import { Alerta, Badge, Cargando, Encabezado, Modal } from '../components/ui';

export default function Sucursales() {
  const [sucursales, setSucursales] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/sucursales?todas=true').then(setSucursales).catch((e) => setError(mensajeError(e)));
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
    const { id, nombre, direccion, activo } = formulario;
    const datos = { nombre, direccion: direccion || null, activo };
    if (await ejecutar(() => (id ? api.put(`/sucursales/${id}`, datos) : api.post('/sucursales', datos)))) setFormulario(null);
  }

  return (
    <>
      <Encabezado titulo="Sucursales" descripcion="Puntos de venta y almacenes que realizan pedidos">
        <button type="button" className="btn-primary" onClick={() => setFormulario({ nombre: '', direccion: '', activo: true })}>+ Nueva sucursal</button>
      </Encabezado>
      <Alerta onCerrar={() => setError('')}>{error}</Alerta>
      <div className="card overflow-x-auto">
        {!sucursales ? <Cargando /> : (
          <table className="table-base">
            <thead><tr><th>Nombre</th><th>Dirección</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead>
            <tbody>
              {sucursales.map((s) => (
                <tr key={s.id} className={s.activo ? '' : 'opacity-50'}>
                  <td className="font-medium">{s.nombre}</td>
                  <td className="text-stone-500">{s.direccion}</td>
                  <td>{s.activo ? <Badge color="bg-emerald-100 text-emerald-700">Activa</Badge> : <Badge>Inactiva</Badge>}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setFormulario({ ...s, direccion: s.direccion ?? '' })}>Editar</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => ejecutar(() => api.put(`/sucursales/${s.id}`, { nombre: s.nombre, direccion: s.direccion, activo: !s.activo }))}>
                        {s.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal abierto={!!formulario} titulo={formulario?.id ? 'Editar sucursal' : 'Nueva sucursal'} onCerrar={() => setFormulario(null)}>
        {formulario && (
          <form onSubmit={guardar} className="space-y-4">
            <div><label className="label">Nombre</label><input className="input" value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} required autoFocus /></div>
            <div><label className="label">Dirección</label><input className="input" value={formulario.direccion} onChange={(e) => setFormulario({ ...formulario, direccion: e.target.value })} /></div>
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
