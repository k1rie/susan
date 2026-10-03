'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Field from '@/components/ui/Field/Field.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import AvisoAltaCuentas from '../AvisoAltaCuentas/AvisoAltaCuentas.jsx';
import AvisoPrivacidad from '../AvisoPrivacidad/AvisoPrivacidad.jsx';
import PasswordInput from '../PasswordInput/PasswordInput.jsx';
import { MENSAJES_INFO } from './login.utils.js';
import useLoginForm from './useLoginForm.js';

export default function LoginForm({ next = null, mensaje = null }) {
    const f = useLoginForm({ next, mensaje });
    const info = MENSAJES_INFO[mensaje] ?? null;
    const avisoError = useRef(null);

    // El foco pasa al aviso de error para que se anuncie y quede a la vista.
    useEffect(() => {
        if (f.errorEnvio) avisoError.current?.focus();
    }, [f.errorEnvio]);

    return (
        <form onSubmit={f.enviar} noValidate className="flex flex-col gap-4">
            {info && <Alert tone={info.tone}>{info.texto}</Alert>}
            {f.errorEnvio && (
                <div ref={avisoError} tabIndex={-1}>
                    <Alert tone="danger">{f.errorEnvio}</Alert>
                </div>
            )}
            <Field label="Correo institucional" required error={f.errores.correo}>
                <Input
                    name="correo"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={f.correo}
                    onChange={(e) => f.setCorreo(e.target.value)}
                    disabled={f.cargando}
                />
            </Field>
            <Field label="Contraseña" required error={f.errores.contrasena}>
                <PasswordInput
                    name="contrasena"
                    value={f.contrasena}
                    onChange={(e) => f.setContrasena(e.target.value)}
                    disabled={f.cargando}
                />
            </Field>
            <Button type="submit" loading={f.cargando} fullWidth>
                Iniciar sesión
            </Button>
            <Link href="/recuperar" className="inline-flex min-h-11 items-center text-sm text-primary underline">
                ¿Olvidaste tu contraseña?
            </Link>
            <div className="flex flex-col gap-2 border-t border-border pt-3">
                <AvisoAltaCuentas />
                <AvisoPrivacidad />
            </div>
        </form>
    );
}
