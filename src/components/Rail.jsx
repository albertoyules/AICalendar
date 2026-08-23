import { Activity, AlarmClock, Bell, BellOff, Calendar, ListChecks, LogOut, Moon, RotateCw, Search, Sun } from 'lucide-react';

/**
 * Barra estrecha de la izquierda. Es solo navegacion: no lleva nada que se
 * pueda tocar por accidente.
 */
export default function Rail({ vista, onVista, oscuro, onTema, usuario, onSalir, notificaciones }) {
  const botones = [
    { id: 'calendario', icono: Calendar, etiqueta: 'Calendario' },
    { id: 'habitos', icono: Activity, etiqueta: 'Hábitos' },
    { id: 'tareas', icono: ListChecks, etiqueta: 'Tareas' },
    { id: 'recordatorios', icono: AlarmClock, etiqueta: 'Recordatorios' },
    { id: 'buscar', icono: Search, etiqueta: 'Buscar' },
  ];

  return (
    <div
      className="flex w-[72px] shrink-0 flex-col items-center gap-7 py-[22px]"
      style={{ background: 'var(--superficie)', borderRight: '1px solid var(--borde)' }}
    >
      <img src="/iconos/icono-192.png" alt="" className="h-[34px] w-[34px] rounded-[10px]" />

      <div className="flex flex-col items-center gap-1.5">
        {botones.map(({ id, icono: Icono, etiqueta }) => {
          const activo = vista === id;
          return (
            <button
              key={id}
              type="button"
              title={etiqueta}
              aria-label={etiqueta}
              aria-current={activo ? 'page' : undefined}
              onClick={() => onVista(id)}
              className="flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors"
              style={{
                background: activo ? 'var(--superficie-3)' : 'transparent',
                color: activo ? 'var(--tinta)' : 'var(--tinta-tenue)',
              }}
            >
              <Icono size={20} strokeWidth={1.6} />
            </button>
          );
        })}
      </div>

      <div className="grow" />

      <button
        type="button"
        onClick={() => window.location.reload()}
        title="Recargar"
        aria-label="Recargar la aplicación"
        className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-[11px]"
        style={{ color: 'var(--tinta-tenue)' }}
      >
        <RotateCw size={18} strokeWidth={1.6} />
      </button>

      {notificaciones?.soportado && (
        <button
          type="button"
          onClick={notificaciones.activa ? notificaciones.desactivar : notificaciones.pedirPermiso}
          disabled={notificaciones.activando || notificaciones.bloqueada}
          title={
            notificaciones.bloqueada
              ? 'Bloqueadas en el navegador'
              : notificaciones.activa
                ? 'Avisos activados · clic para este dispositivo'
                : 'Activar avisos'
          }
          aria-label={notificaciones.activa ? 'Desactivar avisos en este dispositivo' : 'Activar avisos'}
          className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-[11px] disabled:opacity-40"
          style={{ color: notificaciones.activa ? 'var(--tinta)' : 'var(--tinta-tenue)' }}
        >
          {notificaciones.activa ? <Bell size={18} strokeWidth={1.6} /> : <BellOff size={18} strokeWidth={1.6} />}
        </button>
      )}

      <button
        type="button"
        onClick={onTema}
        title={oscuro ? 'Pasar a claro' : 'Pasar a oscuro'}
        aria-label={oscuro ? 'Pasar a tema claro' : 'Pasar a tema oscuro'}
        className="flex h-10 w-10 items-center justify-center rounded-[11px]"
        style={{ color: 'var(--tinta-tenue)' }}
      >
        {oscuro ? <Sun size={18} strokeWidth={1.6} /> : <Moon size={18} strokeWidth={1.6} />}
      </button>

      {usuario ? (
        <button
          type="button"
          onClick={onSalir}
          title={`Salir de ${usuario.email}`}
          aria-label="Cerrar sesión"
          className="group relative flex h-[34px] w-[34px] items-center justify-center rounded-full"
          style={{ background: 'var(--superficie-3)', color: 'var(--tinta-suave)' }}
        >
          {usuario.photoURL ? (
            <img
              src={usuario.photoURL}
              alt=""
              className="h-[34px] w-[34px] rounded-full object-cover group-hover:opacity-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-[12px] font-semibold group-hover:opacity-0">
              {(usuario.displayName ?? usuario.email ?? '?').slice(0, 2).toUpperCase()}
            </span>
          )}
          <LogOut
            size={16}
            strokeWidth={1.7}
            className="absolute opacity-0 group-hover:opacity-100"
          />
        </button>
      ) : (
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[12px] font-semibold"
          style={{ background: 'var(--superficie-3)', color: 'var(--tinta-suave)' }}
        >
          CY
        </div>
      )}
    </div>
  );
}
