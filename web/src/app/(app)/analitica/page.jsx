import Analitica from '@/components/analitica/Analitica';

export const metadata = { title: 'Analítica' };

const entero = (v) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

export default async function AnaliticaPage({ searchParams }) {
    const sp = await searchParams;
    const periodo = Array.isArray(sp.periodo) ? sp.periodo[0] : sp.periodo;
    return <Analitica filtrosIniciales={{ periodo: periodo || '', idGrupo: entero(sp.grupo) }} />;
}
