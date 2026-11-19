'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert/Alert.jsx';
import Button from '@/components/ui/Button/Button.jsx';
import CampoPassword from '@/components/ui/CampoPassword/CampoPassword.jsx';
import Field from '@/components/ui/Field/Field.jsx';
import Spinner from '@/components/ui/Spinner/Spinner.jsx';
import { useToast } from '@/components/ui/Toast/Toast.jsx';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { cambiarContrasena, obtenerSesion, suscribirCambioAuth } from '@/lib/api/auth.js';
import { mensajeContrasena, TEXTO_ERROR_CONTRASENA } from './contrasena.utils.js';

const ESPERA_SESION_MS = 3000;

const INICIAL = { nueva: '' };
const validar = ({ nueva }) => ({ nueva: mensajeContrasena(nueva) });
// El servidor rechaza la contraseña por su política o por ser igual a la actual: el aviso va pegado al campo, con el foco en él.
const mapearError = (err) => (TEXTO_ERROR_CONTRASENA[err?.code] ? { nueva: TEXTO_ERROR_CONTRASENA[err.code] } : null);

// modo: 'cambiar' (recuperación o cambio voluntario) | 'activar' (primera contraseña de una cuenta creada por el administrador).
// `onExito`: si se pasa (onboarding), se llama al guardar en lugar de mostrar el aviso y redirigir al inicio.
// Un solo campo (CampoPassword): con «Mostrar» y la lista de requisitos en vivo («N de 3») sobra el doble tecleo.
// Mientras envía el campo queda `readOnly` y no `disabled`: un campo deshabilitado no puede recibir el foco, y el error del servidor lo necesita.
export default function CambiarContrasenaForm({ modo = 'cambiar', onExito }) {
    const activar = modo === 'activar';
    const router = useRouter();
    const { toast } = useToast();
    // 'verificando' | 'sin_sesion' | 'listo'
    const [estado, setEstado] = useState('verificando');
    const [hecho, setHecho] = useState(false);

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

    const f = useFormulario({
        inicial: INICIAL,
        validar,
        mapearError,
        onSubmit: async ({ nueva }) => {
            try {
                await cambiarContrasena({ contrasena: nueva });
            } catch (err) {
                if (err?.code === 'NO_AUTENTICADO') {
                    setEstado('sin_sesion');
                    return;
                }
                throw err;
            }
            // Tras guardar, el botón queda en «cargando» hasta que cambie la pantalla: así no se puede pulsar dos veces.
            setHecho(true);
            if (onExito) {
                onExito();
                return;
            }
            toast({ tone: 'success', message: activar ? 'Cuenta activada' : 'Contraseña actualizada' });
            router.replace('/');
        },
    });
    const nueva = f.campo('nueva');
    const cargando = f.enviando || hecho;

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
        <form onSubmit={f.enviar} noValidate className="flex flex-col gap-4">
            {f.errorEnvio && <Alert tone="danger">{f.errorEnvio.message ?? 'No se pudo actualizar la contraseña.'}</Alert>}
            <Field label={activar ? 'Crea tu contraseña' : 'Nueva contraseña'} required error={nueva.error}>
                <CampoPassword {...nueva.props} autoFocus readOnly={cargando} />
            </Field>
            <Button type="submit" loading={cargando} fullWidth arrow>
                {activar ? 'Activar mi cuenta' : 'Guardar contraseña'}
            </Button>
        </form>
    );
}
