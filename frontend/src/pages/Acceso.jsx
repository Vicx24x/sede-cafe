import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { mensajeError } from '../api';
import { ErrorCaja, Logo } from '../components/ui';

// Marco compartido por inicio de sesión y registro: panel negro a la izquierda, formulario a la derecha
function MarcoAcceso({ children }) {
  return (
    <div className="flex min-h-screen bg-neutral-100">
      <aside className="hidden w-[45%] max-w-xl flex-col justify-between bg-neutral-950 p-10 text-white lg:flex">
        <Logo claro />
        <p className="max-w-sm text-3xl leading-tight font-semibold tracking-tight">
          Solicita insumos, prepara pedidos y mantén el inventario al día.
        </p>
      </aside>
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {children}
        </div>
      </section>
    </div>
  );
}

export function Login() {
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
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso>
      <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
      <p className="mt-1 mb-6 text-[13px] text-neutral-500">Pedidos internos e inventario de Sede Café.</p>
      <form onSubmit={enviar} className="space-y-4">
        <ErrorCaja>{error}</ErrorCaja>
        <div>
          <label className="etiqueta" htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="etiqueta" htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" className="campo" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primario h-10 w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
      <p className="mt-5 text-xs text-neutral-500">
        ¿Eres empleado y aún no tienes cuenta?{' '}
        <Link to="/registro" className="font-medium text-neutral-900 underline underline-offset-2">Crea tu cuenta</Link>
      </p>
    </MarcoAcceso>
  );
}

export function Registro() {
  const { registrarse } = useAuth();
  const [datos, setDatos] = useState({ nombre: '', sucursal: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const campo = (nombre) => (e) => setDatos({ ...datos, [nombre]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await registrarse(datos);
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso>
      <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta de empleado</h1>
      <p className="mt-1 mb-6 text-[13px] text-neutral-500">Con ella podrás solicitar insumos y ver el estado de tus pedidos.</p>
      <form onSubmit={enviar} className="space-y-4">
        <ErrorCaja>{error}</ErrorCaja>
        <div>
          <label className="etiqueta" htmlFor="nombre">Nombre completo</label>
          <input id="nombre" className="campo" autoComplete="name" value={datos.nombre} onChange={campo('nombre')} required autoFocus />
        </div>
        <div>
          <label className="etiqueta" htmlFor="sucursal">Sucursal o área</label>
          <input id="sucursal" className="campo" placeholder="Ej. Sucursal 1" value={datos.sucursal} onChange={campo('sucursal')} required />
        </div>
        <div>
          <label className="etiqueta" htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" className="campo" value={datos.email} onChange={campo('email')} required />
        </div>
        <div>
          <label className="etiqueta" htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} className="campo" value={datos.password} onChange={campo('password')} required />
          <p className="ayuda">Mínimo 8 caracteres.</p>
        </div>
        <button type="submit" className="btn-primario h-10 w-full" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="mt-5 text-xs text-neutral-500">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-neutral-900 underline underline-offset-2">Inicia sesión</Link>
      </p>
    </MarcoAcceso>
  );
}
