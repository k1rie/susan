import LaboratoriosDocente from '@/components/laboratorios/docente/LaboratoriosDocente';

export const metadata = { title: 'Laboratorios | SUSAN' };

// El rol docente ya lo exige el layout de /docente. La pantalla carga sus datos en el cliente (RPC con la sesión de la persona).
export default function PaginaLaboratorios() {
    return <LaboratoriosDocente />;
}
