'use client';

import ErrorState from '@/components/ui/ErrorState/ErrorState.jsx';

export default function AppError({ error, reset }) {
    return <ErrorState title="Algo salió mal" error="No se pudo cargar la página. Inténtalo de nuevo." onRetry={reset} />;
}
