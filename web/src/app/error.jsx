'use client';

import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';

export default function GlobalError({ reset }) {
    return (
        <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-4">
            <ErrorState title="Algo salió mal" error="Ocurrió un error inesperado." onRetry={reset} />
        </main>
    );
}
