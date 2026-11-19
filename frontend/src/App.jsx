import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Cargando } from './components/ui';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Productos from './pages/Productos';
import Categorias from './pages/Categorias';
import Pedidos from './pages/Pedidos';
import NuevoPedido from './pages/NuevoPedido';
import PedidoDetalle from './pages/PedidoDetalle';
import Usuarios from './pages/Usuarios';
import Sucursales from './pages/Sucursales';

// Protege rutas: requiere sesión y, opcionalmente, ciertos roles
function Protegida({ roles, children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { usuario } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Protegida><Layout /></Protegida>}>
        <Route index element={<Inicio />} />
        <Route path="productos" element={<Productos />} />
        <Route path="categorias" element={<Protegida roles={['ADMIN', 'ALMACEN']}><Categorias /></Protegida>} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="pedidos/nuevo" element={<NuevoPedido />} />
        <Route path="pedidos/:id" element={<PedidoDetalle />} />
        <Route path="usuarios" element={<Protegida roles={['ADMIN']}><Usuarios /></Protegida>} />
        <Route path="sucursales" element={<Protegida roles={['ADMIN']}><Sucursales /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
