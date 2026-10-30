// Lista de extractos de codigo-cuerpo.sql. Cada extracto es un rango de lineas (inclusive) de una migracion.
// Lo usan generar-cuerpo.mjs (para escribir el archivo) y verificar-cuerpo.mjs (para comprobarlo).
export const EXTRACTOS = [
    { archivo: '0005_tablas_operacion.sql', desde: 3, hasta: 73, titulo: 'DDL del área B: sesion_clase, asistencia y justificante (con sus CHECK, UNIQUE y FK)' },
    { archivo: '0006_tablas_biometria.sql', desde: 32, hasta: 50, titulo: 'DDL de plantilla_facial (RN-12: indexada o no, faiss_id)' },
    { archivo: '0006_tablas_biometria.sql', desde: 84, hasta: 102, titulo: 'DDL de deteccion (ck_deteccion_candidato, RN-04)' },
    { archivo: '0007_indices.sql', desde: 5, hasta: 11, titulo: 'Índices únicos parciales: una plantilla activa por alumno, un índice FAISS en uso' },
    { archivo: '0100_reportes_base.sql', desde: 11, hasta: 74, titulo: 'Vista v_resumen_asistencia (RF-13/RF-14, RN-10/RN-11): faltas equivalentes y límite de ausencias' },
    { archivo: '0020_triggers.sql', desde: 24, hasta: 53, titulo: 'Disparador trg_asistencia_rn01 (RN-01: solo con inscripción activa)' },
    { archivo: '0020_triggers.sql', desde: 217, hasta: 249, titulo: 'Disparadores de bitácora de solo inserción (RNF-08)' },
    { archivo: '0030_rls_grants.sql', desde: 119, hasta: 129, titulo: 'Políticas RLS de asistencia: administrador, docente de sus grupos, alumno el propio' },
    { archivo: '0030_rls_grants.sql', desde: 185, hasta: 187, titulo: 'Política RLS de la bitácora: solo administrador' },
    { archivo: '0130_sesiones_helpers.sql', desde: 24, hasta: 34, titulo: 'Función app.estado_por_minuto (RN-03: presente o retardo según el minuto)' },
    { archivo: '0133_api_sesion_cierre.sql', desde: 14, hasta: 128, titulo: 'Función app.cerrar_sesion (RF-10, RN-07): consolida lecturas, crea ausentes, cierra, bitácora y recálculo' },
    { archivo: '0133_api_sesion_cierre.sql', desde: 137, hasta: 148, titulo: 'RPC api_cerrar_sesion: envoltorio que expone el cierre al docente titular' },
];
export const COMMIT = 'f742bb4';
