'use client';

import { MailCheck, PencilLine, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Field from '@/components/ui/Field/Field.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { recuperarContrasena } from '@/lib/api/auth.js';
import { LIMITES } from '@/lib/formularios';
import { EJEMPLO_CORREO, mensajeCorreo } from '../LoginForm/login.utils.js';
import useEnfriamiento from './useEnfriamiento.js';

// Espera entre un envío y el siguiente: el servidor ya limita los intentos; esto evita que se vuelva a pulsar «Reenviar» por
// impaciencia (el correo puede tardar) y da un respiro visible en lugar de un error de «demasiados intentos».
const SEGUNDOS_ESPERA = 60;

const INICIAL = { correo: '' };
const validar = ({ correo }) => ({ correo: mensajeCorreo(correo, { vacio: 'Escribe el correo de tu cuenta.' }) });

const ENLACE =
    'inline-flex min-h-11 items-center self-start rounded-md px-1 text-sm font-medium text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30';

function VolverALogin() {
    return (
        <Link href="/login" className={ENLACE}>
            Volver a iniciar sesión
        </Link>
    );
}

// Mientras envía el campo queda `readOnly` (no `disabled`): conserva el foco y el lector de pantalla no pierde su lugar.
export default function RecuperarForm() {
    // Correo al que se envió el enlace; null = se muestra el formulario.
    const [enviadoA, setEnviadoA] = useState(null);
    const [aviso, setAviso] = useState(null); // resultado de «Reenviar»: { tono, texto }
    const [reenviando, setReenviando] = useState(false);
    const espera = useEnfriamiento(SEGUNDOS_ESPERA);
    const titulo = useRef(null);

    const f = useFormulario({
        inicial: INICIAL,
        validar,
        // Solo llegan DEMASIADOS_INTENTOS y ERROR_RED; el resto se trata como éxito (anti-enumeración: nunca se dice si el correo existe).
        onSubmit: async ({ correo }) => {
            const c = correo.trim();
            await recuperarContrasena({ correo: c });
            setEnviadoA(c);
            setAviso(null);
            espera.iniciar();
        },
    });
    const correo = f.campo('correo');

    // La pantalla de éxito reemplaza al formulario: el foco va a su título para que se anuncie y no se pierda el contexto.
    useEffect(() => {
        if (enviadoA) titulo.current?.focus();
    }, [enviadoA]);

    const reenviar = async () => {
        if (espera.activo || reenviando) return;
        setReenviando(true);
        setAviso(null);
        try {
            await recuperarContrasena({ correo: enviadoA });
            espera.iniciar();
            setAviso({ tono: 'success', texto: 'Te enviamos el enlace otra vez.' });
        } catch (err) {
            setAviso({ tono: 'danger', texto: err?.message ?? 'No se pudo reenviar el enlace.' });
        } finally {
            setReenviando(false);
        }
    };

    if (enviadoA) {
        return (
            <div className="flex flex-col gap-5">
                <div aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-presente-bg text-presente">
                    <MailCheck className="size-6" strokeWidth={1.75} />
                </div>
                <div className="flex flex-col gap-2">
                    <h2 ref={titulo} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
                        Revisa tu correo
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Si <strong className="break-all font-medium text-foreground">{enviadoA}</strong> está registrado, te enviamos un enlace para restablecer tu contraseña. Puede tardar unos minutos: revisa también la carpeta de spam.
                    </p>
                </div>
                {aviso && <Alert tone={aviso.tono}>{aviso.texto}</Alert>}
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                        variant="secondary"
                        onClick={reenviar}
                        loading={reenviando}
                        disabled={espera.activo}
                        icon={<RefreshCw aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                    >
                        {espera.activo ? `Reenviar en ${espera.restante} s` : 'Reenviar enlace'}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setEnviadoA(null);
                            setAviso(null);
                        }}
                        icon={<PencilLine aria-hidden="true" className="size-4" strokeWidth={1.75} />}
                    >
                        Usar otro correo
                    </Button>
                </div>
                {/* Texto fijo durante la espera: se anuncia al empezar y al terminar, no cada segundo. */}
                <p role="status" className="sr-only">
                    {espera.activo ? `Podrás reenviar el enlace en ${SEGUNDOS_ESPERA} segundos.` : 'Ya puedes reenviar el enlace.'}
                </p>
                <VolverALogin />
            </div>
        );
    }
    return (
        <form onSubmit={f.enviar} noValidate className="flex flex-col gap-3">
            {f.errorEnvio && <Alert tone="danger">{f.errorEnvio.message ?? 'No se pudo enviar la solicitud.'}</Alert>}
            <Field label="Correo institucional" required error={correo.error} reserveError>
                <Input
                    {...correo.props}
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    transform="trim"
                    maxLength={LIMITES.correo}
                    placeholder={EJEMPLO_CORREO}
                    readOnly={f.enviando}
                />
            </Field>
            <Button type="submit" loading={f.enviando} fullWidth arrow>
                Enviar instrucciones
            </Button>
            <VolverALogin />
        </form>
    );
}
