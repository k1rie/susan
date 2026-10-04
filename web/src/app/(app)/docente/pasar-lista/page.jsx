import PasarLista from '@/components/docente/PasarLista';

export const metadata = { title: 'Pasar lista | SUSAN' };

// Deep link: ?sesion=<id> abre esa sesión y entra a pasar lista (la tarjeta principal del panel enlaza así). Sin parámetro, la
// pantalla elige sola o muestra las sesiones disponibles. Un valor que no sea un id entero positivo se ignora.
export default async function PaginaPasarLista({ searchParams }) {
    const sp = await searchParams;
    const id = Number(sp?.sesion);
    return <PasarLista idSesionInicial={Number.isInteger(id) && id > 0 ? id : null} />;
}
