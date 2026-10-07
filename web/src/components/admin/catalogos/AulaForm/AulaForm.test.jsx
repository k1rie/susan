// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({ aulaGuardar: (...a) => guardar(...a) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }));

import AulaForm from './AulaForm.jsx';

const creada = { id_aula: 9, clave: 'A-13', edificio: 'Edificio A', capacidad: 30, creado: true };

function abrir(props = {}) {
    const onClose = vi.fn();
    const onGuardado = vi.fn();
    const utils = render(<AulaForm onClose={onClose} onGuardado={onGuardado} {...props} />);
    return { onClose, onGuardado, ...utils };
}

beforeEach(() => guardar.mockReset());

describe('AulaForm: alta en panel lateral', () => {
    it('abre un panel con tres campos con ejemplo y el foco en la clave', () => {
        abrir();
        const panel = screen.getByRole('dialog', { name: 'Nueva aula' });
        expect(within(panel).getByLabelText(/Clave/)).toHaveFocus();
        expect(within(panel).getByLabelText(/Clave/)).toHaveAttribute('maxlength', '10');
        expect(within(panel).getByLabelText(/Edificio/)).toHaveAttribute('maxlength', '40');
        expect(within(panel).getByText(/Ej\. A-12/)).toBeInTheDocument();
        expect(within(panel).getByText(/Ej\. Edificio A/)).toBeInTheDocument();
        expect(within(panel).getByRole('button', { name: 'Crear aula' })).toBeEnabled();
    });

    it('pasa la clave a mayúsculas al salir del campo y valida al salir, no al teclear', async () => {
        const user = userEvent.setup();
        abrir();
        const clave = screen.getByLabelText(/Clave/);
        await user.type(clave, 'a-1');
        expect(screen.queryByRole('alert')).toBeNull();
        await user.tab();
        expect(clave).toHaveValue('A-1');
        await user.clear(clave);
        await user.tab();
        expect(screen.getByText('Escribe la clave del aula, por ejemplo A-12.')).toBeInTheDocument();
    });

    it('pasar de largo por un campo vacío no lo pinta de rojo; el error llega al enviar', async () => {
        const user = userEvent.setup();
        abrir();
        await user.tab();
        await user.tab();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.getByLabelText(/Clave/)).not.toHaveAttribute('aria-invalid');
        await user.click(screen.getByRole('button', { name: 'Crear aula' }));
        expect(screen.getByText('Escribe la clave del aula, por ejemplo A-12.')).toBeInTheDocument();
    });

    it('con datos inválidos no envía, muestra los errores y enfoca el primero', async () => {
        const user = userEvent.setup();
        abrir();
        await user.click(screen.getByRole('button', { name: 'Crear aula' }));
        expect(guardar).not.toHaveBeenCalled();
        expect(screen.getByLabelText(/Clave/)).toHaveFocus();
        expect(screen.getByText('Escribe el edificio, por ejemplo Edificio A.')).toBeInTheDocument();
        expect(screen.getByText('Escribe la capacidad: un número entero de 1 a 1000.')).toBeInTheDocument();
        // El pie también lo dice, junto a los botones.
        expect(screen.getByText('Revisa los campos marcados.')).toBeInTheDocument();
    });

    it('envía los datos normalizados y ofrece la pantalla de éxito con el siguiente paso', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creada);
        const { onGuardado } = abrir();
        await user.type(screen.getByLabelText(/Clave/), 'a-13');
        await user.type(screen.getByLabelText(/Edificio/), '  Edificio   A ');
        await user.type(screen.getByLabelText(/Capacidad/), '30');
        await user.click(screen.getByRole('button', { name: 'Crear aula' }));
        await waitFor(() => expect(guardar).toHaveBeenCalledWith({ datos: { clave: 'A-13', edificio: 'Edificio A', capacidad: 30 } }));
        expect(onGuardado).toHaveBeenCalledWith(creada);
        expect(await screen.findByRole('heading', { name: 'Aula A-13 creada' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Crear un grupo en esta aula/ })).toHaveAttribute('href', '/admin/grupos/nuevo');
        expect(screen.getByRole('button', { name: 'Crear otra aula' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ir a la lista' })).toBeInTheDocument();
    });

    it('«Crear otra aula» vuelve al formulario vacío', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creada);
        abrir();
        await user.type(screen.getByLabelText(/Clave/), 'A-13');
        await user.type(screen.getByLabelText(/Edificio/), 'Edificio A');
        await user.type(screen.getByLabelText(/Capacidad/), '30');
        await user.click(screen.getByRole('button', { name: 'Crear aula' }));
        await user.click(await screen.findByRole('button', { name: 'Crear otra aula' }));
        expect(screen.getByLabelText(/Clave/)).toHaveValue('');
        expect(screen.getByLabelText(/Edificio/)).toHaveValue('');
        expect(screen.queryByText(/cambios? sin guardar/i)).toBeNull();
    });

    it('«Crear y agregar otra» guarda, conserva el edificio y deja el foco en la clave', async () => {
        const user = userEvent.setup();
        guardar.mockResolvedValue(creada);
        const { onClose } = abrir();
        await user.type(screen.getByLabelText(/Clave/), 'A-13');
        await user.type(screen.getByLabelText(/Edificio/), 'Edificio A');
        await user.type(screen.getByLabelText(/Capacidad/), '30');
        await user.click(screen.getByRole('button', { name: 'Crear y agregar otra' }));
        await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByLabelText(/Clave/)).toHaveValue(''));
        expect(screen.getByLabelText(/Edificio/)).toHaveValue('Edificio A');
        expect(screen.getByLabelText(/Capacidad/)).toHaveValue('');
        expect(screen.getByLabelText(/Clave/)).toHaveFocus();
        expect(onClose).not.toHaveBeenCalled();
        // No pasa a la pantalla de éxito: se queda en el formulario para seguir capturando.
        expect(screen.queryByRole('heading', { name: /creada/ })).toBeNull();
    });

    it('un DUPLICADO se pega al campo clave con el texto del servidor y conserva lo escrito', async () => {
        const user = userEvent.setup();
        guardar.mockRejectedValueOnce({ code: 'DUPLICADO', message: 'Ya existe un aula con la clave A-12.' });
        abrir();
        await user.type(screen.getByLabelText(/Clave/), 'A-12');
        await user.type(screen.getByLabelText(/Edificio/), 'Edificio A');
        await user.type(screen.getByLabelText(/Capacidad/), '40');
        await user.click(screen.getByRole('button', { name: 'Crear aula' }));
        const clave = screen.getByLabelText(/Clave/);
        await waitFor(() => expect(clave).toHaveAttribute('aria-invalid', 'true'));
        expect(screen.getAllByText('Ya existe un aula con la clave A-12.').length).toBeGreaterThan(0);
        expect(clave).toHaveFocus();
        expect(screen.getByLabelText(/Edificio/)).toHaveValue('Edificio A');
        expect(screen.queryByRole('heading', { name: /creada/ })).toBeNull();
    });

    it('un error sin campo (red) va al aviso del formulario con el título del aula', async () => {
        const user = userEvent.setup();
        guardar.mockRejectedValueOnce({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.' });
        abrir();
        await user.type(screen.getByLabelText(/Clave/), 'A-12');
        await user.type(screen.getByLabelText(/Edificio/), 'Edificio A');
        await user.type(screen.getByLabelText(/Capacidad/), '40');
        await user.click(screen.getByRole('button', { name: 'Crear aula' }));
        const aviso = await screen.findByText('No se pudo guardar el aula');
        expect(aviso.closest('[role="alert"]')).toHaveTextContent('No se pudo conectar con el servidor.');
    });

    it('los botones «−» y «+» ajustan la capacidad dentro de 1 a 1000', async () => {
        const user = userEvent.setup();
        abrir();
        const capacidad = screen.getByLabelText(/Capacidad/);
        await user.click(screen.getByRole('button', { name: 'Aumentar capacidad' }));
        expect(capacidad).toHaveValue('30');
        await user.click(screen.getByRole('button', { name: 'Disminuir capacidad' }));
        expect(capacidad).toHaveValue('29');
        await user.clear(capacidad);
        await user.type(capacidad, '1a2');
        expect(capacidad).toHaveValue('12');
    });

    it('cerrar con lo escrito pide confirmar y «Seguir editando» conserva el panel', async () => {
        const user = userEvent.setup();
        const { onClose } = abrir();
        await user.type(screen.getByLabelText(/Clave/), 'A-1');
        await user.keyboard('{Escape}');
        expect(await screen.findByText('¿Descartar los cambios?')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByLabelText(/Clave/)).toHaveValue('A-1');
        await user.keyboard('{Escape}');
        await user.click(await screen.findByRole('button', { name: 'Descartar cambios' }));
        expect(onClose).toHaveBeenCalled();
    });
});

