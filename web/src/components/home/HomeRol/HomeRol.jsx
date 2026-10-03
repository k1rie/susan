'use client';

import { useSyncExternalStore } from 'react';
import { useShell } from '@/components/layout/ShellContext.jsx';
import { BlurText, Reveal } from '@/components/motion';
import { modulosActivos, modulosParaRol, modulosProximos } from '@/lib/modulos.js';
import { rolEtiqueta } from '@/components/layout/Sidebar/navItems.js';
import CampoComando from '../CampoComando';
import FilaModulos from '../FilaModulos';
import Resaltado from '../Resaltado';
import { primerNombre, saludoPorHora } from '../saludo.js';

const TEXTO_POR_ROL = {
    docente: { lema: 'Pasa lista en segundos y entiende la asistencia de tus grupos.' },
    administrador: { lema: 'Administra grupos, alumnos y cuentas, y vigila la salud del sistema.' },
    alumno: { lema: 'Consulta tu asistencia, tus faltas permitidas y tus justificantes.' },
    tecnico: { lema: 'Cámaras, parámetros del sistema e índice facial.' },
};

const sinSuscripcion = () => () => {};
// Servidor: "Hola" (no conoce la zona horaria). Cliente: saludo por hora local, sin desajuste de hidratación.
const useSaludo = () => useSyncExternalStore(sinSuscripcion, () => saludoPorHora(new Date().getHours()), () => 'Hola');

// Home por rol (estilo Dropbox Dash dentro del panel blanco): saludo en la serif de marca con subrayado dorado, campo de búsqueda
// (abre la paleta ⌘K), el contenido operativo de la pantalla (`children`: sesiones de hoy, resumen…) y secciones de tarjetas de módulo.
export default function HomeRol({ children }) {
    const { me, abrirPaleta } = useShell();
    const saludo = useSaludo();
    const rol = me?.rol;
    const texto = TEXTO_POR_ROL[rol] ?? TEXTO_POR_ROL.docente;
    const nombre = primerNombre(me?.nombre);
    const activos = modulosActivos(rol);
    const proximos = modulosProximos(rol);

    return (
        <div className="flex flex-col gap-10">
            <header className="flex flex-col items-start gap-3">
                <p className="text-sm font-medium text-muted-foreground">{rolEtiqueta(rol)} · FCA C-I</p>
                <h1 className="flex flex-wrap items-baseline gap-x-3 font-display text-[2.6rem] font-medium leading-[1.05] tracking-tight sm:text-[3.25rem]">
                    <BlurText as="span" text={nombre ? `${saludo},` : saludo} animateBy="words" />
                    {nombre && <Resaltado>{nombre}</Resaltado>}
                </h1>
                <Reveal as="p" delay={0.2} immediate className="max-w-xl text-base text-muted-foreground">
                    {texto.lema}
                </Reveal>
                <Reveal delay={0.3} immediate className="mt-2 w-full">
                    <CampoComando onAbrir={abrirPaleta} />
                </Reveal>
            </header>

            {children}

            <FilaModulos
                titulo="Tus herramientas"
                subtitulo="Todo lo que puedes hacer en SUSAN con tu rol"
                modulos={activos}
                max={10}
                verTodoHref="/modulos"
                verTodoEtiqueta={`Ver todos los módulos (${modulosParaRol(rol).length})`}
            />
            <FilaModulos
                titulo="Próximamente"
                subtitulo="Lo que viene para SUSAN"
                modulos={proximos}
                verTodoHref="/modulos?filtro=pronto"
                verTodoEtiqueta="Ver todo"
            />
        </div>
    );
}
