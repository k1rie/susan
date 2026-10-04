import clsx from 'clsx';
import { useId } from 'react';
import Button from '@/components/ui/Button';

// Acciones del pase de lista con la misma jerarquía en la sesión automática y en la manual: UNA acción primaria (negra, grande: cerrar)
// y las secundarias (blancas con borde) a su lado. En teléfono se apilan a todo el ancho (la primaria arriba, que es lo que se busca);
// desde `sm` van en fila, salvo con `apilado` (columna estrecha del panel), donde siempre quedan una bajo otra.
//   primaria    = { etiqueta, onClick, disabled, loading, icono } (el resto de props van al botón, p. ej. aria-label)
//   secundarias = [{ etiqueta, onClick, disabled, loading, icono }]
//   nota        = por qué la primaria está bloqueada (o qué pasa al pulsarla): texto visible y descripción accesible del botón
export default function AccionesPaseLista({ primaria, secundarias = [], nota, apilado = false, className }) {
    const idNota = useId();
    const { etiqueta, icono, className: clasePrimaria, ...restoPrimaria } = primaria;
    return (
        <div className={clsx('flex flex-col gap-2', className)}>
            <div className={clsx('flex flex-col gap-2', !apilado && 'sm:flex-row sm:flex-wrap sm:items-center')}>
                <Button icon={icono} aria-describedby={nota ? idNota : undefined} className={clsx('min-h-12 w-full', !apilado && 'sm:w-auto', clasePrimaria)} {...restoPrimaria}>
                    {etiqueta}
                </Button>
                {secundarias.map(({ etiqueta: texto, icono: iconoSec, className: claseSec, ...resto }) => (
                    <Button key={texto} variant="secondary" icon={iconoSec} className={clsx('min-h-12 w-full', !apilado && 'sm:min-h-10 sm:w-auto', claseSec)} {...resto}>
                        {texto}
                    </Button>
                ))}
            </div>
            {nota && (
                <p id={idNota} className="text-sm text-muted-foreground">
                    {nota}
                </p>
            )}
        </div>
    );
}
