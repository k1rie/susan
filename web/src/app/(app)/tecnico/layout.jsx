import { requerirSesion } from '@/lib/server/auth';

// Guarda del area tecnica: solo el rol tecnico (el administrador ve parametros e indice desde sus propias rutas).
export default async function TecnicoLayout({ children }) {
    await requerirSesion(['tecnico']);
    return children;
}
