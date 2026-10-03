'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cerrarSesion, iniciarSesion } from '@/lib/api/auth.js';
import { rutaSegura } from './rutaSegura.js';
import { textoErrorLogin, validarLogin } from './login.utils.js';

export default function useLoginForm({ next = null, mensaje = null }) {
    const router = useRouter();
    const [correo, setCorreo] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [errores, setErrores] = useState({});
    const [errorEnvio, setErrorEnvio] = useState(null);
    const [cargando, setCargando] = useState(false);
    const enVuelo = useRef(false);

    // Cuenta inactiva o sin perfil: se descarta la sesión huérfana para no entrar en bucle de redirecciones.
    useEffect(() => {
        if (mensaje === 'cuenta_inactiva' || mensaje === 'sin_cuenta') cerrarSesion();
    }, [mensaje]);

    async function enviar(e) {
        e?.preventDefault?.();
        if (enVuelo.current) return;
        const v = validarLogin({ correo, contrasena });
        setErrores(v);
        setErrorEnvio(null);
        if (Object.keys(v).length) return;
        enVuelo.current = true;
        setCargando(true);
        try {
            const me = await iniciarSesion({ correo, contrasena });
            router.replace(rutaSegura(next, me.home) || me.home || '/');
            router.refresh();
        } catch (err) {
            setErrorEnvio(textoErrorLogin(err));
            setContrasena('');
            setCargando(false);
        } finally {
            enVuelo.current = false;
        }
    }

    return { correo, setCorreo, contrasena, setContrasena, errores, errorEnvio, cargando, enviar };
}
