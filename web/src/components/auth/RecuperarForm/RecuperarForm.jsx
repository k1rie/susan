'use client';

import Link from 'next/link';
import { useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Field from '@/components/ui/Field/Field.jsx';
import Input from '@/components/ui/Input/Input.jsx';
import { recuperarContrasena } from '@/lib/api/auth.js';

const VOLVER = (
    <Link href="/login" className="inline-flex min-h-11 items-center self-start rounded-full px-1 text-sm font-medium text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
        Volver a iniciar sesión
    </Link>
);

export default function RecuperarForm() {
    const [correo, setCorreo] = useState('');
    const [errorCampo, setErrorCampo] = useState(null);
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [enviado, setEnviado] = useState(false);

    async function enviar(e) {
        e.preventDefault();
        if (cargando) return;
        const c = correo.trim();
        if (!c || !c.includes('@')) {
            setErrorCampo('Escribe un correo válido.');
            return;
        }
        setErrorCampo(null);
        setError(null);
        setCargando(true);
        try {
            await recuperarContrasena({ correo: c });
            setEnviado(true);
        } catch (err) {
            // Solo llegan DEMASIADOS_INTENTOS y ERROR_RED; el resto se muestra como éxito (anti-enumeración).
            setError(err?.message ?? 'No se pudo enviar la solicitud.');
        } finally {
            setCargando(false);
        }
    }

    if (enviado) {
        return (
            <div className="flex flex-col gap-4">
                <Alert tone="success">
                    Si el correo está registrado, recibirás un mensaje con instrucciones para restablecer tu contraseña. Revisa también
                    tu carpeta de spam.
                </Alert>
                {VOLVER}
            </div>
        );
    }
    return (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Correo institucional" required error={errorCampo}>
                <Input
                    name="correo"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    disabled={cargando}
                />
            </Field>
            <Button type="submit" loading={cargando} fullWidth arrow>
                Enviar instrucciones
            </Button>
            {VOLVER}
        </form>
    );
}
