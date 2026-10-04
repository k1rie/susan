import { notFound } from 'next/navigation';
import { PARAM_PASAR_LISTA } from '@/components/docente/pasarLista.utils.js';
import SesionClase from '@/components/sesion/SesionClase';

export const metadata = { title: 'Pasar lista | SUSAN' };

// ?pasar-lista=1 (contrato de llegada de /docente/pasar-lista y de la tarjeta «Pasar lista» del panel): la sesión ya está abierta y se
// llega a pasar lista, así que la pantalla muestra la guía de 3 pasos y enfoca la captura. Solo orienta la presentación.
export default async function PaginaSesion({ params, searchParams }) {
    const { id } = await params;
    const sp = await searchParams;
    const idSesion = Number(id);
    if (!Number.isInteger(idSesion) || idSesion <= 0) notFound();
    const valor = Array.isArray(sp?.[PARAM_PASAR_LISTA]) ? sp[PARAM_PASAR_LISTA][0] : sp?.[PARAM_PASAR_LISTA];
    return <SesionClase idSesion={idSesion} pasarLista={valor === '1' || valor === 'true'} />;
}
