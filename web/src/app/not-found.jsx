import Button from '@/components/ui/Button/Button.jsx';

export const metadata = { title: 'Página no encontrada' };

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-4 text-center">
            <h1 className="text-2xl font-bold">Página no encontrada</h1>
            <p className="text-sm text-muted-foreground">La dirección que buscas no existe o fue movida.</p>
            <Button href="/">Ir al inicio</Button>
        </main>
    );
}
