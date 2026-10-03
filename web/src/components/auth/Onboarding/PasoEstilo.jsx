import { Check } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { TINTES, tinteDe } from '@/components/ui/Avatar/avatar.utils.js';
import { rolEtiqueta } from '@/components/layout/Sidebar/navItems.js';
import { usePreferenciasPerfil } from '@/lib/perfil';

// Paso «Elige tu estilo» («Choose your look» en SchoolAI): vista previa del avatar y selector de color. La elección se guarda
// por navegador al terminar el asistente; mientras tanto, `tinte` (estado del asistente) manda sobre la preferencia previa.
export default function PasoEstilo({ me, tinte, onTinte }) {
    const previo = usePreferenciasPerfil(me).tinte;
    const actual = tinte ?? previo ?? tinteDe(me?.nombre);
    return (
        <div className="flex flex-col gap-6">
            <p className="text-base text-muted-foreground">Así te verán en SUSAN. Elige el color de tu avatar; podrás cambiarlo cuando quieras.</p>
            <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                <Avatar nombre={me?.nombre} size="lg" tinte={actual} />
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{me?.nombre ?? 'Tu nombre'}</p>
                    <p className="text-sm text-muted-foreground">{rolEtiqueta(me?.rol) || 'Tu rol'}</p>
                </div>
            </div>
            <fieldset>
                <legend className="mb-3 text-sm font-medium">Color del avatar</legend>
                <div className="flex flex-wrap gap-3">
                    {TINTES.map((color) => {
                        const activo = color === actual;
                        return (
                            <label key={color} className="relative cursor-pointer">
                                <input type="radio" name="tinte" value={color} checked={activo} onChange={() => onTinte(color)} className="peer sr-only" />
                                <span
                                    className="flex size-11 items-center justify-center rounded-full text-white outline-offset-2 transition-transform duration-150 peer-checked:ring-2 peer-checked:ring-foreground peer-checked:ring-offset-2 peer-focus-visible:ring-4 peer-focus-visible:ring-ring/40 hover:scale-105"
                                    style={{ background: color }}
                                >
                                    {activo && <Check aria-hidden="true" className="size-5" strokeWidth={2.5} />}
                                </span>
                                <span className="sr-only">{`Color ${TINTES.indexOf(color) + 1}`}</span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>
        </div>
    );
}
