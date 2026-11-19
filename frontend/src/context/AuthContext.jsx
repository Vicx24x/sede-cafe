import { createContext, useContext, useEffect, useState } from 'react';
import { api, sesion } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!sesion.obtener()) {
      setCargando(false);
      return;
    }
    api.get('/auth/me')
      .then(setUsuario)
      .catch(() => sesion.borrar())
      .finally(() => setCargando(false));
  }, []);

  async function iniciarSesion(email, password) {
    const { token, usuario: datos } = await api.post('/auth/login', { email, password });
    sesion.guardar(token);
    setUsuario(datos);
  }

  function cerrarSesion() {
    sesion.borrar();
    setUsuario(null);
  }

  const esGestor = usuario?.rol === 'ADMIN' || usuario?.rol === 'ALMACEN';

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion, esGestor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
