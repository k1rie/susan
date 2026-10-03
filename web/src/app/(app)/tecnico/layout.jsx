import { requerirSesion } from '@/lib/server/auth';

// Guarda del área técnica: el técnico (edita) y el administrador (solo consulta; lo aplica la base y la pantalla lo refleja).
export default async function TecnicoLayout({ children }) {
    await requerirSesion('tecnico');
    return children;
}
