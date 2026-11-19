import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

// Avisos breves ("toasts") en la parte inferior de la pantalla
const AvisosContext = createContext(null);

export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const contador = useRef(0);

  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = ++contador.current;
    setAvisos((lista) => [...lista.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), tipo === 'error' ? 6000 : 3500);
  }, []);

  return (
    <AvisosContext.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="flex max-w-md items-start gap-2 rounded-lg bg-neutral-900 px-3.5 py-2.5 text-[13px] text-white shadow-lg">
            {a.tipo === 'error'
              ? <CircleAlert className="mt-px size-4 shrink-0 text-rose-400" />
              : <CircleCheck className="mt-px size-4 shrink-0 text-emerald-400" />}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </AvisosContext.Provider>
  );
}

export const useAvisos = () => useContext(AvisosContext);
