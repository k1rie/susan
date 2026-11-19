'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApiQuery } from '@/hooks/data';
import { useCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import { useDebounce } from '@/hooks/ui/useDebounce.js';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { laboratorioAgenda, laboratorioSolicitar, laboratoriosListar } from '@/lib/api/laboratorios.js';
import { parametrosPublicos } from '@/lib/api/plataforma.js';
import { reporteFiltros } from '@/lib/api/reportes.js';
import { useRelojPlantel } from '../compartido/useRelojPlantel.js';
import {
    argumentosAgenda,
    avisoCapacidad,
    avisoTraslape,
    datosSolicitud,
    errorDeCampoSolicitud,
    INICIAL_SOLICITUD,
    reglasDe,
    traslapes,
    validarSolicitud,
} from './solicitudForm.utils.js';

// Estado de la solicitud de laboratorio: catálogos (laboratorios y grupos del docente), reglas de plazo, formulario con validación al
// salir del campo, disponibilidad del día elegido y avisos de traslape. Toda la lógica de negocio sigue siendo del servidor.
//
//   onCreada(solicitud)  se llama tras un envío exitoso (la pantalla avisa y refresca la lista).
// Los grupos salen de api_reporte_filtros (docente: solo los suyos, del periodo más reciente); los laboratorios, de api_laboratorios_listar.
export function useSolicitudForm({ onCreada } = {}) {
    const formId = useId();
    const reloj = useRelojPlantel();
    const parametros = useApiQuery(parametrosPublicos, {});
    const laboratorios = useApiQuery(laboratoriosListar, {});
    const grupos = useApiQuery(reporteFiltros, {});
    const [creada, setCreada] = useState(null);

    // Con la consulta caída se usan el reloj del navegador y los valores por omisión: son solo ayuda; el servidor decide.
    const reglas = useMemo(
        () => reglasDe({ hoy: reloj.hoy, hora: reloj.hora }, parametros.data),
        [reloj.hoy, reloj.hora, parametros.data],
    );
    const validar = useCallback((valores) => validarSolicitud(valores, reglas), [reglas]);

    const registro = useRef(null);
    const f = useFormulario({
        inicial: INICIAL_SOLICITUD,
        validar,
        mapearError: errorDeCampoSolicitud,
        onSubmit: async (valores) => {
            registro.current = await laboratorioSolicitar({ datos: datosSolicitud(valores) });
        },
    });
    useCambiosSinGuardar(f.sucio);

    // Un error del servidor (p. ej. «laboratorio ocupado») habla del conjunto laboratorio + fecha + horario: en cuanto se cambia
    // cualquiera de ellos deja de ser cierto. useFormulario solo quita el error del campo editado; aquí se limpian todos.
    const campo = (nombre) => {
        const base = f.campo(nombre);
        const onChange = (arg) => {
            base.onChange(arg);
            if (nombre !== 'actividad') f.fijarErrores({});
        };
        return { ...base, onChange, props: { ...base.props, onChange } };
    };

    const listaLabs = laboratorios.data?.items;
    const listaGrupos = grupos.data?.grupos;
    const catalogos = useMemo(
        () => (listaLabs && listaGrupos ? { laboratorios: listaLabs, grupos: listaGrupos } : null),
        [listaLabs, listaGrupos],
    );
    const cargando = laboratorios.loading || grupos.loading || !reloj.listo || parametros.loading;
    const error = laboratorios.error || grupos.error;

    // Con una sola opción no hay nada que elegir: se deja puesta (y no cuenta como «cambio sin guardar»).
    const { reiniciar } = f;
    const preseleccionado = useRef(false);
    useEffect(() => {
        if (!catalogos || preseleccionado.current) return;
        preseleccionado.current = true;
        const unica = {};
        if (catalogos.laboratorios.length === 1) unica.id_aula = String(catalogos.laboratorios[0].id_aula);
        if (catalogos.grupos.length === 1) unica.id_grupo = String(catalogos.grupos[0].id_grupo);
        if (Object.keys(unica).length > 0) reiniciar({ ...INICIAL_SOLICITUD, ...unica });
    }, [catalogos, reiniciar]);

    const valores = f.valores;
    const laboratorio = listaLabs?.find((l) => String(l.id_aula) === valores.id_aula) ?? null;
    const grupo = listaGrupos?.find((g) => String(g.id_grupo) === valores.id_grupo) ?? null;

    // Disponibilidad del día: se espera a que la fecha deje de cambiar (el selector nativo emite fechas parciales mientras se teclea el año).
    const fechaFirme = useDebounce(valores.fecha, 300);
    const argsAgenda = argumentosAgenda({ idAula: valores.id_aula, fecha: fechaFirme }, reglas);
    const agenda = useApiQuery(laboratorioAgenda, argsAgenda ?? {}, { enabled: argsAgenda != null });
    const bloques = useMemo(
        () => (agenda.data?.bloques ?? []).filter((b) => b.fecha === valores.fecha),
        [agenda.data, valores.fecha],
    );
    const choques = useMemo(
        () => traslapes(bloques, valores.hora_inicio, valores.hora_fin, grupo),
        [bloques, valores.hora_inicio, valores.hora_fin, grupo],
    );

    const enviar = async (evento) => {
        const ok = await f.enviar(evento);
        if (!ok) return false;
        setCreada(registro.current);
        onCreada?.(registro.current);
        return true;
    };

    // «Hacer otra solicitud»: lo más común es pedir el mismo laboratorio para el mismo grupo en otra fecha, así que se conservan.
    const hacerOtra = () => {
        reiniciar({ ...INICIAL_SOLICITUD, id_aula: valores.id_aula, id_grupo: valores.id_grupo });
        setCreada(null);
    };

    const reintentar = () => {
        laboratorios.refetch();
        grupos.refetch();
    };

    return {
        f,
        campo,
        formId,
        enviar,
        creada,
        hacerOtra,
        reintentar,
        catalogos,
        cargando,
        error,
        reglas,
        laboratorio,
        grupo,
        fechaFirme,
        consultable: argsAgenda != null,
        agenda,
        choques,
        avisoCapacidad: avisoCapacidad(grupo, laboratorio),
        avisoTraslape: avisoTraslape(choques),
    };
}

export default useSolicitudForm;
