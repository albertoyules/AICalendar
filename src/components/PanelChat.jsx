import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUp, Mic, RotateCcw, Sparkles, Square, Volume2, VolumeX, X } from 'lucide-react';

import Markdown from './Markdown';
import { coloresDe } from '../config/categorias';
import { hayDictado, useDictado } from '../hooks/useDictado';
import { hayVoz, useVoz } from '../hooks/useVoz';
import { useConversacion } from '../hooks/useConversacion';
import { claveDe, cuantoFalta, horaDe, sumarDias, tituloDia, hoy } from '../lib/fechas';

const TRABAJANDO = {
  consultar_agenda: 'Mirando la agenda',
  crear_evento: 'Apuntándolo',
  editar_evento: 'Cambiándolo',
  borrar_evento: 'Borrándolo',
};

export default function PanelChat({ eventos, oscuro, onCerrar, autoEscuchar }) {
  const { visibles, estado, herramienta, error, enviar, reiniciar, descartarError, hayConversacion } =
    useConversacion();
  const voz = useVoz();

  const [borrador, setBorrador] = useState('');
  const fondo = useRef(null);
  const ultimoDicho = useRef(-1);

  const ocupado = estado !== 'listo';

  // Lo dictado se manda solo: si has hablado, ya has dicho lo que querías.
  const dictado = useDictado({ alTerminar: (texto) => enviar(texto) });

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: 'smooth' });
  }, [visibles.length, estado, dictado.parcial]);

  // El móvil abre el chat ya escuchando: has pulsado el micro para hablar,
  // no para leer una pantalla.
  useEffect(() => {
    if (autoEscuchar && hayDictado) dictado.empezar();
    // Solo al montar: rearrancar el dictado en cada render sería un infierno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leer en voz alta cada respuesta nueva, una sola vez.
  useEffect(() => {
    const ultima = visibles[visibles.length - 1];
    if (!ultima || ultima.quien !== 'ia' || ultima.id === ultimoDicho.current) return;
    ultimoDicho.current = ultima.id;
    voz.decir(ultima.texto);
  }, [visibles, voz]);

  const mandar = (e) => {
    e?.preventDefault();
    if (ocupado || !borrador.trim()) return;
    voz.callar();
    enviar(borrador);
    setBorrador('');
  };

  const alTeclear = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      mandar(e);
    }
  };

  const pulsarMicro = () => {
    voz.callar(); // si estaba hablando, que se calle y te escuche
    dictado.alternar();
  };

  const enElCampo = dictado.escuchando ? dictado.parcial : borrador;

  return (
    <div
      className="flex w-full shrink-0 flex-col md:w-[380px]"
      style={{ background: 'var(--superficie)', borderLeft: '1px solid var(--borde)' }}
    >
      {/* cabecera */}
      <div
        className="flex items-center justify-between px-6 pb-4 pt-[22px]"
        style={{ borderBottom: '1px solid var(--borde-suave)' }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles size={17} strokeWidth={0} fill="currentColor" style={{ color: 'var(--tinta)' }} />
          <span className="text-[14.5px] font-semibold">Asistente</span>
        </div>

        <div className="flex items-center gap-1">
          {hayVoz && (
            <BotonCabecera
              etiqueta={voz.activada ? 'Dejar de leer en voz alta' : 'Leer las respuestas en voz alta'}
              onClick={voz.activada ? () => { voz.callar(); voz.alternar(); } : voz.alternar}
              activo={voz.activada}
            >
              {voz.activada ? <Volume2 size={17} strokeWidth={1.7} /> : <VolumeX size={17} strokeWidth={1.7} />}
            </BotonCabecera>
          )}
          {hayConversacion && (
            <BotonCabecera etiqueta="Empezar de cero" onClick={reiniciar} desactivado={ocupado}>
              <RotateCcw size={16} strokeWidth={1.7} />
            </BotonCabecera>
          )}
          {!hayConversacion && !onCerrar && (
            <span className="pl-1 text-[12px]" style={{ color: 'var(--tinta-tenue)' }}>
              {tituloDia(hoy())}
            </span>
          )}
          {onCerrar && (
            <BotonCabecera etiqueta="Cerrar el asistente" onClick={() => { dictado.cancelar(); voz.callar(); onCerrar(); }}>
              <X size={19} strokeWidth={1.7} />
            </BotonCabecera>
          )}
        </div>
      </div>

      {/* conversación */}
      <div ref={fondo} className="scroll-fino flex min-h-0 grow flex-col justify-end overflow-y-auto">
        <div className="flex flex-col gap-4 px-6 py-[22px]">
          {hayConversacion ? (
            visibles.map((m) =>
              m.quien === 'usuario' ? (
                <div key={m.id} className="flex justify-end">
                  <div
                    className="max-w-[268px] whitespace-pre-wrap rounded-[14px] rounded-br-[4px] px-4 py-3 text-[13.5px] leading-[1.5]"
                    style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
                  >
                    {m.texto}
                  </div>
                </div>
              ) : (
                <div
                  key={m.id}
                  className="whitespace-pre-wrap rounded-[14px] rounded-bl-[4px] px-4 py-3.5 text-[13.5px] leading-[1.55]"
                  style={{ background: 'var(--superficie-3)' }}
                >
                  <Markdown texto={m.texto} oscuro={oscuro} />
                </div>
              ),
            )
          ) : (
            <Apertura eventos={eventos} oscuro={oscuro} />
          )}

          {ocupado && (
            <div className="flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--tinta-tenue)' }}>
              <Puntos />
              {estado === 'trabajando' ? (TRABAJANDO[herramienta] ?? 'Trabajando') : 'Pensando'}
            </div>
          )}

          {voz.hablando && (
            <button
              type="button"
              onClick={voz.callar}
              className="flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[12px]"
              style={{ border: '1px solid var(--borde)', color: 'var(--tinta-suave)' }}
            >
              <Square size={11} strokeWidth={2.4} fill="currentColor" />
              Callar
            </button>
          )}

          {(error || dictado.error) && (
            <Banda
              texto={error ?? dictado.error}
              onCerrar={error ? descartarError : dictado.descartarError}
            />
          )}
        </div>
      </div>

      {/* entrada */}
      <form onSubmit={mandar} className="px-5 pb-5 pt-4" style={{ borderTop: '1px solid var(--borde-suave)' }}>
        <div
          className="flex items-end gap-2 rounded-[20px] py-2 pl-[18px] pr-2"
          style={{
            background: dictado.escuchando ? 'var(--eco-fondo)' : 'var(--superficie-3)',
            border: `1px solid ${dictado.escuchando ? 'var(--eco-borde)' : 'var(--borde)'}`,
          }}
        >
          <textarea
            rows={1}
            value={enElCampo}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={alTeclear}
            placeholder={hayDictado ? 'Cuéntame qué tienes, o habla' : 'Cuéntame qué tienes'}
            disabled={ocupado || dictado.escuchando}
            className="max-h-28 grow resize-none bg-transparent py-1.5 text-[13.5px] leading-[1.5] outline-none disabled:opacity-100"
            style={{ color: dictado.escuchando ? 'var(--ahora)' : 'var(--tinta)', fontSize: '13.5px' }}
          />

          {dictado.escuchando ? (
            <button
              type="button"
              onClick={dictado.parar}
              aria-label="Terminar de hablar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full md:h-9 md:w-9"
              style={{ background: 'var(--ahora)', color: '#fff' }}
            >
              <Square size={14} strokeWidth={2.4} fill="currentColor" />
            </button>
          ) : (
            <button
              type={borrador.trim() ? 'submit' : 'button'}
              onClick={borrador.trim() ? undefined : pulsarMicro}
              disabled={ocupado || (!borrador.trim() && !hayDictado)}
              aria-label={borrador.trim() ? 'Enviar' : 'Hablar'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-30 md:h-9 md:w-9"
              style={{ background: 'var(--tinta)', color: 'var(--papel)' }}
            >
              {borrador.trim() ? <ArrowUp size={17} strokeWidth={2} /> : <Mic size={17} strokeWidth={1.6} />}
            </button>
          )}
        </div>

        <p className="m-0 mt-2.5 text-center text-[11.5px]" style={{ color: 'var(--tinta-tenue)' }}>
          {dictado.escuchando
            ? 'Te escucho · pulsa el cuadrado cuando acabes'
            : hayDictado
              ? 'Pulsa el micro y habla'
              : 'Tu navegador no permite dictar; escribe y ya está'}
        </p>
      </form>
    </div>
  );
}

function BotonCabecera({ etiqueta, onClick, children, activo, desactivado }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivado}
      title={etiqueta}
      aria-label={etiqueta}
      className="flex h-11 w-11 items-center justify-center rounded-lg disabled:opacity-40 md:h-9 md:w-9"
      style={{ color: activo ? 'var(--tinta)' : 'var(--tinta-suave)' }}
    >
      {children}
    </button>
  );
}

