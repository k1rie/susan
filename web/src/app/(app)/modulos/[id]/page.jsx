import { notFound, redirect } from 'next/navigation';
import ModuloProximamente from '@/components/home/ModuloProximamente';
import { requerirSesion } from '@/lib/server/auth';
import { buscarModulo, puedeVer } from '@/lib/modulos.js';

export async function generateMetadata({ params }) {
    const { id } = await params;
    const modulo = buscarModulo(id);
    return { title: modulo ? modulo.titulo : 'Módulo' };
}

// /modulos/[id]: un módulo activo redirige a su pantalla; uno de la hoja de ruta muestra «Pronto». Si el id no existe
// o el rol no lo ve, 404 (no se revela qué módulos existen para otros roles).
export default async function PaginaModulo({ params }) {
    const { id } = await params;
    const me = await requerirSesion();
    const modulo = buscarModulo(id);
    if (!modulo || !puedeVer(modulo, me.rol)) notFound();
    if (modulo.estado === 'activo') redirect(modulo.href);
    return <ModuloProximamente modulo={modulo} />;
}
