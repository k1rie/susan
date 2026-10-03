import HomeRol from '@/components/home/HomeRol';
import PortalAlumno from '@/components/alumno/PortalAlumno';

export const metadata = { title: 'Mi asistencia' };

export default async function AlumnoPage({ searchParams }) {
    const sp = await searchParams;
    const n = Number(Array.isArray(sp.justificar) ? sp.justificar[0] : sp.justificar);
    return (
        <HomeRol>
            <PortalAlumno idSesionInicial={Number.isInteger(n) && n > 0 ? n : null} encabezado={false} />
        </HomeRol>
    );
}
