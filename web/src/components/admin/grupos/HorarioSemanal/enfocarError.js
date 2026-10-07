// Lleva el foco al primer problema visible del editor de horario: un campo de hora marcado como inválido o, si el error es de la franja
// (días sin elegir, traslape), el primer control de esa franja. No usa `:has()` para funcionar también en jsdom.
export function enfocarPrimerError(raiz) {
    if (!raiz) return;
    const campo = raiz.querySelector('input[aria-invalid="true"]');
    if (campo) {
        campo.focus();
        return;
    }
    const franja = raiz.querySelector('[data-franja] [role="alert"]')?.closest('[data-franja]');
    franja?.querySelector('button[aria-pressed], input')?.focus();
}
