import HomeRol from '@/components/home/HomeRol';
import ConsolaTecnico from '@/components/tecnico/ConsolaTecnico';
import { requerirSesion } from '@/lib/server/auth';

export const metadata = { title: 'Consola técnica | SUSAN' };

// Comparten la consola el técnico (edita) y el administrador (solo consulta).
export default async function PaginaConsolaTecnico() {
    const me = await requerirSesion('tecnico');
    return (
        <HomeRol>
            <ConsolaTecnico encabezado={false} soloLectura={me.rol === 'administrador'} />
        </HomeRol>
    );
}
