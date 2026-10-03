import { Inter, Geist_Mono } from 'next/font/google';
import './globals.css';

// Auto-hospedada por Next (sin request a Google en runtime), como en MVP-FITNESS.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
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
    themeColor: '#1f3a5f',
};

export default function RootLayout({ children }) {
    return (
        <html lang="es" className={`${inter.variable} ${mono.variable}`}>
            <body className="min-h-screen antialiased">{children}</body>
        </html>
    );
}
