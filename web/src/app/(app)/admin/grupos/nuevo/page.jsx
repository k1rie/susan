import NuevoGrupo from '@/components/admin/grupos/NuevoGrupo';
import { idPositivo } from '@/components/admin/grupos/NuevoGrupo/nuevoGrupo.utils.js';

export const metadata = { title: 'Nuevo grupo | SUSAN' };

// Deep links de las pantallas de éxito de materias y aulas: ?materia=<id_materia> y ?aula=<id_aula> preseleccionan en el asistente.
// Un id que no sea un entero positivo se ignora sin error (el asistente abre vacío); que exista en el catálogo lo comprueba el asistente.
export default async function PaginaNuevoGrupo({ searchParams }) {
    const sp = await searchParams;
    return <NuevoGrupo materiaInicial={idPositivo(sp.materia)} aulaInicial={idPositivo(sp.aula)} />;
}
