'use client';

import { ArrowLeft, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BrandMark from '@/components/layout/BrandMark/BrandMark.jsx';
import Button from '@/components/ui/Button';
import { useMe } from '@/hooks/data';
import { guardarPerfil } from '@/lib/perfil';
import CambiarContrasenaForm from '../CambiarContrasenaForm/CambiarContrasenaForm.jsx';
import { pasosDe } from './guia.js';
import PasoEstilo from './PasoEstilo.jsx';
import PasoGuia from './PasoGuia.jsx';
import PasoPrivacidad from './PasoPrivacidad.jsx';

// Asistente de bienvenida (referencia: el onboarding de registro de SchoolAI, con el marco de panel blanco de Dash).
//   modo 'activar'   → la persona llega por el enlace de invitación: crea su contraseña, elige su estilo, ve la guía de su rol y acepta el aviso
//   modo 'bienvenida' → cuenta ya activa: se puede volver a ver (estilo + guía + privacidad) desde el menú de cuenta
// Las preferencias (color del avatar) se guardan por navegador (lib/perfil.js); la contraseña va a Supabase Auth (api de auth).
export default function Onboarding({ modo = 'bienvenida' }) {
    const router = useRouter();
    const { me } = useMe();
    const pasos = pasosDe(modo);
    const [indice, setIndice] = useState(0);
    const [tinte, setTinte] = useState(null);
    const [aviso, setAviso] = useState(false);
    const titulo = useRef(null);
    const paso = pasos[indice];
    const ultimo = indice === pasos.length - 1;

    // Al cambiar de paso el foco pasa al título para que se anuncie y no se pierda el contexto.
    useEffect(() => {
        titulo.current?.focus();
    }, [indice]);

    const terminar = () => {
        if (tinte) guardarPerfil(me, { tinte });
        guardarPerfil(me, { avisoLeido: true, bienvenidaVista: true });
        router.replace(me?.home || '/');
        router.refresh();
    };
    const siguiente = () => {
        if (ultimo) terminar();
        else setIndice((i) => i + 1);
    };

    const puedeAvanzar = paso.id === 'privacidad' ? aviso || modo === 'bienvenida' : true;

    return (
        <div className="min-h-dvh bg-background px-3 py-3 sm:px-6 sm:py-6">
            <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col rounded-2xl border border-border/60 bg-card sm:min-h-[calc(100dvh-3rem)]">
                <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-8">
                    <BrandMark variant="compact" />
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        Paso {indice + 1} de {pasos.length}
                    </p>
                </header>

                <ol aria-label="Progreso" className="flex items-center gap-2 px-5 pt-5 sm:px-8">
                    {pasos.map((p, i) => {
                        const hecho = i < indice;
                        const actual = i === indice;
                        return (
                            <li key={p.id} className="flex flex-1 items-center gap-2" aria-current={actual ? 'step' : undefined}>
                                <span
                                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors duration-300 ${
                                        hecho ? 'bg-foreground text-background' : actual ? 'border-2 border-foreground text-foreground' : 'border border-input text-muted-foreground'
                                    }`}
                                >
                                    {hecho ? <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} /> : i + 1}
                                </span>
                                <span className={`hidden text-sm sm:block ${actual ? 'font-medium' : 'text-muted-foreground'}`}>{p.resumen}</span>
                                {i < pasos.length - 1 && <span aria-hidden="true" className={`h-px flex-1 transition-colors duration-300 ${hecho ? 'bg-foreground' : 'bg-border'}`} />}
                                <span className="sr-only">{hecho ? ' (completado)' : actual ? ' (actual)' : ' (pendiente)'}</span>
                            </li>
                        );
                    })}
                </ol>

                <main className="flex flex-1 flex-col px-5 pb-8 pt-8 sm:px-8">
                    <div key={paso.id} className="escena-entra mx-auto flex w-full max-w-xl flex-1 flex-col">
                        <h1 ref={titulo} tabIndex={-1} className="font-display text-[2rem] font-medium leading-tight tracking-tight outline-none sm:text-[2.5rem]">
                            {paso.titulo}
                        </h1>
                        <div className="mt-6 flex-1">
                            {paso.id === 'contrasena' && <CambiarContrasenaForm modo="activar" onExito={() => setIndice((i) => i + 1)} />}
                            {paso.id === 'estilo' && <PasoEstilo me={me} tinte={tinte} onTinte={setTinte} />}
                            {paso.id === 'guia' && <PasoGuia rol={me?.rol} />}
                            {paso.id === 'privacidad' && <PasoPrivacidad aviso={aviso} onAviso={setAviso} modo={modo} />}
                        </div>
                    </div>

                    {paso.id !== 'contrasena' && (
                        <div className="mx-auto mt-8 flex w-full max-w-xl items-center justify-between gap-3">
                            {indice > 0 ? (
                                <Button variant="ghost" onClick={() => setIndice((i) => i - 1)} icon={<ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                                    Atrás
                                </Button>
                            ) : (
                                <span />
                            )}
                            <Button onClick={siguiente} disabled={!puedeAvanzar} arrow={!ultimo}>
                                {ultimo ? (modo === 'activar' ? 'Empezar a usar SUSAN' : 'Listo') : 'Continuar'}
                            </Button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
