'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { cerrarSesion, iniciarSesion } from '@/lib/api/auth.js';
import { rutaSegura } from './rutaSegura.js';
import { validarLogin } from './login.utils.js';

const INICIAL = { correo: '', contrasena: '' };

// Estado del inicio de sesión sobre `useFormulario`: los errores de campo salen al abandonarlo (o al enviar, con el foco en el primero),
// y el error del servidor queda en `errorEnvio` (es general: no se sabe si falló el correo o la contraseña, a propósito).
// Tras un error se conserva lo escrito (el correo y la contraseña): con «Mostrar» se corrige un dedazo sin volver a teclearlo todo, y
// vaciar la contraseña la dejaría marcada como «obligatoria» justo después de un intento.
export default function useLoginForm({ next = null, mensaje = null }) {
    const router = useRouter();
    // Tras un inicio correcto el botón sigue en «cargando» hasta que cambia la página: sin esto se podría pulsar dos veces.
    const [redirigiendo, setRedirigiendo] = useState(false);

    // Cuenta inactiva o sin perfil: se descarta la sesión huérfana para no entrar en bucle de redirecciones.
    useEffect(() => {
        if (mensaje === 'cuenta_inactiva' || mensaje === 'sin_cuenta') cerrarSesion();
    }, [mensaje]);

    const f = useFormulario({
        inicial: INICIAL,
        validar: validarLogin,
        onSubmit: async ({ correo, contrasena }) => {
            const me = await iniciarSesion({ correo: correo.trim(), contrasena });
            setRedirigiendo(true);
            router.replace(rutaSegura(next, me.home) || me.home || '/');
            router.refresh();
        },
    });

    return { ...f, cargando: f.enviando || redirigiendo };
}
