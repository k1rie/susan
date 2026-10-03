import PortalAlumno from '@/components/alumno/PortalAlumno';

export const metadata = { title: 'Mi asistencia' };

export default async function AlumnoPage({ searchParams }) {
    const sp = await searchParams;
    const n = Number(Array.isArray(sp.justificar) ? sp.justificar[0] : sp.justificar);
    return <PortalAlumno idSesionInicial={Number.isInteger(n) && n > 0 ? n : null} />;
}
