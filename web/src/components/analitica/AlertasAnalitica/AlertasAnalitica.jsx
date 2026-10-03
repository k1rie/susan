import Alert from '@/components/ui/Alert';
import { ETIQUETA_NIVEL_ALERTA } from '../analitica.utils.js';

const TONO = { alta: 'danger', media: 'warning', info: 'info' };

// Alertas del análisis, de más a menos grave.
export default function AlertasAnalitica({ alertas = [] }) {
    if (alertas.length === 0) return null;
    const orden = { alta: 0, media: 1, info: 2 };
    const lista = [...alertas].sort((a, b) => (orden[a.nivel] ?? 3) - (orden[b.nivel] ?? 3));
    return (
        <section aria-label="Alertas del análisis" className="flex flex-col gap-2">
            {lista.map((a, i) => (
                <Alert key={`${a.codigo}-${i}`} tone={TONO[a.nivel] || 'info'} title={`${ETIQUETA_NIVEL_ALERTA[a.nivel] || 'Info'}: ${a.mensaje}`}>
                    <span className="text-xs">Código {a.codigo}</span>
                </Alert>
            ))}
        </section>
    );
}