describe('AulaForm: edición', () => {
    const item = { id_aula: 4, clave: 'B-04', edificio: 'Edificio B', capacidad: 35 };

    it('parte de lo guardado, apaga «Guardar cambios» sin cambios y lo dice', () => {
        abrir({ item });
        expect(screen.getByRole('dialog', { name: 'Editar aula' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Clave/)).toHaveValue('B-04');
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
        expect(screen.getByText('Aún no hay cambios que guardar.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Crear y agregar otra' })).toBeNull();
    });

    it('guarda con el id, avisa y cierra el panel; el AULA_CAPACIDAD_INSUFICIENTE queda junto a la capacidad', async () => {
        const user = userEvent.setup();
        guardar.mockRejectedValueOnce({ code: 'AULA_CAPACIDAD_INSUFICIENTE', message: 'Un grupo del aula tiene 38 inscritos activos; la capacidad no puede ser menor.' });
        guardar.mockResolvedValueOnce({ ...item, capacidad: 40 });
        const { onClose, onGuardado } = abrir({ item });
        const capacidad = screen.getByLabelText(/Capacidad/);
        await user.clear(capacidad);
        await user.type(capacidad, '20');
        expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(capacidad).toHaveAttribute('aria-invalid', 'true'));
        expect(screen.getAllByText(/38 inscritos activos/).length).toBeGreaterThan(0);
        expect(onClose).not.toHaveBeenCalled();
        await user.clear(capacidad);
        await user.type(capacidad, '40');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(guardar).toHaveBeenLastCalledWith({ datos: { id_aula: 4, clave: 'B-04', edificio: 'Edificio B', capacidad: 40 } });
        expect(onGuardado).toHaveBeenCalled();
    });
});
