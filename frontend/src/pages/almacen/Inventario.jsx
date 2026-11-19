import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { api, mensajeError, qs } from '../../api';
import { useAvisos } from '../../context/AvisosContext';
import { UNIDADES, cantidad } from '../../lib/formato';
import { Cargando, Encabezado, ErrorCaja, Modal } from '../../components/ui';

const VACIO = {
  codigo: '', nombre: '', categoria: '', unidadMedida: 'pieza', stockActual: '', stockMinimo: '', descripcion: '',
};

export default function Inventario() {
  const avisar = useAvisos();
  const [params, setParams] = useSearchParams();
  // Estado local (sincronizado con la URL) para que la casilla responda al instante
  const [bajoStock, setBajoStock] = useState(params.get('bajoStock') === 'true');
  const paramBajoStock = params.get('bajoStock') === 'true';
  useEffect(() => setBajoStock(paramBajoStock), [paramBajoStock]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [verBajas, setVerBajas] = useState(false);
  const [productos, setProductos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [totalBajoStock, setTotalBajoStock] = useState(null);
  const [error, setError] = useState('');
  const [formulario, setFormulario] = useState(null); // producto en edición (o nuevo)
  const [errorFormulario, setErrorFormulario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [baja, setBaja] = useState(null); // producto a dar de baja

  const cargar = useCallback(async () => {
    try {
      const [lista, resumen, cats] = await Promise.all([
        api.get(`/productos${qs({ q: busqueda.trim(), categoriaId, bajoStock, incluirInactivos: verBajas })}`),
        api.get('/dashboard'),
        api.get('/categorias'),
      ]);
      setProductos(lista);
      setTotalBajoStock(resumen.productosBajoStock);
      setCategorias(cats);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, [busqueda, categoriaId, bajoStock, verBajas]);

  useEffect(() => {
    const t = setTimeout(cargar, 200);
    return () => clearTimeout(t);
  }, [cargar]);

  function alternarBajoStock(valor) {
    setBajoStock(valor);
    setParams(valor ? { bajoStock: 'true' } : {}, { replace: true });
  }

  function abrirNuevo() {
    setErrorFormulario('');
    setFormulario({ ...VACIO });
  }

  function abrirEdicion(p) {
    setErrorFormulario('');
    setFormulario({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria?.nombre || '',
      unidadMedida: p.unidadMedida,
      stockActual: String(Number(p.stockActual)),
      stockMinimo: String(Number(p.stockMinimo)),
      descripcion: p.descripcion || '',
    });
  }

  async function guardar(e) {
    e.preventDefault();
    setErrorFormulario('');
    setGuardando(true);
    const { id, ...datos } = formulario;
    const cuerpo = { ...datos, descripcion: datos.descripcion.trim() || null };
    try {
      if (id) await api.put(`/productos/${id}`, cuerpo);
      else await api.post('/productos', cuerpo);
      avisar(id ? `${datos.nombre} actualizado` : `${datos.nombre} agregado al inventario`);
      setFormulario(null);
      await cargar();
    } catch (err) {
      setErrorFormulario(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarBaja() {
    try {
      await api.del(`/productos/${baja.id}`);
      avisar(`${baja.nombre} dado de baja`);
      setBaja(null);
      await cargar();
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  }

  async function reactivar(p) {
    try {
      await api.patch(`/productos/${p.id}/reactivar`);
      avisar(`${p.nombre} reactivado`);
      await cargar();
    } catch (e) {
      avisar(mensajeError(e), 'error');
    }
  }

  const campo = (nombre) => (e) => setFormulario({ ...formulario, [nombre]: e.target.value });

  return (
    <>
      <Encabezado titulo="Inventario" descripcion="Productos, materiales e insumos de Sede Café.">
        <button type="button" className="btn-primario" onClick={abrirNuevo}>
          <Plus className="size-4" /> Nuevo producto
        </button>
      </Encabezado>
      <ErrorCaja>{error}</ErrorCaja>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
          <input className="campo pl-9" placeholder="Buscar por nombre o código" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <select className="campo md:w-48" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="flex flex-wrap gap-x-4 gap-y-1 md:ml-1">
          <label className="flex items-center gap-2 text-xs whitespace-nowrap text-neutral-700">
            <input type="checkbox" className="size-4 accent-neutral-900" checked={bajoStock} onChange={(e) => alternarBajoStock(e.target.checked)} />
            Solo stock bajo{totalBajoStock !== null ? ` (${totalBajoStock})` : ''}
          </label>
          <label className="flex items-center gap-2 text-xs whitespace-nowrap text-neutral-700">
            <input type="checkbox" className="size-4 accent-neutral-900" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
            Ver dados de baja
          </label>
        </div>
      </div>

      <div className="tarjeta overflow-hidden">
        {!productos ? <Cargando /> : productos.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-neutral-400">
            {bajoStock ? 'Ningún producto está en su stock mínimo. ¡Todo en orden!' : 'No hay productos que coincidan con la búsqueda.'}
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="encabezado-tabla border-b border-neutral-100">
                <th className="px-4 py-2.5 font-medium">Producto</th>
                <th className="hidden py-2.5 pr-4 font-medium sm:table-cell">Categoría</th>
                <th className="py-2.5 pr-4 text-right font-medium">Stock</th>
                <th className="hidden py-2.5 pr-4 text-right font-medium sm:table-cell">Mínimo</th>
                <th className="py-2.5 pr-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-[13px]">
              {productos.map((p) => {
                const bajo = p.activo && Number(p.stockActual) <= Number(p.stockMinimo);
                return (
                  <tr key={p.id} className={p.activo ? '' : 'bg-neutral-50 text-neutral-400'}>
                    <td className="px-4 py-2.5">
                      <p className={`font-medium ${p.activo ? 'text-neutral-900' : ''}`}>{p.nombre}</p>
                      <p className="text-[11px] text-neutral-500">
                        {p.codigo}<span className="sm:hidden"> · {p.categoria?.nombre}</span>
                        {!p.activo && <span className="ml-1.5 rounded bg-neutral-200 px-1.5 py-px text-[10px] text-neutral-600">Dado de baja</span>}
                      </p>
                    </td>
                    <td className="hidden py-2.5 pr-4 text-neutral-600 sm:table-cell">{p.categoria?.nombre}</td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                      <p className={`font-medium ${bajo ? 'text-rose-700' : ''}`}>{cantidad(p.stockActual, p.unidadMedida)}</p>
                      {bajo && <p className="text-[10px] font-medium text-rose-700">Stock bajo</p>}
                    </td>
                    <td className="hidden py-2.5 pr-4 text-right text-neutral-500 sm:table-cell">{Number(p.stockMinimo).toLocaleString('es-MX')}</td>
                    <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                      {p.activo ? (
                        <>
                          <button type="button" className="btn-icono" title="Editar" aria-label={`Editar ${p.nombre}`} onClick={() => abrirEdicion(p)}>
                            <Pencil className="size-3.5" />
                          </button>
                          <button type="button" className="btn-icono hover:text-rose-700" title="Dar de baja" aria-label={`Dar de baja ${p.nombre}`} onClick={() => setBaja(p)}>
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn-secundario btn-chico" onClick={() => reactivar(p)}>
                          <RotateCcw className="size-3.5" /> Reactivar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Alta y edición */}
      <Modal abierto={!!formulario} titulo={formulario?.id ? 'Editar producto' : 'Nuevo producto'} onCerrar={() => setFormulario(null)} ancho="max-w-lg">
        {formulario && (
          <form onSubmit={guardar} className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2"><ErrorCaja>{errorFormulario}</ErrorCaja></div>
            <div>
              <label className="etiqueta" htmlFor="codigo">Código</label>
              <input id="codigo" className="campo uppercase" placeholder="GRA-004" value={formulario.codigo} onChange={campo('codigo')} required autoFocus={!formulario.id} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="unidad">Unidad de medida</label>
              <select id="unidad" className="campo" value={formulario.unidadMedida} onChange={campo('unidadMedida')}>
                {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.etiqueta}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="etiqueta" htmlFor="nombre">Nombre</label>
              <input id="nombre" className="campo" value={formulario.nombre} onChange={campo('nombre')} required />
            </div>
            <div className="sm:col-span-2">
              <label className="etiqueta" htmlFor="categoria">Categoría</label>
              <input id="categoria" className="campo" list="lista-categorias" placeholder="Elige una o escribe una nueva" value={formulario.categoria} onChange={campo('categoria')} required />
              <datalist id="lista-categorias">{categorias.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
            </div>
            <div>
              <label className="etiqueta" htmlFor="stock">Stock actual</label>
              <input id="stock" type="number" min="0" step="1" inputMode="numeric" className="campo" value={formulario.stockActual} onChange={campo('stockActual')} required />
            </div>
            <div>
              <label className="etiqueta" htmlFor="minimo">Stock mínimo</label>
              <input id="minimo" type="number" min="0" step="1" inputMode="numeric" className="campo" value={formulario.stockMinimo} onChange={campo('stockMinimo')} required />
              <p className="ayuda">Se avisa cuando el stock llega a este nivel o menos.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="etiqueta" htmlFor="descripcion">Descripción <span className="font-normal text-neutral-400">(opcional)</span></label>
              <textarea id="descripcion" rows="2" maxLength={300} className="campo resize-y" value={formulario.descripcion} onChange={campo('descripcion')} />
            </div>
            <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
              <button type="button" className="btn-secundario" onClick={() => setFormulario(null)}>Cancelar</button>
              <button type="submit" className="btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar producto'}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Baja lógica */}
      <Modal abierto={!!baja} titulo={`Dar de baja ${baja?.nombre ?? ''}`} onCerrar={() => setBaja(null)}>
        <p className="text-[13px] text-neutral-600">
          El producto dejará de aparecer en el catálogo de los empleados. No se borra: su historial de pedidos se conserva y puedes reactivarlo con “Ver dados de baja”.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secundario" onClick={() => setBaja(null)}>Cancelar</button>
          <button type="button" className="btn-peligro" onClick={confirmarBaja}>Dar de baja</button>
        </div>
      </Modal>
    </>
  );
}
