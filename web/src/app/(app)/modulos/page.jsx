import PageHeader from '@/components/layout/PageHeader';
import CatalogoModulos from '@/components/home/CatalogoModulos';
import { requerirSesion } from '@/lib/server/auth';

export const metadata = { title: 'Módulos' };

// Catálogo de todo lo que el rol puede usar hoy y lo que viene (registro: lib/modulos.js). ?filtro=pronto abre ese filtro.
export default async function PaginaModulos({ searchParams }) {
    const me = await requerirSesion();
    const sp = await searchParams;
    const filtro = Array.isArray(sp.filtro) ? sp.filtro[0] : sp.filtro;
    return (
        <div>
            <PageHeader title="Módulos" subtitle="Todo lo que puedes hacer en SUSAN con tu rol y lo que viene en camino." />
            <CatalogoModulos rol={me.rol} filtroInicial={filtro || 'todos'} />
        </div>
    );
}
