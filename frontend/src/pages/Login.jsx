import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Alerta } from '../components/ui';
import { mensajeError } from '../api';

export default function Login() {
  const { iniciarSesion } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await iniciarSesion(email, password);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cafe-800 to-cafe-600 p-4">
      <form onSubmit={enviar} className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <p className="text-4xl">☕</p>
          <h1 className="mt-2 text-2xl font-bold text-cafe-800">Sede Café</h1>
          <p className="text-sm text-stone-500">Sistema de pedidos internos y control de productos</p>
        </div>
        <Alerta>{error}</Alerta>
        <label className="label" htmlFor="email">Correo electrónico</label>
        <input id="email" type="email" className="input mb-4" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <label className="label" htmlFor="password">Contraseña</label>
        <input id="password" type="password" className="input mb-6" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn-primary w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  );
}
