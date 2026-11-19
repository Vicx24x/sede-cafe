import { NavLink, Outlet } from 'react-router';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { esAlmacen, iniciales, subtituloUsuario } from '../lib/formato';
import { Logo } from './ui';

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const menu = esAlmacen(usuario)
    ? [{ a: '/pedidos', texto: 'Pedidos' }, { a: '/inventario', texto: 'Inventario' }]
    : [{ a: '/', texto: 'Mis solicitudes' }];

  const enlaces = menu.map((m) => (
    <NavLink
      key={m.a}
      to={m.a}
      end
      className={({ isActive }) => `rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}
    >
      {m.texto}
    </NavLink>
  ));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-50/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Logo />
              <nav className="hidden items-center gap-1 sm:flex">{enlaces}</nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-xs font-medium text-neutral-900">{usuario.nombre}</p>
                <p className="text-[11px] text-neutral-500">{subtituloUsuario(usuario)}</p>
              </div>
              <span className="flex size-8 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-semibold text-neutral-700">
                {iniciales(usuario.nombre)}
              </span>
              <button type="button" onClick={cerrarSesion} className="btn-icono" title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
          <nav className="flex items-center gap-1 pb-2.5 sm:hidden">{enlaces}</nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