function Banda({ texto, onCerrar }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-[11px] py-3 pl-3.5 pr-1.5 text-[12.5px] leading-[1.5]"
      style={{ background: 'var(--superficie-3)', color: 'var(--ahora)' }}
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
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

/** Lo que se ve antes de escribir nada: el resumen de hoy y lo que viene. */
function Apertura({ eventos, oscuro }) {
  const claveHoy = hoy();
  const deHoy = eventos.filter((e) => claveDe(e.inicio) === claveHoy);
  const manana = sumarDias(claveHoy, 1);
  const proximos = eventos
    .filter((e) => e.inicio >= manana)
    .filter((e) => e.categoria === 'universidad' || e.categoria === 'salud')
    .slice(0, 2);

  return (
    <>
      <div
        className="rounded-[14px] rounded-bl-[4px] px-4 py-3.5 text-[13.5px] leading-[1.55]"
        style={{ background: 'var(--superficie-3)' }}
      >
        {deHoy.length === 0 ? (
          <>Hoy no tienes nada apuntado.</>
        ) : (
          <>
            Hoy tienes <strong className="font-semibold">{deHoy.length}</strong>{' '}
            {deHoy.length === 1 ? 'cosa' : 'cosas'}:{' '}
            {deHoy
              .map((e) => {
                const hora = horaDe(e.inicio);
                return hora ? `${e.titulo} a las ${hora}` : e.titulo;
              })
              .join(', ')}
            .
          </>
        )}
      </div>

      {proximos.length > 0 && (
        <div className="flex flex-col gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.09em]"
            style={{ color: 'var(--tinta-tenue)' }}
          >
            Vence pronto
          </span>
          {proximos.map((evento) => {
            const c = coloresDe(evento.categoria, oscuro);
            return (
              <div
                key={evento.id}
                className="flex items-center justify-between gap-3 rounded-[11px] px-3.5 py-3"
                style={{ background: c.fondo, border: `1px solid ${c.borde}` }}
              >
                <span className="truncate text-[13.5px] font-semibold" style={{ color: c.texto }}>
                  {evento.titulo}
                </span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                  style={{ background: 'var(--superficie)', color: c.texto }}
                >
                  {cuantoFalta(evento.inicio)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Puntos() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--tinta-fantasma)', animation: `latido 1.2s ${i * 0.16}s infinite ease-in-out` }}
        />
      ))}
      <style>{`@keyframes latido { 0%, 60%, 100% { opacity: 0.25 } 30% { opacity: 1 } }`}</style>
    </span>
  );
}
