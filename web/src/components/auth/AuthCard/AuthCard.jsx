import BrandMark from '@/components/layout/BrandMark/BrandMark.jsx';

// Contenedor de las pantallas públicas: barra institucional, título y tarjeta (ancho máximo 420 px).
export default function AuthCard({ title, subtitle, children, footer }) {
    return (
        <div className="flex min-h-dvh flex-col bg-muted">
            <header className="border-b border-border bg-card px-4 py-3">
                <BrandMark variant="full" />
            </header>
            <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-4 px-4 py-8">
                <div>
                    <h1 className="text-2xl font-bold">{title}</h1>
                    {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
                </div>
                <div className="rounded-lg border border-border bg-card p-4 sm:p-6">{children}</div>
                {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
            </main>
        </div>
    );
}
