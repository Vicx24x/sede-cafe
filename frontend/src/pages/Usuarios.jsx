import { useEffect, useState } from 'react';
import { api, mensajeError } from '../api';
import { useAuth } from '../context/AuthContext';
import { Alerta, Badge, Cargando, ETIQUETA_ROL, Encabezado, Modal } from '../components/ui';

const VACIO = { nombre: '', email: '', rol: 'EMPLEADO', area: '', sucursalId: '', password: '' };

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [formulario, setFormulario] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/usuarios').then(setUsuarios).catch((e) => setError(mensajeError(e)));
  useEffect(() => {
    cargar();
    api.get('/sucursales').then(setSucursales).catch(() => {});
  }, []);

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
    const { id, nombre, email, rol, area, sucursalId, password } = formulario;
    const datos = { nombre, email, rol, area: area || null, sucursalId: sucursalId ? Number(sucursalId) : null, password };
    if (await ejecutar(() => (id ? api.put(`/usuarios/${id}`, datos) : api.post('/usuarios', datos)))) setFormulario(null);
  }

  const campo = (nombre) => (e) => setFormulario({ ...formulario, [nombre]: e.target.value });

  return (
    <>
      <Encabezado titulo="Usuarios y roles" descripcion="Cuentas de Administración, Almacén y Empleados de sucursal">
        <button type="button" className="btn-primary" onClick={() => setFormulario(VACIO)}>+ Nuevo usuario</button>
      </Encabezado>
      <Alerta onCerrar={() => setError('')}>{error}</Alerta>

      <div className="card overflow-x-auto">
        {!usuarios ? <Cargando /> : (
          <table className="table-base">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Sucursal / área</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.activo ? '' : 'opacity-50'}>
                  <td className="font-medium">{u.nombre}</td>
                  <td>{u.email}</td>
                  <td><Badge color={u.rol === 'EMPLEADO' ? 'bg-stone-100 text-stone-700' : 'bg-cafe-100 text-cafe-800'}>{ETIQUETA_ROL[u.rol]}</Badge></td>
                  <td>{u.sucursal?.nombre || '—'}{u.area ? <span className="text-stone-400"> · {u.area}</span> : ''}</td>
                  <td>{u.activo ? <Badge color="bg-emerald-100 text-emerald-700">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setFormulario({ ...u, area: u.area ?? '', sucursalId: u.sucursalId ?? '', password: '' })}>Editar</button>
                      {u.id !== yo.id && (
                        <button type="button" className={u.activo ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'} onClick={() => ejecutar(() => api.patch(`/usuarios/${u.id}/estado`, { activo: !u.activo }))}>
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal abierto={!!formulario} titulo={formulario?.id ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={() => setFormulario(null)}>
        {formulario && (
          <form onSubmit={guardar} className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nombre completo</label><input className="input" value={formulario.nombre} onChange={campo('nombre')} required /></div>
            <div className="col-span-2"><label className="label">Correo</label><input type="email" className="input" value={formulario.email} onChange={campo('email')} required /></div>
            <div><label className="label">Rol</label>
              <select className="input" value={formulario.rol} onChange={campo('rol')}>
                {Object.entries(ETIQUETA_ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="label">Sucursal</label>
              <select className="input" value={formulario.sucursalId} onChange={campo('sucursalId')}>
                <option value="">Sin sucursal</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Área</label><input className="input" value={formulario.area} onChange={campo('area')} placeholder="Barra, cocina, almacén…" /></div>
            <div className="col-span-2">
              <label className="label">{formulario.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
              <input type="password" className="input" value={formulario.password} onChange={campo('password')} minLength={8} required={!formulario.id} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setFormulario(null)}>Cancelar</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
