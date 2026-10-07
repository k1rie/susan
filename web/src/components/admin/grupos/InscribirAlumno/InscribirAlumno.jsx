'use client';

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Combobox from '@/components/ui/Combobox';
import Field from '@/components/ui/Field';
import FormActions from '@/components/ui/FormActions';
import { useApiMutation } from '@/hooks/data';
import { alumnosListar, inscribir } from '@/lib/api/admin.js';
import { plural } from '../compartido/grupos.utils.js';
import { estadoCapacidad, opcionAlumno, resumenLote } from './inscribirAlumno.utils.js';

// Inscripción rápida: se busca por matrícula o nombre (Combobox remoto), cada alumno elegido se suma a una lista y el campo queda listo
// para el siguiente («inscribir y agregar otro» sin pasos extra); un solo botón inscribe todos. Si alguno falla, se queda en la lista con
// su motivo y los demás ya están inscritos. `inscritosActivos` (ids) evita ofrecer a quien ya está; el servidor rechaza duplicados igual.
// `capacidadAula` avisa de los lugares libres (solo avisa: el servidor no limita por capacidad).
export default function InscribirAlumno({ idGrupo, inscritosActivos = [], capacidadAula, onInscrito }) {
    const inscribirAlumno = useApiMutation(inscribir);
    const [lista, setLista] = useState([]);
    const [enCurso, setEnCurso] = useState(false);
    const [resultado, setResultado] = useState(null); // { texto, tono } del último lote

    const idsEnLista = new Set(lista.map((a) => String(a.id)));
    const ya = new Set(inscritosActivos.map(String));
    const capacidad = estadoCapacidad({ capacidad: capacidadAula, activos: inscritosActivos.length, enLista: lista.length });

    const buscar = async (q) => {
        const r = await alumnosListar({ q, estatus: 'activo', limit: 10 });
        return (r?.items ?? []).map((a) => opcionAlumno(a, { yaInscrito: ya.has(String(a.id_alumno)), enLista: idsEnLista.has(String(a.id_alumno)) }));
    };

    const agregar = (valor, opcion) => {
        if (!opcion?.datos) return;
        const a = opcion.datos;
        setResultado(null);
        setLista((l) => (l.some((x) => String(x.id) === String(a.id_alumno)) ? l : [...l, { id: a.id_alumno, nombre: a.nombre_completo, matricula: a.matricula, error: null }]));
    };

    const quitar = (id) => setLista((l) => l.filter((x) => x.id !== id));

    const inscribirLista = async () => {
        if (enCurso || lista.length === 0) return;
        setEnCurso(true);
        let ok = 0;
        let reinscritos = 0;
        const fallidos = [];
        for (const alumno of lista) {
            try {
                const r = await inscribirAlumno.run({ idGrupo, idAlumno: alumno.id });
                ok += 1;
                if (r?.reinscrita) reinscritos += 1;
            } catch (error) {
                fallidos.push({ ...alumno, error: error.message });
            }
        }
        setLista(fallidos);
        setEnCurso(false);
        // Un solo aviso, a la vista y con su estado (el toast desaparece solo y el resultado conviene releerlo).
        setResultado({ texto: resumenLote({ ok, reinscritos, fallidos: fallidos.length }), tono: fallidos.length ? 'warning' : 'success' });
        if (ok > 0) onInscrito?.();
    };

    return (
        <div className="flex flex-col gap-4">
            <Field label="Buscar alumno" hint="Escribe la matrícula o el nombre y elígelo: se suma a la lista y puedes seguir con el siguiente.">
                <Combobox
                    loadOptions={buscar}
                    loadKey={`${lista.length}-${inscritosActivos.length}`}
                    value=""
                    onChange={agregar}
                    placeholder="Matrícula o nombre"
                    emptyText="Sin alumnos activos que coincidan"
                    hintText="Escribe al menos 2 caracteres para buscar."
                    disabled={enCurso}
                />
            </Field>

            {capacidad.texto && (
                <p aria-live="polite" className={`flex items-start gap-1.5 text-[13px] ${capacidad.tono === 'warning' ? 'text-retardo' : 'text-muted-foreground'}`}>
                    {capacidad.tono === 'warning' ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} /> : <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />}
                    {capacidad.texto}
                </p>
            )}

            {lista.length > 0 && (
                <ul aria-label="Alumnos por inscribir" className="flex flex-col gap-2">
                    {lista.map((a) => (
                        <li key={a.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-2.5">
                            <Avatar nombre={a.nombre} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{a.nombre}</p>
                                <p className="text-[13px] text-muted-foreground">{a.matricula}</p>
                                {a.error && (
                                    <p role="alert" className="mt-1 flex items-start gap-1.5 text-[13px] text-destructive">
                                        <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                                        {a.error}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => quitar(a.id)}
                                disabled={enCurso}
                                aria-label={`Quitar a ${a.nombre} de la lista`}
                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-50"
                            >
                                <X aria-hidden="true" className="size-4" strokeWidth={1.75} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {resultado && (
                <p role="status" className={`flex items-start gap-1.5 text-sm ${resultado.tono === 'success' ? 'text-presente' : 'text-retardo'}`}>
                    {resultado.tono === 'success' ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} /> : <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />}
                    {resultado.texto}
                </p>
            )}

            <FormActions sticky={false} summary={lista.length > 0 ? `Se inscribirán ${plural(lista.length, 'alumno')} en este grupo.` : undefined} motivoBloqueo={lista.length === 0 ? 'Elige al menos un alumno para inscribir.' : undefined}>
                {lista.length > 1 && (
                    <Button variant="secondary" onClick={() => setLista([])} disabled={enCurso}>
                        Vaciar lista
                    </Button>
                )}
                <Button disabled={lista.length === 0} loading={enCurso} onClick={inscribirLista}>
                    {lista.length > 0 ? `Inscribir ${plural(lista.length, 'alumno')}` : 'Inscribir alumnos'}
                </Button>
            </FormActions>
        </div>
    );
}
