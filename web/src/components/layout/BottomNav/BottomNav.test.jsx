// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { Building2, ChartLine, ClipboardCheck, FileBarChart, LayoutDashboard, ScanFace, Users } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import BottomNav from './BottomNav.jsx';

const DOCENTE = [
    { href: '/docente', label: 'Panel', icon: LayoutDashboard },
    { href: '/docente/revision', label: 'Revisión', icon: ClipboardCheck },
    { href: '/reportes', label: 'Reportes', icon: FileBarChart },
    { href: '/analitica', label: 'Analítica', icon: ChartLine },
];
// Navegación real del docente: «Pasar lista» es también destino del riel y la acción del botón central.
const DOCENTE_CON_PASAR_LISTA = [
    { href: '/docente', label: 'Panel', icon: LayoutDashboard },
    { href: '/docente/pasar-lista', label: 'Pasar lista', icon: ScanFace },
    { href: '/docente/revision', label: 'Revisión', icon: ClipboardCheck },
    { href: '/reportes', label: 'Reportes', icon: FileBarChart },
    { href: '/analitica', label: 'Analítica', icon: ChartLine },
];
const PASAR_LISTA = { href: '/docente/pasar-lista', label: 'Pasar lista', icon: ScanFace };
const ADMIN = [
    { href: '/admin', label: 'Inicio', icon: LayoutDashboard },
    { href: '/admin/grupos', label: 'Grupos', icon: Users },
    { href: '/admin/aulas', label: 'Aulas', icon: Building2 },
    { href: '/reportes', label: 'Reportes', icon: FileBarChart },
    { href: '/analitica', label: 'Analítica', icon: ChartLine },
];

// Orden de lectura de los controles dentro de la barra (enlaces y botones).
const orden = (contenedor) => [...contenedor.querySelectorAll('a, button')].map((e) => e.getAttribute('aria-label') ?? e.textContent.trim());

