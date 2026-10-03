import { UserRoundPlus } from 'lucide-react';

// SUSAN no tiene autorregistro: las cuentas las crea el administrador (invitación por correo → /activar-cuenta).
export default function AvisoAltaCuentas() {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
            <UserRoundPlus aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <p className="text-muted-foreground">
                <span className="font-medium text-foreground">¿Aún no tienes cuenta?</span> La crea el administrador. No hay registro propio: solicítala en Coordinación y recibirás un correo para activarla.
            </p>
        </div>
    );
}
