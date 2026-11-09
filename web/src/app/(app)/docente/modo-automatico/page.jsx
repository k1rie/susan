import ModoAutomatico from '@/components/docente/ModoAutomatico';

export const metadata = { title: 'Modo automático | SUSAN' };

// ?iniciar=1 arranca sin el botón «Iniciar» (kiosco de la Raspberry, que ya corre a pantalla completa).
export default async function PaginaModoAutomatico({ searchParams }) {
    const sp = await searchParams;
    const valor = Array.isArray(sp?.iniciar) ? sp.iniciar[0] : sp?.iniciar;
    return <ModoAutomatico iniciarAlCargar={valor === '1' || valor === 'true'} />;
}
