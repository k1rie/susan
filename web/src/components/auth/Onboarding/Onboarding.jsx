'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BrandMark from '@/components/layout/BrandMark/BrandMark.jsx';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import Stepper from '@/components/ui/Stepper';
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
// La barra de acciones va al final del contenido y NO pegada al borde inferior: el <body> de la app tiene overflow-x oculto, y eso anula
// `position: sticky` en una página que desplaza con la ventana (en el AppShell sí funciona porque desplaza su propio contenedor).
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
    // El botón queda apagado solo mientras falte el acuse, y lo dice junto al botón en lugar de dejar a la persona adivinando.
    const motivoBloqueo = puedeAvanzar ? undefined : 'Marca «He leído el aviso de privacidad» para terminar.';
    // Una vez guardada la contraseña no se vuelve a ese paso (la sesión ya está activada): «Atrás» no lleva a él.
    const puedeVolver = indice > 0 && pasos[indice - 1].id !== 'contrasena';
    const pasosVista = pasos.map((p) => ({ id: p.id, label: p.resumen, disabled: p.id === 'contrasena' }));
    const irAPaso = (id) => {
        const i = pasos.findIndex((p) => p.id === id);
        if (i >= 0) setIndice(i);
    };

    return (
        <div className="min-h-dvh bg-background px-3 py-3 sm:px-6 sm:py-6">
            <div className="mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col rounded-2xl border border-border/60 bg-card sm:min-h-[calc(100dvh-3rem)]">
                <header className="flex items-center gap-4 border-b border-border/70 px-5 py-4 sm:px-8">
                    <BrandMark variant="compact" />
                </header>

                <div className="px-5 pt-5 sm:px-8">
                    <Stepper steps={pasosVista} current={indice} onSelect={irAPaso} />
                    {/* El foco ya va al título; esto añade «Paso N de M» para quien usa lector de pantalla (no se repite en la barra visible). */}
                    <p className="sr-only" aria-live="polite">
                        Paso {indice + 1} de {pasos.length}: {paso.titulo}
                    </p>
                </div>

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
                        <FormActions sticky={false} motivoBloqueo={motivoBloqueo} className="mx-auto mt-8 max-w-xl">
                            {puedeVolver && (
                                <Button variant="ghost" onClick={() => setIndice((i) => i - 1)} icon={<ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />}>
                                    Atrás
                                </Button>
                            )}
                            <Button onClick={siguiente} disabled={!puedeAvanzar} arrow={!ultimo}>
                                {ultimo ? (modo === 'activar' ? 'Empezar a usar SUSAN' : 'Listo') : 'Continuar'}
                            </Button>
                        </FormActions>
                    )}
                </main>
            </div>
        </div>
    );
}
