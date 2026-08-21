import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, LogOut, Moon, Plus, Sun, X } from 'lucide-react';

import AgendaDia from './components/AgendaDia';
import BarraMovil from './components/BarraMovil';
import CabeceraCalendario from './components/CabeceraCalendario';
import ModalEvento from './components/ModalEvento';
import PanelChat from './components/PanelChat';
import Rail from './components/Rail';
import VistaMes from './components/VistaMes';
import VistaSemana from './components/VistaSemana';

import LoginScreen from './screens/LoginScreen';

import { useAuth } from './hooks/useAuth';
import { useEsMovil } from './hooks/useEsMovil';
import { useEventos } from './hooks/useEventos';
import { useTema } from './hooks/useTema';
import {
  actualizarEvento,
  borrarEvento,
  borrarSerie,
  crearSerieRecurrente,
  explicarFallo,
  guardarEvento,
  sembrarSiHaceFalta,
} from './services/eventosRepository';
import { cerrarSesion } from './services/auth';
import { hayFirebase } from './config/firebase';
import {
  anioDe,
  hoy,
  rejillaMes,
  semanaDe,
  sumarDias,
  sumarMeses,
  tituloMes,
} from './lib/fechas';

export default function App() {
  const { oscuro, alternar } = useTema();
  const esMovil = useEsMovil();
  const { usuario, comprobando, hacenFaltaCredenciales } = useAuth();

  const [seccion, setSeccion] = useState('calendario');
  const [modo, setModo] = useState('mes');
  const [foco, setFoco] = useState(hoy);
  const [modal, setModal] = useState(null); // { evento } | { fechaSugerida }

  // Solo en el móvil: qué pantalla se ve y si el asistente está abierto.
  const [pantalla, setPantalla] = useState('agenda');
  const [chatAbierto, setChatAbierto] = useState(null); // null | 'texto' | 'voz'

  useEffect(() => {
    sembrarSiHaceFalta();
  }, []);

  // Con Firebase configurado esperamos a saber si hay sesión antes de pintar:
  // si no, se ve un fogonazo de la pantalla de entrar a quien ya estaba dentro.
  const sinSesion = hacenFaltaCredenciales && !usuario;

  // En el móvil pedimos siempre el mes: así moverse de día en día no dispara
  // una consulta nueva cada vez.
  const porMes = esMovil || modo === 'mes';
  const [desde, hasta] = useMemo(() => {
    const dias = porMes ? rejillaMes(foco) : semanaDe(foco);
    return [dias[0], dias[dias.length - 1]];
  }, [porMes, foco]);

  const { porDia, fallo } = useEventos(desde, hasta);

  const [hoyClave, limiteProximos] = useMemo(() => {
    const h = hoy();
    return [h, sumarDias(h, 10)];
  }, []);
  const { eventos: eventosProximos } = useEventos(hoyClave, limiteProximos);

  const proximos = useMemo(() => {
    const manana = sumarDias(hoyClave, 1);
    return eventosProximos
      .filter((e) => e.inicio >= manana)
      .filter((e) => e.categoria === 'universidad' || e.categoria === 'salud')
      .slice(0, 2);
  }, [eventosProximos, hoyClave]);

  const saltar = useCallback(
    (direccion) => {
      setFoco((actual) =>
        porMes ? sumarMeses(actual, direccion) : sumarDias(actual, direccion * 7),
      );
    },
    [porMes],
  );

  useEffect(() => {
    if (modal || esMovil) return undefined;
    const alPulsar = (e) => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') saltar(-1);
      if (e.key === 'ArrowRight') saltar(1);
      if (e.key === 't' || e.key === 'T') setFoco(hoy());
      if (e.key === 'n' || e.key === 'N') setModal({ fechaSugerida: hoy() });
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [modal, esMovil, saltar]);

  // Un fallo al escribir tiene que verse. Si no, das a guardar, se cierra el
  // diálogo, no aparece nada y no sabes si es culpa tuya o de la app.
  const [avisoEscritura, setAvisoEscritura] = useState(null);

  const alGuardar = useCallback(async (datos) => {
    const { id, repetir, ...resto } = datos;
    try {
      if (id) await actualizarEvento(id, resto);
      else if (repetir) await crearSerieRecurrente(resto, repetir);
      else await guardarEvento(resto);
      setAvisoEscritura(null);
      setModal(null);
    } catch (error) {
      setAvisoEscritura(explicarFallo(error));
    }
  }, []);

  const alBorrar = useCallback(async (id) => {
    try {
      await borrarEvento(id);
      setAvisoEscritura(null);
      setModal(null);
    } catch (error) {
      setAvisoEscritura(explicarFallo(error));
    }
  }, []);

  const alBorrarSerie = useCallback(async (serieId) => {
    try {
      await borrarSerie(serieId);
      setAvisoEscritura(null);
      setModal(null);
    } catch (error) {
      setAvisoEscritura(explicarFallo(error));
    }
  }, []);

  const aviso = fallo ?? avisoEscritura;

  // Se puede cerrar. Si el aviso cambia a otro distinto vuelve a salir, pero
  // el mismo mensaje no reaparece una vez que lo has descartado.
  const [avisoCerrado, setAvisoCerrado] = useState(false);
  useEffect(() => setAvisoCerrado(false), [aviso]);
  const avisoVisible = aviso && !avisoCerrado ? aviso : null;

  if (comprobando) return <div className="h-[100dvh] w-screen" />;
  if (sinSesion) return <LoginScreen />;

  /* ------------------------------- MÓVIL ------------------------------- */

  if (esMovil) {
    return (
      <div className="flex h-[100dvh] w-screen flex-col overflow-hidden">
        <div className="seguro-arriba flex shrink-0 items-center justify-between px-5 pb-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[16px] leading-none"
            style={{ background: 'var(--tinta)', color: 'var(--papel)', fontFamily: 'var(--font-serif)' }}
          >
            i
          </div>
          <div className="flex items-center gap-1">
            <BotonCabecera etiqueta={oscuro ? 'Tema claro' : 'Tema oscuro'} onClick={alternar}>
              {oscuro ? <Sun size={19} strokeWidth={1.6} /> : <Moon size={19} strokeWidth={1.6} />}
            </BotonCabecera>
            <BotonCabecera etiqueta="Nuevo evento" onClick={() => setModal({ fechaSugerida: foco })}>
              <Plus size={20} strokeWidth={1.8} />
            </BotonCabecera>
            {usuario && (
              <BotonCabecera etiqueta="Cerrar sesión" onClick={cerrarSesion}>
                <LogOut size={18} strokeWidth={1.6} />
              </BotonCabecera>
            )}
          </div>
        </div>

        {avisoVisible && <Aviso texto={avisoVisible} onCerrar={() => setAvisoCerrado(true)} />}

        {pantalla === 'agenda' && (
          <AgendaDia
            foco={foco}
            onFoco={setFoco}
            porDia={porDia}
            proximos={proximos}
            oscuro={oscuro}
            onAbrirEvento={(evento) => setModal({ evento })}
            onNuevo={(fechaSugerida) => setModal({ fechaSugerida })}
          />
        )}

        {pantalla === 'mes' && (
          <div className="flex min-h-0 grow flex-col gap-3 px-4 pb-4">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
                  {tituloMes(foco)}
                </span>
                <span className="text-[15px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--tinta-tenue)' }}>
                  {anioDe(foco)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <BotonCabecera etiqueta="Mes anterior" onClick={() => saltar(-1)}>
                  <ChevronLeft size={18} strokeWidth={1.7} />
                </BotonCabecera>
                <BotonCabecera etiqueta="Mes siguiente" onClick={() => saltar(1)}>
                  <ChevronRight size={18} strokeWidth={1.7} />
                </BotonCabecera>
              </div>
            </div>
            <VistaMes
              compacto
              foco={foco}
              porDia={porDia}
              oscuro={oscuro}
              onDia={(clave) => {
                setFoco(clave);
                setPantalla('agenda');
              }}
            />
          </div>
        )}

        {pantalla === 'habitos' && <Pendiente seccion="habitos" />}

        <BarraMovil pantalla={pantalla} onPantalla={setPantalla} onChat={() => setChatAbierto('voz')} />

        {chatAbierto && (
          <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--superficie)' }}>
            <div className="seguro-arriba shrink-0" />
            <PanelChat
              eventos={eventosProximos}
              oscuro={oscuro}
              autoEscuchar={chatAbierto === 'voz'}
              onCerrar={() => setChatAbierto(null)}
            />
          </div>
        )}

        {modal && (
          <ModalEvento
            evento={modal.evento}
            fechaSugerida={modal.fechaSugerida}
            oscuro={oscuro}
            onGuardar={alGuardar}
            onBorrar={alBorrar}
          onBorrarSerie={alBorrarSerie}
            onBorrarSerie={alBorrarSerie}
            onCerrar={() => setModal(null)}
          />
        )}
      </div>
    );
  }

  /* ----------------------------- ESCRITORIO ---------------------------- */

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden">
      <Rail
        vista={seccion}
        onVista={setSeccion}
        oscuro={oscuro}
        onTema={alternar}
        usuario={usuario}
        onSalir={cerrarSesion}
      />

      {seccion === 'calendario' ? (
        <div className="flex min-w-0 grow flex-col gap-4 px-8 pb-7 pt-[26px]">
          <CabeceraCalendario
            modo={modo}
            onModo={setModo}
            foco={foco}
            onAnterior={() => saltar(-1)}
            onSiguiente={() => saltar(1)}
            onHoy={() => setFoco(hoy())}
            onNuevo={() => setModal({ fechaSugerida: foco })}
          />

          {modo === 'mes' ? (
            <VistaMes
              foco={foco}
              porDia={porDia}
              oscuro={oscuro}
              onAbrirEvento={(evento) => setModal({ evento })}
              onNuevoEn={(fechaSugerida) => setModal({ fechaSugerida })}
            />
          ) : (
            <VistaSemana
              foco={foco}
              porDia={porDia}
              oscuro={oscuro}
              onAbrirEvento={(evento) => setModal({ evento })}
            />
          )}

          {avisoVisible && <Aviso texto={avisoVisible} onCerrar={() => setAvisoCerrado(true)} />}

          {!hayFirebase && (
            <p className="m-0 text-center text-[11.5px]" style={{ color: 'var(--tinta-tenue)' }}>
              Guardando en este navegador · conecta Firebase en .env.local para sincronizar
            </p>
          )}
        </div>
      ) : (
        <Pendiente seccion={seccion} />
      )}

      <PanelChat eventos={eventosProximos} oscuro={oscuro} />

      {modal && (
        <ModalEvento
          evento={modal.evento}
          fechaSugerida={modal.fechaSugerida}
          oscuro={oscuro}
          onGuardar={alGuardar}
          onBorrar={alBorrar}
          onBorrarSerie={alBorrarSerie}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Aviso({ texto, onCerrar }) {
  return (
    <div
      className="mx-4 flex items-start gap-2.5 rounded-[12px] py-3 pl-4 pr-2 text-[12.5px] leading-[1.5] md:mx-0"
      style={{ background: 'var(--superficie-3)', border: '1px solid var(--borde)', color: 'var(--ahora)' }}
    >
      <AlertCircle size={15} strokeWidth={1.8} className="mt-px shrink-0" />
      <span className="grow">{texto}</span>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar el aviso"
        className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ color: 'var(--tinta-suave)' }}
      >
        <X size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function BotonCabecera({ etiqueta, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex h-11 w-11 items-center justify-center rounded-xl"
      style={{ color: 'var(--tinta-suave)' }}
    >
      {children}
    </button>
  );
}

function Pendiente({ seccion }) {
  const textos = {
    habitos: ['Hábitos', 'Rachas de gimnasio y estudio. Llega en la fase 5.'],
    buscar: ['Buscar', 'Preguntarle a la IA por cualquier cosa que apuntaste. Llega con la fase 2.'],
  };
  const [titulo, detalle] = textos[seccion] ?? ['', ''];

  return (
    <div className="flex min-w-0 grow flex-col items-center justify-center gap-3 px-8">
      <h2 className="m-0 text-[32px] leading-none" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
        {titulo}
      </h2>
      <p className="m-0 max-w-[280px] text-center text-[13.5px]" style={{ color: 'var(--tinta-suave)' }}>
        {detalle}
      </p>
    </div>
  );
}
