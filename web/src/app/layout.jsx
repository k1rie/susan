import { Hanken_Grotesk, EB_Garamond, Geist_Mono } from 'next/font/google';
import './globals.css';

// Fuentes autoalojadas por Next (sin request a Google en runtime). Interfaz: Hanken Grotesk (grotesca limpia, la alternativa libre más
// cercana a la de Dropbox Dash). Serif de marca (utilidad `font-display`): EB Garamond, solo saludo del Home y titulares de acceso.
// Solo subconjuntos latinos y los pesos usados (ver docs/design/SISTEMA.md).
const hanken = Hanken_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-hanken' });
const displaySerif = EB_Garamond({ subsets: ['latin'], weight: ['500'], style: ['normal', 'italic'], display: 'swap', variable: '--font-display-serif' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
    title: { default: 'SUSAN', template: '%s · SUSAN' },
    description: 'Sistema centralizado de registro digital de asistencia académica y análisis numérico del ausentismo.',
};

// viewportFit:'cover' habilita env(safe-area-inset-*) en teléfonos con notch.
export const viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#f7f5f2',
};

export default function RootLayout({ children }) {
    return (
        <html lang="es" className={`${hanken.variable} ${displaySerif.variable} ${mono.variable}`}>
            <body className="min-h-screen">{children}</body>
        </html>
    );
}
