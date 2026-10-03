'use client';

import { useSyncExternalStore } from 'react';
import { useShell } from '@/components/layout/ShellContext.jsx';
import { BlurText, Reveal } from '@/components/motion';
import Badge from '@/components/ui/Badge';
import { modulosActivos, modulosParaRol, modulosProximos } from '@/lib/modulos.js';
import { rolEtiqueta } from '@/components/layout/Sidebar/navItems.js';
import CampoComando from '../CampoComando';
import FilaModulos from '../FilaModulos';
import Resaltado from '../Resaltado';
import { primerNombre, saludoPorHora } from '../saludo.js';
import TeselasFlotantes from '../TeselasFlotantes';

const TEXTO_POR_ROL = {
    docente: { placeholder: '¿Qué quieres hacer hoy?', lema: 'Pasa lista en segundos y entiende la asistencia de tus grupos.' },
    administrador: { placeholder: '¿Qué quieres hacer hoy?', lema: 'Administra grupos, alumnos y cuentas, y vigila la salud del sistema.' },
    alumno: { placeholder: '¿Qué quieres hacer hoy?', lema: 'Consulta tu asistencia, tus faltas permitidas y tus justificantes.' },
    tecnico: { placeholder: '¿Qué quieres hacer hoy?', lema: 'Cámaras, parámetros del sistema e índice facial.' },
};

const sinSuscripcion = () => () => {};
// Servidor: "Hola" (no conoce la zona horaria). Cliente: saludo por hora local, sin desajuste de hidratación.
const useSaludo = () => useSyncExternalStore(sinSuscripcion, () => saludoPorHora(new Date().getHours()), () => 'Hola');

// Home por rol: portada con saludo en serif, campo de comando (abre la paleta ⌘K), el contenido operativo de la
// pantalla (`children`: sesiones de hoy, resumen…) y filas de módulos (activos y próximos) tomados del registro.
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
            <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-9 shadow-soft sm:px-10 sm:py-12">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/80 via-card to-brand-gold-soft/60" />
                <TeselasFlotantes modulos={activos.length ? activos : proximos} />
                <div className="relative flex max-w-xl flex-col items-start gap-5 lg:max-w-[34rem]">
                    <Badge tone="info">{rolEtiqueta(rol)} · FCA C-I</Badge>
                    <h1 className="flex flex-wrap items-baseline gap-x-3 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
                        <BlurText as="span" text={nombre ? `${saludo},` : saludo} animateBy="words" />
                        {nombre && <Resaltado>{nombre}</Resaltado>}
                    </h1>
                    <Reveal as="p" delay={0.25} immediate className="max-w-xl text-base text-muted-foreground sm:text-lg">
                        {texto.lema}
                    </Reveal>
                    <Reveal delay={0.4} immediate className="w-full">
                        <CampoComando placeholder={texto.placeholder} onAbrir={abrirPaleta} />
                    </Reveal>
                </div>
            </section>

            {children}

            <FilaModulos
                titulo="Tus herramientas"
                subtitulo="Todo lo que puedes hacer en SUSAN con tu rol"
                modulos={activos}
                verTodoHref="/modulos"
                verTodoEtiqueta={`Todos los módulos (${modulosParaRol(rol).length}) →`}
            />
            <FilaModulos
                titulo="Próximamente"
                subtitulo="Lo que viene para SUSAN"
                modulos={proximos}
                verTodoHref="/modulos?filtro=pronto"
                total={proximos.length}
            />
        </div>
    );
}
