import { Inter, Instrument_Serif, Geist_Mono } from 'next/font/google';
import './globals.css';

// Fuentes autoalojadas por Next (sin request a Google en runtime). Interfaz: Inter. Titulares emocionales: Instrument Serif
// (utilidad `font-display`; ver docs/design/SISTEMA.md). Solo subconjuntos latinos y los pesos usados.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const displaySerif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], display: 'swap', variable: '--font-display-serif' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
    title: { default: 'SUSAN', template: '%s · SUSAN' },
    description: 'Sistema centralizado de registro digital de asistencia académica y análisis numérico del ausentismo.',
    icons: { icon: '/brand/unach-escudo.png' },
};

// viewportFit:'cover' habilita env(safe-area-inset-*) en teléfonos con notch.
export const viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#f6f5f1',
};

export default function RootLayout({ children }) {
    return (
        <html lang="es" className={`${inter.variable} ${displaySerif.variable} ${mono.variable}`}>
            <body className="min-h-screen">{children}</body>
        </html>
    );
}
