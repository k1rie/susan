import { BookOpenCheck, Camera, ChartLine, ClipboardCheck, Database, FileText, LockKeyhole, ScanFace, ScrollText, Settings2, ShieldCheck, UserCheck, Users } from 'lucide-react';

// Contenido del paso «Así funciona SUSAN para ti», por rol. Iconos: Lucide. Textos cortos y en segunda persona.
export const GUIA_POR_ROL = {
    docente: [
        { icono: ScanFace, tono: 'azul', titulo: 'Pasa lista con la cámara', texto: 'Abre la sesión de tu clase y SUSAN reconoce a tus alumnos con consentimiento vigente. Sin cámara, pase manual.' },
        { icono: ClipboardCheck, tono: 'dorado', titulo: 'Revisa solo lo dudoso', texto: 'Los reconocimientos con poca certeza llegan a tu cola de revisión: confirmas o corriges en un clic y queda en bitácora.' },
        { icono: ChartLine, tono: 'violeta', titulo: 'Anticípate al ausentismo', texto: 'La analítica proyecta cuándo un alumno cruzará el 20 % de faltas y explica el cálculo paso a paso.' },
    ],
    administrador: [
        { icono: Users, tono: 'azul', titulo: 'Catálogos y grupos', texto: 'Da de alta alumnos, docentes, materias, aulas y grupos con sus horarios y cámaras.' },
        { icono: ShieldCheck, tono: 'verde', titulo: 'Consentimiento y privacidad', texto: 'Registra el consentimiento de cada alumno: sin consentimiento vigente, su asistencia es manual.' },
        { icono: ScrollText, tono: 'dorado', titulo: 'Todo queda auditado', texto: 'Correcciones, justificantes y consultas biométricas se asientan en una bitácora que no se puede editar.' },
    ],
    alumno: [
        { icono: UserCheck, tono: 'azul', titulo: 'Consulta tu asistencia', texto: 'Ve tu avance por materia frente al límite de faltas para tener derecho a examen.' },
        { icono: FileText, tono: 'dorado', titulo: 'Justifica tus faltas', texto: 'Sube tu justificante desde el teléfono; tu docente lo resuelve y verás el estado aquí.' },
        { icono: LockKeyhole, tono: 'verde', titulo: 'Tu rostro, tus reglas', texto: 'Solo se usa para tu asistencia si diste tu consentimiento; puedes revocarlo cuando quieras.' },
    ],
    tecnico: [
        { icono: Camera, tono: 'azul', titulo: 'Cámaras del aula', texto: 'Vigila el estado de cada cámara y activa o pone en mantenimiento las que lo necesiten.' },
        { icono: Settings2, tono: 'dorado', titulo: 'Parámetros del sistema', texto: 'Umbral de similitud, lecturas mínimas e intervalo de captura: cada cambio queda registrado.' },
        { icono: Database, tono: 'violeta', titulo: 'Índice facial', texto: 'Reconstruye y activa versiones del índice sin interrumpir el pase de lista.' },
    ],
};

export const GUIA_GENERICA = [
    { icono: BookOpenCheck, tono: 'azul', titulo: 'Asistencia digital', texto: 'SUSAN centraliza el pase de lista y el historial de asistencia.' },
    { icono: ChartLine, tono: 'violeta', titulo: 'Análisis del ausentismo', texto: 'Detecta patrones a tiempo para orientar la intervención docente.' },
    { icono: ShieldCheck, tono: 'verde', titulo: 'Privacidad primero', texto: 'El dato biométrico se usa solo con consentimiento y queda auditado.' },
];

export const guiaParaRol = (rol) => GUIA_POR_ROL[rol] ?? GUIA_GENERICA;

// Pasos del asistente. `activar` (invitación): crea contraseña. `bienvenida` (cuenta ya activa): sin contraseña ni acuse.
export function pasosDe(modo) {
    return modo === 'activar'
        ? [
              { id: 'contrasena', titulo: 'Crea tu contraseña', resumen: 'Contraseña' },
              { id: 'estilo', titulo: 'Elige tu estilo', resumen: 'Perfil' },
              { id: 'guia', titulo: 'Así funciona SUSAN para ti', resumen: 'Guía' },
              { id: 'privacidad', titulo: 'Tu privacidad', resumen: 'Privacidad' },
          ]
        : [
              { id: 'estilo', titulo: 'Elige tu estilo', resumen: 'Perfil' },
              { id: 'guia', titulo: 'Así funciona SUSAN para ti', resumen: 'Guía' },
              { id: 'privacidad', titulo: 'Tu privacidad', resumen: 'Privacidad' },
          ];
}
