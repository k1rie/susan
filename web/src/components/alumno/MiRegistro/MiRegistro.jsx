'use client';

import { useState } from 'react';
import RegistroFacialGuiado from '@/components/admin/alumnos/RegistroFacialGuiado';
import PageHeader from '@/components/layout/PageHeader';
import Alert from '@/components/ui/Alert';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import Stepper from '@/components/ui/Stepper';
import AvisoConsentimiento from './AvisoConsentimiento.jsx';
import { pasosDe } from './miRegistro.utils.js';
import PasoRostro from './PasoRostro.jsx';
import RegistroCompleto from './RegistroCompleto.jsx';
import TarjetaConsentimiento from './TarjetaConsentimiento.jsx';
import useMiRegistro from './useMiRegistro.js';

// P-08b · Mi registro facial: el alumno acepta el aviso de privacidad y registra su propio rostro (autoservicio). El administrador deja de
// capturarlo todo y queda como respaldo y auditor. Tres pasos: aviso -> rostro -> listo; el servidor decide en cuál va (api_mi_registro).
export default function MiRegistro() {
    const m = useMiRegistro();
    const [revocando, setRevocando] = useState(false);

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <PageHeader
                title="Mi registro facial"
                subtitle="Acepta el aviso y registra tu rostro una sola vez para que tu asistencia se tome con la cámara."
                backHref="/alumno"
                backLabel="Mi asistencia"
            />
            <DataState loading={m.registro.loading} error={m.registro.error} data={m.registro.data} onRetry={m.registro.refetch} isEmpty={() => false}>
                {(r) => (
                    <>
                        <Stepper steps={pasosDe(r.paso)} current={r.paso} label="Pasos del registro facial" />
                        {!r.puede_registrar ? (
                            <Alert tone="warning" title="Tu cuenta de alumno no está activa">
                                No puedes registrar tu rostro por ahora. Acude a tu coordinación.
                            </Alert>
                        ) : (
                            <>
                                {r.paso === 'consentimiento' && (
                                    <AvisoConsentimiento meses={r.vigencia_meses} aceptando={m.aceptando} error={m.errorAceptar} onAceptar={m.aceptar} />
                                )}
                                {r.paso === 'rostro' && <PasoRostro registro={r} onRegistrar={m.abrirAsistente} />}
                                {r.paso === 'listo' && <RegistroCompleto registro={r} onRehacer={m.abrirAsistente} onActualizar={m.registro.refetch} />}
                                {r.consentimiento && <TarjetaConsentimiento consentimiento={r.consentimiento} onRevocar={() => setRevocando(true)} />}
                            </>
                        )}
                        {m.asistenteAbierto && <RegistroFacialGuiado p={m.p} propio nombreAlumno={r.nombre} onClose={m.cerrarAsistente} />}
                    </>
                )}
            </DataState>
            <ConfirmDialog
                open={revocando}
                title="¿Revocar tu consentimiento?"
                message="Se archivará tu plantilla facial y el sistema dejará de reconocerte: tu docente tomará tu asistencia a mano. Podrás aceptar el aviso de nuevo cuando quieras."
                confirmLabel="Revocar consentimiento"
                variant="danger"
                onConfirm={async () => {
                    await m.revocar();
                    setRevocando(false);
                }}
                onCancel={() => setRevocando(false)}
            />
        </div>
    );
}