describe('BottomNav', () => {
    it('con menos de dos destinos y sin «Más» no se muestra (no aporta)', () => {
        const { container, rerender } = render(<BottomNav items={[DOCENTE[0]]} pathname="/docente" onBuscar={() => {}} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<BottomNav items={[]} pathname="/" />);
        expect(container).toBeEmptyDOMElement();
        rerender(<BottomNav pathname="/" />);
        expect(container).toBeEmptyDOMElement();
        // aunque haya «Más», sin ningún destino no hay nada que mostrar
        rerender(<BottomNav items={[]} pathname="/" onMas={() => {}} onBuscar={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('con un solo destino y «Más» sí se muestra: «Más» es la única puerta al cajón (cuenta, búsqueda, salir)', () => {
        const onMas = vi.fn();
        render(<BottomNav items={[DOCENTE[0]]} pathname="/docente" onMas={onMas} onBuscar={() => {}} />);
        expect(orden(screen.getByRole('navigation'))).toEqual(['Panel', 'Buscar o ir a', 'Más']);
        fireEvent.click(screen.getByRole('button', { name: 'Más' }));
        expect(onMas).toHaveBeenCalledTimes(1);
    });

    it('con «Más» los destinos se recortan a 3 aunque quepan 4: «Más» siempre cierra la derecha', () => {
        render(<BottomNav items={DOCENTE} pathname="/docente" onMas={() => {}} onBuscar={() => {}} />);
        expect(orden(screen.getByRole('navigation'))).toEqual(['Panel', 'Revisión', 'Buscar o ir a', 'Reportes', 'Más']);
        expect(screen.queryByRole('link', { name: 'Analítica' })).toBeNull();
    });

    it('docente real (Pasar lista al centro): 2 destinos, el centro, 1 destino y «Más»; «Analítica» pasa al cajón y enciende «Más»', () => {
        const { rerender } = render(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/docente" onMas={() => {}} accionCentral={PASAR_LISTA} />);
        expect(orden(screen.getByRole('navigation'))).toEqual(['Panel', 'Revisión', 'Pasar lista', 'Reportes', 'Más']);
        expect(screen.getByRole('button', { name: 'Más' })).not.toHaveClass('bg-accent');
        rerender(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/analitica" onMas={() => {}} accionCentral={PASAR_LISTA} />);
        expect(screen.getByRole('button', { name: 'Más' })).toHaveClass('bg-accent');
    });

    it('es una navegación con nombre, flotante y solo para teléfono (oculta desde lg)', () => {
        render(<BottomNav items={DOCENTE} pathname="/docente" onBuscar={() => {}} />);
        const nav = screen.getByRole('navigation', { name: 'Navegación inferior' });
        expect(nav).toHaveClass('fixed', 'bottom-0', 'lg:hidden');
        expect(nav.className).toContain('env(safe-area-inset-bottom)');
        // la píldora flota: separada de los bordes, redondeada, con sombra
        const pildora = nav.querySelector('ul');
        expect(pildora).toHaveClass('shadow-lift');
        expect(pildora.className).toContain('rounded-[1.75rem]');
    });

    it('el botón de buscar queda en el centro: dos destinos a cada lado', () => {
        render(<BottomNav items={DOCENTE} pathname="/docente" onBuscar={() => {}} />);
        expect(orden(screen.getByRole('navigation'))).toEqual(['Panel', 'Revisión', 'Buscar o ir a', 'Reportes', 'Analítica']);
    });

    it('el destino activo lleva aria-current, fondo suave y etiqueta en negrita; los demás no', () => {
        render(<BottomNav items={DOCENTE} pathname="/docente/revision/caso-4" onBuscar={() => {}} />);
        const activo = screen.getByRole('link', { name: 'Revisión' });
        expect(activo).toHaveAttribute('aria-current', 'page');
        expect(activo).toHaveClass('bg-accent');
        expect(screen.getByText('Revisión')).toHaveClass('font-semibold');
        // /docente no se enciende con /docente/revision (gana la coincidencia más larga)
        const inicio = screen.getByRole('link', { name: 'Panel' });
        expect(inicio).not.toHaveAttribute('aria-current');
        expect(inicio).not.toHaveClass('bg-accent');
        expect(screen.getByText('Panel')).toHaveClass('font-medium');
    });

    it('el botón central dispara onBuscar', () => {
        const onBuscar = vi.fn();
        render(<BottomNav items={DOCENTE} pathname="/docente" onBuscar={onBuscar} />);
        fireEvent.click(screen.getByRole('button', { name: 'Buscar o ir a' }));
        expect(onBuscar).toHaveBeenCalledTimes(1);
    });

    it('sin onBuscar no hay botón central ni hueco: solo los destinos', () => {
        render(<BottomNav items={DOCENTE} pathname="/docente" />);
        const nav = screen.getByRole('navigation');
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getAllByRole('listitem')).toHaveLength(4);
        expect(orden(nav)).toEqual(['Panel', 'Revisión', 'Reportes', 'Analítica']);
    });

    it('con más de 4 destinos muestra 3 y «Más» cierra la derecha; «Más» abre el cajón', () => {
        const onMas = vi.fn();
        render(<BottomNav items={ADMIN} pathname="/admin" onMas={onMas} onBuscar={() => {}} />);
        expect(orden(screen.getByRole('navigation'))).toEqual(['Inicio', 'Grupos', 'Buscar o ir a', 'Aulas', 'Más']);
        fireEvent.click(screen.getByRole('button', { name: 'Más' }));
        expect(onMas).toHaveBeenCalledTimes(1);
    });

    it('«Más» se enciende cuando la pantalla actual es un destino que quedó oculto', () => {
        const { rerender } = render(<BottomNav items={ADMIN} pathname="/analitica" onMas={() => {}} onBuscar={() => {}} />);
        expect(screen.getByRole('button', { name: 'Más' })).toHaveClass('bg-accent');
        rerender(<BottomNav items={ADMIN} pathname="/admin/grupos" onMas={() => {}} onBuscar={() => {}} />);
        expect(screen.getByRole('button', { name: 'Más' })).not.toHaveClass('bg-accent');
        expect(screen.getByRole('link', { name: 'Grupos' })).toHaveAttribute('aria-current', 'page');
    });

    it('los iconos son decorativos (aria-hidden) y el botón central no cuenta como destino', () => {
        const { container } = render(<BottomNav items={DOCENTE} pathname="/docente" onBuscar={() => {}} />);
        container.querySelectorAll('svg').forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
        expect(screen.getAllByRole('link')).toHaveLength(4);
        expect(screen.getAllByRole('listitem')).toHaveLength(5); // 4 destinos + el botón central
    });

    describe('acción central (accionCentral)', () => {
        it('con accionCentral {href,label,icon} el centro es un ENLACE «Pasar lista» con etiqueta visible, no el buscador', () => {
            render(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/docente" onBuscar={() => {}} accionCentral={PASAR_LISTA} />);
            const centro = screen.getByRole('link', { name: 'Pasar lista' });
            expect(centro).toHaveAttribute('href', '/docente/pasar-lista');
            expect(centro).toHaveTextContent('Pasar lista'); // etiqueta visible bajo el círculo, además del nombre accesible
            expect(screen.queryByRole('button', { name: 'Buscar o ir a' })).toBeNull();
            expect(centro.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        });

        it('el centro queda entre dos destinos a cada lado y la acción no se repite como destino lateral', () => {
            render(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/docente" onBuscar={() => {}} accionCentral={PASAR_LISTA} />);
            const nav = screen.getByRole('navigation');
            expect(orden(nav)).toEqual(['Panel', 'Revisión', 'Pasar lista', 'Reportes', 'Analítica']);
            // 4 destinos + el centro: cabe sin «Más»
            expect(screen.queryByRole('button', { name: 'Más' })).toBeNull();
            expect(screen.getAllByRole('link')).toHaveLength(5);
        });

        it('no necesita onBuscar: con accionCentral el centro sigue ahí', () => {
            render(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/docente" accionCentral={PASAR_LISTA} />);
            expect(screen.getByRole('link', { name: 'Pasar lista' })).toBeInTheDocument();
        });

        it('en /docente/pasar-lista (y rutas que cuelgan de ella) el centro lleva aria-current y ningún destino lateral se enciende', () => {
            const { rerender } = render(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/docente/pasar-lista" accionCentral={PASAR_LISTA} />);
            expect(screen.getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('aria-current', 'page');
            // «Panel» comparte prefijo (/docente) pero no se enciende
            expect(screen.getByRole('link', { name: 'Panel' })).not.toHaveAttribute('aria-current');
            rerender(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/docente/pasar-lista/otra" accionCentral={PASAR_LISTA} />);
            expect(screen.getByRole('link', { name: 'Pasar lista' })).toHaveAttribute('aria-current', 'page');
        });

        it('en otras rutas el centro no está activo y el destino que corresponde sí', () => {
            render(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/docente/sesiones/19" accionCentral={PASAR_LISTA} />);
            expect(screen.getByRole('link', { name: 'Pasar lista' })).not.toHaveAttribute('aria-current');
            expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute('aria-current', 'page');
        });

        it('si la acción central no es un destino de la navegación, tampoco se quita ninguno', () => {
            render(<BottomNav items={DOCENTE} pathname="/docente" accionCentral={PASAR_LISTA} />);
            expect(orden(screen.getByRole('navigation'))).toEqual(['Panel', 'Revisión', 'Pasar lista', 'Reportes', 'Analítica']);
        });

        it('accionCentral con onClick (sin href) es un botón con su etiqueta accesible', () => {
            const onClick = vi.fn();
            render(<BottomNav items={DOCENTE} pathname="/docente" accionCentral={{ label: 'Crear', icon: ScanFace, onClick }} />);
            fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('sin accionCentral el centro por omisión sigue siendo «Buscar o ir a» (alumno, administrador, técnico)', () => {
            const onBuscar = vi.fn();
            render(<BottomNav items={ADMIN} pathname="/admin" onMas={() => {}} onBuscar={onBuscar} accionCentral={null} />);
            fireEvent.click(screen.getByRole('button', { name: 'Buscar o ir a' }));
            expect(onBuscar).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole('link', { name: 'Pasar lista' })).toBeNull();
        });

        it('el botón central con enlace conserva el área táctil: círculo de 56 px que sobresale de la píldora', () => {
            render(<BottomNav items={DOCENTE_CON_PASAR_LISTA} pathname="/docente" accionCentral={PASAR_LISTA} />);
            const centro = screen.getByRole('link', { name: 'Pasar lista' });
            expect(centro).toHaveClass('absolute', '-translate-y-5');
            expect(centro.firstElementChild).toHaveClass('size-14', 'rounded-full', 'bg-primary');
        });
    });
});
