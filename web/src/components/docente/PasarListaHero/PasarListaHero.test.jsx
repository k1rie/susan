// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PasarListaHero from './PasarListaHero.jsx';

const ses = (id, extra = {}) => ({
    id_sesion: id, id_grupo: 1, materia: 'Finanzas', clave_grupo: '3A', aula: 'A-101', fecha: '2026-09-14',
    hora_inicio: '07:00:00', hora_fin: '08:00:00', estatus: 'programada', modo_previsto: 'automatico', camaras_activas: 1, abrible: false, ...extra,
});

const boton = (nombre) => screen.getByRole('link', { name: nombre });

describe('PasarListaHero: una sesión protagonista y UN botón claro', () => {
    it('sesión abierta: «Continuar pase de lista» lleva directo a la sesión con ?pasar-lista=1', () => {
        render(<PasarListaHero sesiones={[ses(19, { estatus: 'abierta', abrible: false })]} hora="07:12:00" />);
        const hero = screen.getByRole('region', { name: 'Pasar lista' });
        expect(hero).toHaveAttribute('data-fase', 'abierta');
        expect(within(hero).getByRole('heading', { level: 3, name: 'Finanzas (3A)' })).toBeInTheDocument();
        expect(within(hero).getByText('07:00 - 08:00 · Aula A-101')).toBeInTheDocument();
        expect(within(hero).getByText('Abierta')).toBeInTheDocument();
        expect(boton('Continuar pase de lista')).toHaveAttribute('href', '/docente/sesiones/19?pasar-lista=1');
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('programada dentro de su horario (abrible): «Abrir y pasar lista» va a /docente/pasar-lista?sesion=<id>', () => {
        render(<PasarListaHero sesiones={[ses(115, { abrible: true })]} hora="07:12:00" />);
        expect(boton('Abrir y pasar lista')).toHaveAttribute('href', '/docente/pasar-lista?sesion=115');
        expect(screen.getByText('Programada')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Pasar lista' })).toHaveAttribute('data-fase', 'abrible');
    });

    it('programada que aún no es su hora: botón DESHABILITADO «Disponible a las HH:MM» y la regla de la ventana', () => {
        render(<PasarListaHero sesiones={[ses(115, { hora_inicio: '09:00:00', hora_fin: '10:00:00' })]} hora="07:12:00" />);
        const b = screen.getByRole('button', { name: 'Disponible a las 09:00' });
        expect(b).toBeDisabled();
        // la regla (RN-06, api_abrir_sesion) se explica y está enlazada al botón para lectores de pantalla
        const regla = screen.getByText('La sesión solo puede abrirse dentro de su horario, de 09:00 a 10:00.');
        expect(b).toHaveAttribute('aria-describedby', regla.id);
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByRole('region', { name: 'Pasar lista' })).toHaveAttribute('data-fase', 'espera');
    });

    it('programada cuyo horario ya terminó: deshabilitado «Terminó a las HH:MM»', () => {
        render(<PasarListaHero sesiones={[ses(115)]} hora="09:30:00" />);
        expect(screen.getByRole('button', { name: 'Terminó a las 08:00' })).toBeDisabled();
        expect(screen.getByRole('region', { name: 'Pasar lista' })).toHaveAttribute('data-fase', 'vencida');
    });

    it('sin la hora del plantel no afirma si es antes o después: «Disponible de HH:MM a HH:MM»', () => {
        render(<PasarListaHero sesiones={[ses(115)]} />);
        expect(screen.getByRole('button', { name: 'Disponible de 07:00 a 08:00' })).toBeDisabled();
    });

    it('sesión cerrada: «Ver resultados» (botón secundario) a la sesión sin ?pasar-lista', () => {
        render(<PasarListaHero sesiones={[ses(19, { estatus: 'cerrada', modo_previsto: 'manual' })]} hora="15:00:00" />);
        const b = boton('Ver resultados');
        expect(b).toHaveAttribute('href', '/docente/sesiones/19');
        expect(b).toHaveClass('bg-card'); // secundario: la sesión ya terminó
        expect(screen.getByText('Cerrada')).toBeInTheDocument();
        // una sesión cerrada ya no dice qué cámara se usará
        expect(screen.queryByText(/cámara/i)).toBeNull();
    });

    it('sesión suspendida: «Ver sesión»', () => {
        render(<PasarListaHero sesiones={[ses(19, { estatus: 'suspendida' })]} hora="07:12:00" />);
        expect(boton('Ver sesión')).toHaveAttribute('href', '/docente/sesiones/19');
        expect(screen.getByText('Suspendida')).toBeInTheDocument();
    });

    it('sin sesiones hoy: estado vacío amable, sin botones', () => {
        render(<PasarListaHero sesiones={[]} hora="07:12:00" />);
        const hero = screen.getByRole('region', { name: 'Pasar lista' });
        expect(hero).toHaveAttribute('data-fase', 'sin_sesiones');
        expect(within(hero).getByText('Hoy no tienes clases programadas')).toBeInTheDocument();
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('tolera sesiones indefinidas (panel sin datos aún)', () => {
        render(<PasarListaHero />);
        expect(screen.getByText('Hoy no tienes clases programadas')).toBeInTheDocument();
    });
});

describe('PasarListaHero: qué cámara se usará', () => {
    it('con cámara activa en el aula: «Cámara del aula lista»', () => {
        render(<PasarListaHero sesiones={[ses(1, { abrible: true, camaras_activas: 1, modo_previsto: 'automatico' })]} hora="07:12" />);
        expect(screen.getByText('Cámara del aula lista')).toBeInTheDocument();
        expect(screen.queryByText(/Sin cámara/)).toBeNull();
    });

    it('sin cámara activa: «Sin cámara activa: se pasa lista a mano»', () => {
        render(<PasarListaHero sesiones={[ses(1, { abrible: true, camaras_activas: 0, modo_previsto: 'manual' })]} hora="07:12" />);
        expect(screen.getByText('Sin cámara activa: se pasa lista a mano')).toBeInTheDocument();
        expect(screen.queryByText('Cámara del aula lista')).toBeNull();
    });

    it('sesión abierta en modo manual: se pasa lista a mano aunque el aula tenga cámaras', () => {
        render(<PasarListaHero sesiones={[ses(1, { estatus: 'abierta', modo_previsto: 'manual', camaras_activas: 2 })]} hora="07:12" />);
        expect(screen.getByText('Sin cámara activa: se pasa lista a mano')).toBeInTheDocument();
    });

    it('los iconos son decorativos (aria-hidden)', () => {
        const { container } = render(<PasarListaHero sesiones={[ses(1, { abrible: true })]} hora="07:12" />);
        container.querySelectorAll('svg').forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
    });
});

describe('PasarListaHero: elección de la sesión protagonista con varias sesiones', () => {
    const cerrada = ses(1, { estatus: 'cerrada', hora_inicio: '07:00:00', hora_fin: '08:00:00', materia: 'Cálculo' });
    const abierta = ses(2, { estatus: 'abierta', hora_inicio: '08:00:00', hora_fin: '09:00:00', materia: 'Álgebra' });
    const futura = ses(3, { hora_inicio: '11:00:00', hora_fin: '12:00:00', materia: 'Ética' });

    it('la abierta gana a la cerrada y a la futura', () => {
        render(<PasarListaHero sesiones={[cerrada, abierta, futura]} hora="08:20:00" />);
        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Álgebra (3A)');
    });

    it('sin abierta ni abrible, la siguiente programada', () => {
        render(<PasarListaHero sesiones={[cerrada, futura]} hora="09:00:00" />);
        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Ética (3A)');
        expect(screen.getByRole('button', { name: 'Disponible a las 11:00' })).toBeDisabled();
    });

    it('si todo cerró, la última cerrada', () => {
        const otra = ses(4, { estatus: 'cerrada', hora_inicio: '09:00:00', hora_fin: '10:00:00', materia: 'Física' });
        render(<PasarListaHero sesiones={[cerrada, otra]} hora="15:00:00" />);
        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Física (3A)');
    });

    it('«Otras sesiones de hoy (N)» cuenta las demás y lleva a la lista completa del panel', () => {
        render(<PasarListaHero sesiones={[cerrada, abierta, futura]} hora="08:20:00" />);
        const otras = screen.getByRole('link', { name: /Otras sesiones de hoy \(2\)/ });
        expect(otras).toHaveAttribute('href', '#sesiones-hoy');
    });

    it('otrasHref personalizado', () => {
        render(<PasarListaHero sesiones={[cerrada, abierta]} hora="08:20:00" otrasHref="/docente#lista" />);
        expect(screen.getByRole('link', { name: /Otras sesiones de hoy \(1\)/ })).toHaveAttribute('href', '/docente#lista');
    });

    it('con una sola sesión no hay «Otras sesiones de hoy»', () => {
        render(<PasarListaHero sesiones={[abierta]} hora="08:20:00" />);
        expect(screen.queryByText(/Otras sesiones/)).toBeNull();
    });
});

describe('PasarListaHero: 360 px y botón grande', () => {
    it('el botón ocupa todo el ancho en teléfono (w-full) y es alto (h-12); a partir de sm vuelve a su ancho', () => {
        render(<PasarListaHero sesiones={[ses(19, { estatus: 'abierta' })]} hora="07:12" />);
        expect(boton('Continuar pase de lista')).toHaveClass('w-full', 'h-12', 'sm:w-auto');
    });

    it('el botón deshabilitado también ocupa todo el ancho', () => {
        render(<PasarListaHero sesiones={[ses(1)]} hora="06:00" />);
        expect(screen.getByRole('button', { name: /Disponible a las 07:00/ })).toHaveClass('w-full', 'h-12');
    });
});
