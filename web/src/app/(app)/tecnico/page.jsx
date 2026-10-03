import HomeRol from '@/components/home/HomeRol';
import ConsolaTecnico from '@/components/tecnico/ConsolaTecnico';

export const metadata = { title: 'Consola técnica | SUSAN' };

export default function PaginaConsolaTecnico() {
    return (
        <HomeRol>
            <ConsolaTecnico encabezado={false} />
        </HomeRol>
    );
}
