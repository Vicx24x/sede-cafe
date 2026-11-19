import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './context/AuthContext';
import { esAlmacen } from './lib/formato';
import Layout from './components/Layout';
import { Cargando } from './components/ui';
import { Login, Registro } from './pages/Acceso';
import MisSolicitudes from './pages/empleado/MisSolicitudes';
import Pedidos from './pages/almacen/Pedidos';
import Inventario from './pages/almacen/Inventario';

// Requiere sesión y, si se indica, el perfil de almacén
function Protegida({ almacen = false, children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (almacen && !esAlmacen(usuario)) return <Navigate to="/" replace />;
  return children;
}

// Página de inicio según el perfil: el empleado ve sus solicitudes y el almacén los pedidos
function Inicio() {
  const { usuario } = useAuth();
  return esAlmacen(usuario) ? <Navigate to="/pedidos" replace /> : <MisSolicitudes />;
}

export default function App() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando />;

  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/registro" element={usuario ? <Navigate to="/" replace /> : <Registro />} />
      <Route element={<Protegida><Layout /></Protegida>}>
        <Route index element={<Inicio />} />
        <Route path="pedidos" element={<Protegida almacen><Pedidos /></Protegida>} />
        <Route path="inventario" element={<Protegida almacen><Inventario /></Protegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
