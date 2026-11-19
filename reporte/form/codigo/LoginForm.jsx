'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import CampoPassword from '@/components/ui/CampoPassword/CampoPassword.jsx';
import Field from '@/components/ui/Field/Field.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { enfocarPrimerError } from '@/hooks/ui/formulario.utils.js';
import { LIMITES } from '@/lib/formularios';
import AvisoAltaCuentas from '../AvisoAltaCuentas/AvisoAltaCuentas.jsx';
import AvisoPrivacidad from '../AvisoPrivacidad/AvisoPrivacidad.jsx';
import { EJEMPLO_CORREO, MENSAJES_INFO, textoErrorLogin } from './login.utils.js';
import useLoginForm from './useLoginForm.js';

// Los márgenes negativos compensan el relleno vertical: el blanco táctil mide ~32 px sin agrandar la fila de la etiqueta ni descuadrarla.
const ENLACE =
    '-my-1.5 inline-flex items-center rounded-md px-1 py-1.5 text-[13px] font-medium text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30';

// Mientras envía los campos quedan `readOnly` (no `disabled`): conservan el foco y el lector de pantalla no pierde su lugar.
export default function LoginForm({ next = null, mensaje = null }) {
    const f = useLoginForm({ next, mensaje });
    const info = MENSAJES_INFO[mensaje] ?? null;
    const formulario = useRef(null);
    const correo = f.campo('correo');
    const contrasena = f.campo('contrasena');

    // Tras un error del servidor el foco va a la contraseña con su texto seleccionado: lo siguiente que se teclea la reemplaza
    // (el aviso se anuncia solo, es role="alert").
    useEffect(() => {
        if (f.errorEnvio) enfocarPrimerError(formulario.current, { contrasena: true })?.select?.();
    }, [f.errorEnvio]);

    return (
        <form ref={formulario} onSubmit={f.enviar} noValidate className="flex flex-col gap-3">
            {info && <Alert tone={info.tone}>{info.texto}</Alert>}
            {f.errorEnvio && <Alert tone="danger">{textoErrorLogin(f.errorEnvio)}</Alert>}
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
                    readOnly={f.cargando}
                />
            </Field>
            <Field
                label="Contraseña"
                required
                error={contrasena.error}
                reserveError
                labelAction={
                    <Link href="/recuperar" className={ENLACE}>
                        ¿Olvidaste tu contraseña?
                    </Link>
                }
            >
                <CampoPassword {...contrasena.props} autoComplete="current-password" reglas={false} readOnly={f.cargando} />
            </Field>
            <Button type="submit" loading={f.cargando} fullWidth arrow>
                Iniciar sesión
            </Button>
            <div className="mt-2 flex flex-col gap-4">
                <AvisoAltaCuentas />
                <AvisoPrivacidad />
            </div>
        </form>
    );
}
