import Alert from '@/components/ui/Alert';
import Detalles from '@/components/ui/Detalles';
import { ETIQUETA_NIVEL_ALERTA, partirAlertas } from '../analitica.utils.js';

const TONO = { alta: 'danger', media: 'warning', info: 'info' };
const VISIBLES = 3;

// El código de la alerta (p. ej. ALUMNOS_SUPERAN_LIMITE) no se muestra, pero queda en `data-codigo` como referencia para soporte.
const FilaAlerta = ({ a }) => <Alert tone={TONO[a.nivel] || 'info'} title={`${ETIQUETA_NIVEL_ALERTA[a.nivel] || 'Info'}: ${a.mensaje}`} data-codigo={a.codigo} />;

// Alertas del análisis, de más a menos grave: las 3 primeras a la vista y el resto plegado.
export default function AlertasAnalitica({ alertas = [] }) {
    if (alertas.length === 0) return null;
    const { principales, resto } = partirAlertas(alertas, VISIBLES);
    return (
        <section aria-label="Alertas del análisis" className="flex flex-col gap-2">
            {principales.map((a, i) => (
                <FilaAlerta key={`${a.codigo}-${i}`} a={a} />
            ))}
            {resto.length > 0 && (
                <Detalles titulo={`Ver ${resto.length} ${resto.length === 1 ? 'aviso más' : 'avisos más'}`}>
                    <div className="flex flex-col gap-2">
                        {resto.map((a, i) => (
                            <FilaAlerta key={`${a.codigo}-${i}`} a={a} />
                        ))}
                    </div>
                </Detalles>
            )}
        </section>
    );
}
