'use client';

import Combobox from '@/components/ui/Combobox';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import FiltrosActivos from '@/components/reportes/FiltrosReporte/FiltrosActivos.jsx';
import { filtrosActivos, opcionesGrupo } from '@/components/reportes/FiltrosReporte/filtrosReporte.utils.js';

// Periodo (selector corto) y grupo (con búsqueda: materia y clave arriba, docente e inscritos debajo) en una sola fila compacta. Al cambiar el
// periodo se limpia el grupo. El grupo elegido se ve como filtro activo con «Quitar» y «Limpiar». Mismo patrón y mismas piezas que los filtros
// de /reportes; tampoco hay rango de fechas: el análisis (api_serie_grupo, api_matriz_grupo) se calcula sobre todas las sesiones cerradas del grupo.
export default function SelectorGrupo({ periodos = [], grupos = [], valor, onCambio, deshabilitado = false }) {
    const activos = filtrosActivos({ valor, grupos });
    return (
        <form aria-label="Selección de grupo a analizar" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Field label="Periodo">
                    <Select
                        value={valor.periodo || ''}
                        disabled={deshabilitado}
                        onChange={(e) => onCambio({ periodo: e.target.value, idGrupo: null })}
                        options={periodos.map((p) => ({ value: p, label: p }))}
                    />
                </Field>
                <Field label="Grupo">
                    <Combobox
                        options={opcionesGrupo(grupos)}
                        value={valor.idGrupo ? String(valor.idGrupo) : ''}
                        disabled={deshabilitado}
                        onChange={(v) => onCambio({ ...valor, idGrupo: v ? Number(v) : null })}
                        placeholder="Busca o elige un grupo"
                        emptyText="Ningún grupo coincide"
                        clearable
                    />
                </Field>
            </div>
            <FiltrosActivos filtros={activos} onQuitar={() => onCambio({ ...valor, idGrupo: null })} onLimpiar={() => onCambio({ periodo: valor.periodo, idGrupo: null })} disabled={deshabilitado} />
        </form>
    );
}
