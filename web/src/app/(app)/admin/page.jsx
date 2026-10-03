import HomeRol from '@/components/home/HomeRol';
import ResumenAdmin from '@/components/admin/catalogos/ResumenAdmin';

export const metadata = { title: 'Administración | SUSAN' };

export default function PaginaAdmin() {
    return (
        <HomeRol>
            <ResumenAdmin encabezado={false} />
        </HomeRol>
    );
}
