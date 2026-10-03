import ReporteAsistencia from '@/components/reportes/ReporteAsistencia';

export const metadata = { title: 'Reportes' };

const entero = (v) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

export default async function ReportesPage({ searchParams }) {
    const sp = await searchParams;
    const periodo = Array.isArray(sp.periodo) ? sp.periodo[0] : sp.periodo;
    return (
        <ReporteAsistencia
            filtrosIniciales={{ periodo: periodo || '', idGrupo: entero(sp.grupo), idAlumno: entero(sp.alumno) }}
        />
    );
}
