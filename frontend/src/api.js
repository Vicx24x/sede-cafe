// Cliente HTTP sencillo para la API del backend
const CLAVE_TOKEN = 'sedecafe_token';

export const sesion = {
  obtener: () => {
    try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
  },
  guardar: (token) => {
    try { localStorage.setItem(CLAVE_TOKEN, token); } catch { /* sin almacenamiento */ }
  },
  borrar: () => {
    try { localStorage.removeItem(CLAVE_TOKEN); } catch { /* sin almacenamiento */ }
  },
};

export class ApiError extends Error {
  constructor(status, datos) {
    super(datos?.error || `Error ${status}`);
    this.status = status;
    this.detalles = datos?.detalles;
  }
}

async function peticion(metodo, ruta, cuerpo) {
  const headers = { 'Content-Type': 'application/json' };
  const token = sesion.obtener();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.' });
  }

  const datos = await res.json().catch(() => null);
  if (res.status === 401 && token) {
    sesion.borrar();
    window.location.href = '/login';
  }
  if (!res.ok) throw new ApiError(res.status, datos);
  return datos;
}

export const api = {
  get: (ruta) => peticion('GET', ruta),
  post: (ruta, cuerpo) => peticion('POST', ruta, cuerpo ?? {}),
  put: (ruta, cuerpo) => peticion('PUT', ruta, cuerpo ?? {}),
  patch: (ruta, cuerpo) => peticion('PATCH', ruta, cuerpo ?? {}),
  del: (ruta) => peticion('DELETE', ruta),
};

// Convierte un objeto en ?a=1&b=2 omitiendo valores vacíos
export function qs(params) {
  const limpio = Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false);
  return limpio.length ? `?${new URLSearchParams(limpio)}` : '';
}

// Mensaje legible para mostrar al usuario
export function mensajeError(e) {
  if (e?.detalles?.length) return e.detalles.map((d) => d.mensaje).join('. ');
  return e?.message || 'Ocurrió un error inesperado';
}
