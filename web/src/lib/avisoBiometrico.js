// Aviso de privacidad y consentimiento para el registro facial. Es la ÚNICA fuente del texto: la pantalla «Mi registro facial» lo
// muestra y la constancia PDF que se guarda en el bucket lo reproduce palabra por palabra, junto con su huella SHA-256 (ver
// lib/server/constancia.js). Así se puede demostrar después qué texto aceptó cada alumno.
//
// REGLA: cualquier cambio al texto exige subir VERSION_AVISO. El servidor rechaza una aceptación hecha sobre otra versión
// (AVISO_DESACTUALIZADO) para que nadie acepte un texto que ya no es el vigente. Este texto es un borrador técnico: debe
// revisarlo la oficina jurídica de la UNACH antes de ponerse en producción.

export const VERSION_AVISO = '2026-10';

export const INSTITUCION = 'Universidad Autónoma de Chiapas';
export const DEPENDENCIA = 'Facultad de Contaduría y Administración, Campus I';
export const RESPONSABLE = `${INSTITUCION}, ${DEPENDENCIA}`;

export const TITULO_AVISO = 'Aviso de privacidad y consentimiento para el registro facial';

/** Declaración que el alumno marca al aceptar (también aparece en la constancia). */
export const DECLARACION = 'He leído el aviso de privacidad y autorizo, de manera libre y por mi cuenta, el tratamiento de mi rostro para registrar mi asistencia a clase.';

/**
 * @param {number} meses vigencia del consentimiento (la fija la base de datos; viaja en api_mi_registro)
 * @returns {{ titulo: string, parrafos: string[] }[]}
 */
export function seccionesAviso(meses = 12) {
    return [
        {
            titulo: 'Quién es responsable',
            parrafos: [
                `${RESPONSABLE}, es responsable del tratamiento de tus datos personales en el sistema de registro de asistencia SUSAN.`,
            ],
        },
        {
            titulo: 'Qué datos se tratan',
            parrafos: [
                'Fotografías de tu rostro tomadas con la cámara de tu dispositivo al registrarte y, durante las clases, recortes de tu rostro capturados por las cámaras del aula.',
                'De esas imágenes se obtiene un vector numérico (la «plantilla facial»), que es un dato personal sensible. Tu nombre y tu matrícula ya forman parte de tu expediente.',
            ],
        },
        {
            titulo: 'Para qué se usan',
            parrafos: [
                'Únicamente para registrar tu asistencia a las clases en que estás inscrito y para generar tus historiales y los reportes de asistencia de tus materias. No se usan para vigilancia ni para otros fines, y no se comparten con terceros.',
            ],
        },
        {
            titulo: 'Cómo se protegen',
            parrafos: [
                'El vector facial no se guarda en la base de datos relacional: vive solo en el índice del servicio de reconocimiento. Las fotos de registro se eliminan cuando tu plantilla queda indexada y los recortes de las clases se eliminan pasados unos días (por omisión, 7).',
                'Los archivos se guardan en un almacenamiento privado, se consultan solo con enlaces temporales y cada consulta a datos biométricos queda en una bitácora de auditoría.',
            ],
        },
        {
            titulo: 'Tu consentimiento',
            parrafos: [
                `Es voluntario y vale por ${meses} meses a partir de hoy; después deberás confirmarlo de nuevo. Si no lo otorgas o lo revocas, tu asistencia se registrará de forma manual por tu docente.`,
            ],
        },
        {
            titulo: 'Tus derechos',
            parrafos: [
                'Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su tratamiento (derechos ARCO) en la coordinación de tu facultad. Puedes revocar tu consentimiento cuando quieras desde «Mi registro facial»: tu plantilla se archiva y el sistema deja de reconocerte.',
            ],
        },
    ];
}

/** El aviso completo como lista de líneas de texto plano (constancia PDF y su huella). Una sola definición, determinista. */
export function textoPlanoAviso(meses = 12) {
    const lineas = [TITULO_AVISO, `Versión del aviso: ${VERSION_AVISO}`, ''];
    for (const s of seccionesAviso(meses)) {
        lineas.push(s.titulo);
        for (const p of s.parrafos) lineas.push(p);
        lineas.push('');
    }
    lineas.push(DECLARACION);
    return lineas;
}
