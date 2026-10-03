'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import Field from '@/components/ui/Field/Field.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useToast } from '@/components/ui/Toast/Toast.jsx';
import { cambiarContrasena, obtenerSesion, suscribirCambioAuth } from '@/lib/api/auth.js';
import PasswordInput from '../PasswordInput/PasswordInput.jsx';
import ReglasContrasena from '../ReglasContrasena/ReglasContrasena.jsx';
import { TEXTO_ERROR_CONTRASENA, validarContrasena } from './contrasena.utils.js';

const ESPERA_SESION_MS = 3000;

// modo: 'cambiar' (recuperación o cambio voluntario) | 'activar' (primera contraseña de una cuenta creada por el administrador).
// `onExito`: si se pasa (onboarding), se llama al guardar en lugar de mostrar el aviso y redirigir al inicio.
export default function CambiarContrasenaForm({ modo = 'cambiar', onExito }) {
    const activar = modo === 'activar';
    const router = useRouter();
    const { toast } = useToast();
    // 'verificando' | 'sin_sesion' | 'listo'
    const [estado, setEstado] = useState('verificando');
    const [nueva, setNueva] = useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [errores, setErrores] = useState({});
    const [error, setError] = useState(null);
    const [cargando, setCargando] = useState(false);

    // El token de recuperación lo procesa el cliente de Auth al cargar: se espera hasta 3 s a que haya sesión.
    useEffect(() => {
        let activo = true;
        let baja = () => {};
        const ok = () => activo && setEstado('listo');
        (async () => {
            try {
                baja = await suscribirCambioAuth(({ autenticado }) => autenticado && ok());
                if ((await obtenerSesion()).autenticado) ok();
            } catch {
                // se resuelve por el temporizador
            }
        })();
        const t = setTimeout(() => activo && setEstado((s) => (s === 'verificando' ? 'sin_sesion' : s)), ESPERA_SESION_MS);
        return () => {
            activo = false;
            clearTimeout(t);
            baja();
        };
    }, []);

    async function enviar(e) {
        e.preventDefault();
        if (cargando) return;
        const v = validarContrasena(nueva, confirmacion);
        setErrores(v);
        setError(null);
        if (Object.keys(v).length) return;
        setCargando(true);
        try {
            await cambiarContrasena({ contrasena: nueva });
            if (onExito) {
                onExito();
                return;
            }
            toast({ tone: 'success', message: activar ? 'Cuenta activada' : 'Contraseña actualizada' });
            router.replace('/');
        } catch (err) {
            if (err?.code === 'NO_AUTENTICADO') setEstado('sin_sesion');
            else setError(TEXTO_ERROR_CONTRASENA[err?.code] ?? err?.message ?? 'No se pudo actualizar la contraseña.');
            setCargando(false);
        }
    }

    if (estado === 'verificando') {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner label="Verificando enlace" /> Verificando enlace…
            </div>
        );
    }
    if (estado === 'sin_sesion') {
        return (
            <div className="flex flex-col gap-4">
                <Alert tone="danger">
                    {activar ? 'El enlace de invitación expiró o no es válido. Pide a Coordinación que te envíe uno nuevo.' : 'El enlace expiró o no es válido. Solicita uno nuevo.'}
                </Alert>
                <Link href={activar ? '/login' : '/recuperar'} className="inline-flex min-h-11 items-center self-start rounded-full px-1 text-sm font-medium text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                    {activar ? 'Ir a iniciar sesión' : 'Solicitar un enlace nuevo'}
                </Link>
            </div>
        );
    }
    return (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label={activar ? 'Crea tu contraseña' : 'Nueva contraseña'} required error={errores.nueva}>
                <PasswordInput name="nueva" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} disabled={cargando} />
            </Field>
            <Field label="Confirmar contraseña" required error={errores.confirmacion}>
                <PasswordInput
                    name="confirmacion"
                    autoComplete="new-password"
                    value={confirmacion}
                    onChange={(e) => setConfirmacion(e.target.value)}
                    disabled={cargando}
                />
            </Field>
            <ReglasContrasena nueva={nueva} confirmacion={confirmacion} />
            <Button type="submit" loading={cargando} fullWidth arrow>
                {activar ? 'Activar mi cuenta' : 'Guardar contraseña'}
            </Button>
        </form>
    );
}
