import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { entrarConGoogle } from '../services/auth';

/**
 * La puerta. Un botón y dentro.
 *
 * No hay registro ni contraseñas: es tu agenda, no un producto con usuarios.
 * Lo único que hace la sesión es que la misma agenda te siga del ordenador al
 * móvil y que nadie más pueda leerla.
 */
export default function LoginScreen() {
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState(null);

  const entrar = async () => {
    setEntrando(true);
    setError(null);
    try {
      await entrarConGoogle();
      // No hace falta hacer nada más: el observador de sesión pinta la app.
    } catch (fallo) {
      // Cerrar la ventana de Google no es un error que merezca un aviso rojo.
      if (fallo.code !== 'auth/popup-closed-by-user' && fallo.code !== 'auth/cancelled-popup-request') {
        setError(
          fallo.code === 'auth/unauthorized-domain'
            ? 'Este dominio no está autorizado en Firebase. Añádelo en Authentication > Settings > Authorized domains.'
            : 'No se ha podido entrar. Inténtalo otra vez.',
        );
      }
      setEntrando(false);
    }
  };

  return (
    <div className="flex h-[100dvh] w-screen flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-[340px] flex-col items-center gap-7">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-[30px] leading-none"
          style={{ background: 'var(--tinta)', color: 'var(--papel)', fontFamily: 'var(--font-serif)' }}
        >
          i
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <h1
            className="m-0 text-[34px] leading-[1.1] tracking-[-0.01em]"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}
          >
            Tu agenda,
            <br />
            contada en voz alta
          </h1>
          <p className="m-0 text-[14px] leading-[1.55]" style={{ color: 'var(--tinta-suave)' }}>
            Entra para tener el mismo calendario en el ordenador y en el móvil.
          </p>
        </div>

        <button
          type="button"
          onClick={entrar}
          disabled={entrando}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-[13px] text-[14.5px] font-medium disabled:opacity-60"
          style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
        >
          {entrando ? (
            'Entrando…'
          ) : (
            <>
              <LogoGoogle />
              Entrar con Google
            </>
          )}
        </button>

        {error && (
          <div
            className="flex items-start gap-2.5 rounded-[11px] px-3.5 py-3 text-[12.5px] leading-[1.5]"
            style={{ background: 'var(--superficie-3)', color: 'var(--ahora)' }}
          >
            <AlertCircle size={15} strokeWidth={1.8} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LogoGoogle() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23 12.27c0-.82-.07-1.6-.21-2.36H12v4.47h6.16a5.3 5.3 0 0 1-2.29 3.45v2.9h3.7C21.72 18.75 23 15.8 23 12.27z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1.03 7.6-2.78l-3.71-2.88c-1.03.69-2.35 1.1-3.89 1.1-2.99 0-5.52-2.02-6.43-4.73H1.73v2.97A11.49 11.49 0 0 0 12 23.5z" />
      <path fill="#FBBC05" d="M5.57 14.21a6.9 6.9 0 0 1 0-4.41V6.83H1.73a11.5 11.5 0 0 0 0 10.35l3.84-2.97z" />
      <path fill="#EA4335" d="M12 5.05c1.68 0 3.19.58 4.38 1.72l3.28-3.28C17.7 1.62 15.1.5 12 .5 7.53.5 3.66 3.07 1.73 6.83l3.84 2.97C6.48 7.09 9.01 5.05 12 5.05z" />
    </svg>
  );
}
