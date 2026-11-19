import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ETIQUETA_ROL } from './ui';

const MENU = [
  { a: '/', texto: 'Inicio', icono: '⌂', fin: true },
  { a: '/pedidos', texto: 'Pedidos', icono: '☰' },
  { a: '/pedidos/nuevo', texto: 'Nuevo pedido', icono: '+' },
  { a: '/productos', texto: 'Productos e insumos', icono: '▦' },
  { a: '/categorias', texto: 'Categorías', icono: '◫', roles: ['ADMIN', 'ALMACEN'] },
  { a: '/usuarios', texto: 'Usuarios', icono: '☺', roles: ['ADMIN'] },
  { a: '/sucursales', texto: 'Sucursales', icono: '⌖', roles: ['ADMIN'] },
];

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const opciones = MENU.filter((m) => !m.roles || m.roles.includes(usuario.rol));

  return (
    <div className="min-h-screen bg-cafe-50 md:flex">
      <header className="flex items-center justify-between bg-cafe-800 px-4 py-3 text-white md:hidden">
        <span className="font-bold">☕ Sede Café</span>
        <button type="button" onClick={() => setMenuAbierto(!menuAbierto)} className="text-xl">☰</button>
      </header>

      <aside className={`${menuAbierto ? 'block' : 'hidden'} w-full shrink-0 bg-cafe-800 text-cafe-100 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col`}>
        <div className="hidden px-6 py-6 md:block">
          <p className="text-xl font-bold text-white">☕ Sede Café</p>
          <p className="text-xs text-cafe-200">Pedidos internos e inventario</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {opciones.map((m) => (
            <NavLink
              key={m.a}
              to={m.a}
              end={m.fin || m.a === '/pedidos'}
              onClick={() => setMenuAbierto(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-cafe-600 text-white' : 'hover:bg-cafe-700'}`}
            >
              <span className="w-4 text-center">{m.icono}</span>
              {m.texto}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-cafe-700 px-5 py-4 text-sm">
          <p className="font-semibold text-white">{usuario.nombre}</p>
          <p className="text-xs text-cafe-200">{ETIQUETA_ROL[usuario.rol]}{usuario.sucursal ? ` · ${usuario.sucursal.nombre}` : ''}</p>
          <button type="button" onClick={cerrarSesion} className="mt-3 text-xs text-cafe-200 underline hover:text-white">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
