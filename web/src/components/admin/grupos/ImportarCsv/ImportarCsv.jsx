'use client';

import { FileUp } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import Modal from '@/components/ui/Modal';
import Stepper from '@/components/ui/Stepper';
import { useApiMutation } from '@/hooks/data';
import { importarInscripciones } from '@/lib/api/admin.js';
import { descargarTexto } from '../compartido/descargar.js';
import { plural } from '../compartido/grupos.utils.js';
import PasoArchivo from './PasoArchivo.jsx';
import PasoConfirmar from './PasoConfirmar.jsx';
import PasoResultado from './PasoResultado.jsx';
import PasoRevision from './PasoRevision.jsx';
import { filasParaApi, NOMBRE_REPORTE, parsearCsvInscripciones, reporteDeFallidos, revisarAnalisis } from './importarCsv.utils.js';

const PASOS = [
    { id: 'archivo', label: 'Archivo' },
    { id: 'revision', label: 'Revisión' },
    { id: 'confirmar', label: 'Confirmar' },
    { id: 'resultado', label: 'Resultado' },
];

// Importación por lotes (máx. 500) en un diálogo de 4 pasos: archivo (plantilla y zona de arrastre) -> revisión (contadores y errores
// agrupados por causa) -> confirmar -> resultado con el reporte descargable. El parser es local y la validación real es la del servidor
// (api_importar_inscripciones: cada fila en su subtransacción). `matriculasInscritas`/`activos`/`capacidadAula` permiten avisar de lo ya
// inscrito y de si el aula alcanza.
export default function ImportarCsv({ idGrupo, matriculasInscritas = [], activos = 0, capacidadAula, onImported }) {
    const importar = useApiMutation(importarInscripciones);
    const [abierto, setAbierto] = useState(false);
    const [paso, setPaso] = useState(0);
    const [archivo, setArchivo] = useState(null);
    const [analisis, setAnalisis] = useState(null);
    const [reporte, setReporte] = useState(null);
    const [errorEnvio, setErrorEnvio] = useState(null);

    const revision = analisis && analisis.erroresGlobales.length === 0 ? revisarAnalisis(analisis, matriculasInscritas) : null;

    const reiniciar = () => {
        setPaso(0);
        setArchivo(null);
        setAnalisis(null);
        setReporte(null);
        setErrorEnvio(null);
    };
    const cerrar = () => {
        setAbierto(false);
        reiniciar();
    };

    const elegir = async (file) => {
        setArchivo(file);
        setErrorEnvio(null);
        if (!file) {
            setAnalisis(null);
            return;
        }
        try {
            setAnalisis(parsearCsvInscripciones(await file.text()));
        } catch {
            setAnalisis({ filas: [], errores: [], erroresGlobales: ['No se pudo leer el archivo.'] });
        }
    };

    const enviar = async () => {
        setErrorEnvio(null);
        try {
            const r = await importar.run({ idGrupo, filas: filasParaApi(revision.paraEnviar) });
            // El servidor numera por posición en el lote enviado; se vuelve a la fila del archivo.
            const filas = (r.filas ?? []).map((f) => ({ ...f, linea: revision.paraEnviar[f.fila - 1]?.linea ?? f.fila }));
            setReporte({ ...r, filas });
            setPaso(3);
            onImported?.(r);
        } catch (error) {
            setErrorEnvio(error);
        }
    };

    const fallidasReporte = reporte ? reporteDeFallidos({ descartadas: revision?.descartadas, filasServidor: reporte.filas }) : null;
    const descargarErrores = () => {
        const { texto } = reporteDeFallidos({ descartadas: revision?.descartadas ?? [], filasServidor: reporte?.filas ?? [] });
        descargarTexto(NOMBRE_REPORTE, texto);
    };

    // Lo que impide avanzar se escribe junto al botón en vez de dejarlo apagado sin explicación.
    const bloqueo =
        paso === 0
            ? !archivo
                ? 'Elige un archivo CSV para continuar.'
                : !revision
                  ? 'Corrige el archivo para continuar.'
                  : revision.paraEnviar.length + revision.yaInscritas.length + revision.descartadas.length === 0
                    ? 'El archivo no tiene filas de datos.'
                    : null
            : paso === 1 && revision?.paraEnviar.length === 0
              ? 'No hay filas para importar.'
              : null;

    const alSeleccionarPaso = paso < 3 ? (id) => {
        const i = PASOS.findIndex((p) => p.id === id);
        if (i >= 0 && i < paso) setPaso(i);
    } : undefined;

    const pie = ({ cerrar: cerrarModal }) => (
        <FormActions flat motivoBloqueo={bloqueo ?? undefined}>
            {paso === 0 && (
                <Button variant="secondary" onClick={cerrarModal}>
                    Cancelar
                </Button>
            )}
            {paso > 0 && paso < 3 && (
                <Button variant="secondary" onClick={() => setPaso(paso - 1)} disabled={importar.loading}>
                    Atrás
                </Button>
            )}
            {paso < 2 && (
                <Button arrow disabled={Boolean(bloqueo)} onClick={() => setPaso(paso + 1)}>
                    Siguiente
                </Button>
            )}
            {paso === 2 && (
                <Button loading={importar.loading} onClick={enviar}>
                    Importar {plural(revision.paraEnviar.length, 'alumno')}
                </Button>
            )}
            {paso === 3 && <Button onClick={cerrarModal}>Cerrar</Button>}
        </FormActions>
    );

    return (
        <>
            <Button variant="secondary" icon={<FileUp aria-hidden="true" className="size-4" strokeWidth={1.75} />} onClick={() => setAbierto(true)}>
                Importar desde CSV
            </Button>
            <Modal
                open={abierto}
                onClose={cerrar}
                title="Importar alumnos desde CSV"
                size="lg"
                fullMobile
                showClose
                dirty={Boolean(archivo) && paso < 3}
                onDiscard={reiniciar}
                closeDisabled={importar.loading}
                footer={pie}
            >
                <div className="flex flex-col gap-5">
                    <Stepper steps={PASOS} current={paso} onSelect={alSeleccionarPaso} />
                    {paso === 0 && <PasoArchivo archivo={archivo} analisis={analisis} onElegir={elegir} />}
                    {paso === 1 && revision && <PasoRevision revision={revision} analisis={analisis} onDescargarErrores={descargarErrores} />}
                    {paso === 2 && revision && <PasoConfirmar revision={revision} capacidadAula={capacidadAula} activos={activos} error={errorEnvio} />}
                    {paso === 3 && reporte && (
                        <PasoResultado reporte={reporte} fallidas={fallidasReporte.cantidad} onDescargar={descargarErrores} onCerrar={cerrar} onOtro={reiniciar} />
                    )}
                </div>
            </Modal>
        </>
    );
}
