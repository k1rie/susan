// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Field from '../Field/Field.jsx';
import FileInput from './FileInput.jsx';

const MB = 1024 * 1024;
const pdf = (nombre = 'consentimiento.pdf', size = 2048) => {
    const f = new File(['x'], nombre, { type: 'application/pdf' });
    Object.defineProperty(f, 'size', { value: size });
    return f;
};
const foto = (nombre = 'foto.png') => new File(['\u0089PNG'], nombre, { type: 'image/png' });
const zonaDe = (contenedor) => contenedor.querySelector('[data-estado]');

describe('FileInput variante boton (compatible)', () => {
    it('al elegir un archivo válido llama a onSelect(file)', async () => {
        const onSelect = vi.fn();
        render(<FileInput onSelect={onSelect} accept=".pdf" maxBytes={10 * MB} />);
        const archivo = pdf();
        await userEvent.upload(screen.getByTestId('file-input'), archivo);
        expect(onSelect).toHaveBeenCalledWith(archivo);
    });

    it('rechaza tipo y tamaño con el mensaje de siempre y limpia la selección', async () => {
        const onSelect = vi.fn();
        const { rerender } = render(<FileInput onSelect={onSelect} accept=".pdf" maxBytes={1 * MB} />);
        fireEvent.change(screen.getByTestId('file-input'), { target: { files: [new File(['x'], 'a.exe')] } });
        expect(onSelect).toHaveBeenLastCalledWith(null);
        expect(screen.getByRole('alert')).toHaveTextContent('Tipo de archivo no permitido.');
        rerender(<FileInput onSelect={onSelect} accept=".pdf" maxBytes={1 * MB} />);
        fireEvent.change(screen.getByTestId('file-input'), { target: { files: [pdf('grande.pdf', 3 * MB)] } });
        expect(screen.getByRole('alert')).toHaveTextContent('El archivo supera 1 MB.');
    });

    it('muestra nombre y tamaño y «Quitar» vacía el valor', async () => {
        const onSelect = vi.fn();
        render(<FileInput value={pdf('acta.pdf', 2048)} onSelect={onSelect} />);
        expect(screen.getByText('acta.pdf (2 KB)')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));
        expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('el botón abre el selector nativo', async () => {
        const abrir = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
        render(<FileInput onSelect={() => {}} label="Elegir archivo CSV" />);
        await userEvent.click(screen.getByRole('button', { name: 'Elegir archivo CSV' }));
        expect(abrir).toHaveBeenCalled();
    });

    it('muestra un error externo (de servidor) y lo enlaza con el botón', () => {
        render(<FileInput onSelect={() => {}} error="No se pudo subir." />);
        const alerta = screen.getByRole('alert');
        expect(alerta).toHaveTextContent('No se pudo subir.');
        expect(screen.getByRole('button', { name: 'Seleccionar archivo' })).toHaveAttribute('aria-describedby', alerta.id);
    });

    it('con Field, la etiqueta y el id llegan al botón enfocable', () => {
        render(
            <Field label="Documento" required error="Falta el documento">
                <FileInput onSelect={() => {}} />
            </Field>,
        );
        const boton = screen.getByLabelText(/Documento/);
        expect(boton.tagName).toBe('BUTTON');
        expect(boton).toHaveAttribute('aria-invalid', 'true');
        expect(boton).toHaveAttribute('aria-required', 'true');
        // required nativo no se pasa al <input type=file>: sería imposible de cumplir porque se vacía tras elegir.
        expect(screen.getByTestId('file-input')).not.toHaveAttribute('required');
    });

    it('deshabilitado no deja elegir ni quitar', () => {
        render(<FileInput value={pdf()} onSelect={() => {}} disabled />);
        expect(screen.getByRole('button', { name: 'Seleccionar archivo' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Quitar' })).toBeDisabled();
    });

    it('multiple acumula archivos, evita repetidos y respeta maxFiles', async () => {
        const onSelect = vi.fn();
        const a = pdf('a.pdf');
        const { rerender } = render(<FileInput multiple maxFiles={2} accept=".pdf" value={[]} onSelect={onSelect} />);
        expect(screen.getByRole('button', { name: 'Seleccionar archivos' })).toBeInTheDocument();
        fireEvent.change(screen.getByTestId('file-input'), { target: { files: [a] } });
        expect(onSelect).toHaveBeenLastCalledWith([a]);
        rerender(<FileInput multiple maxFiles={2} accept=".pdf" value={[a]} onSelect={onSelect} />);
        expect(screen.getByText('a.pdf')).toBeInTheDocument();
        fireEvent.change(screen.getByTestId('file-input'), { target: { files: [pdf('b.pdf'), pdf('c.pdf')] } });
        expect(onSelect.mock.lastCall[0].map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
        expect(screen.getByRole('alert')).toHaveTextContent('Solo se admiten 2 archivos: sobraron 1.');
    });

    it('multiple: «Quitar nombre» saca solo ese archivo', async () => {
        const onSelect = vi.fn();
        const a = pdf('a.pdf');
        const b = pdf('b.pdf');
        render(<FileInput multiple value={[a, b]} onSelect={onSelect} />);
        await userEvent.click(screen.getByRole('button', { name: 'Quitar a.pdf' }));
        expect(onSelect).toHaveBeenCalledWith([b]);
    });

    it('progress muestra la barra, bloquea el botón y no anuncia cada porcentaje', () => {
        render(<FileInput value={pdf()} onSelect={() => {}} progress={45} />);
        const barra = screen.getByRole('progressbar', { name: 'Progreso de la subida' });
        expect(barra).toHaveAttribute('aria-valuenow', '45');
        expect(screen.getByRole('button', { name: 'Seleccionar archivo' })).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent('Subiendo…');
        expect(screen.getByText('45 %')).toHaveAttribute('aria-hidden', 'true');
    });

    it('preview=imagen muestra la miniatura de una foto', async () => {
        render(<FileInput value={foto()} onSelect={() => {}} preview="imagen" />);
        await waitFor(() => expect(document.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png/));
    });

    it('sin hint explícito la variante boton no agrega texto de reglas', () => {
        render(<FileInput onSelect={() => {}} accept=".pdf" maxBytes={MB} />);
        expect(screen.queryByText(/Máximo/)).toBeNull();
        render(<FileInput onSelect={() => {}} hint="Solo PDF" />);
        expect(screen.getByText('Solo PDF')).toBeInTheDocument();
    });
});

describe('FileInput variante zona', () => {
    it('deduce las reglas visibles de accept y maxBytes', () => {
        render(<FileInput variant="zona" onSelect={() => {}} accept=".pdf" maxBytes={10 * MB} />);
        expect(screen.getByText('PDF. Máximo 10 MB.')).toBeInTheDocument();
        expect(screen.getByText(/Arrastra y suelta aquí, o/)).toBeInTheDocument();
        expect(screen.getByText('selecciona un archivo')).toBeInTheDocument();
    });

    it('hint propio y hint={false}', () => {
        const { rerender } = render(<FileInput variant="zona" onSelect={() => {}} accept=".pdf" hint="Escaneo a color" />);
        expect(screen.getByText('Escaneo a color')).toBeInTheDocument();
        expect(screen.queryByText('PDF.')).toBeNull();
        rerender(<FileInput variant="zona" onSelect={() => {}} accept=".pdf" hint={false} />);
        expect(screen.queryByText('Escaneo a color')).toBeNull();
        expect(screen.queryByText('PDF.')).toBeNull();
    });

    it('el clic abre el selector: el <input> oculto a la vista queda dentro de la etiqueta', async () => {
        const onSelect = vi.fn();
        render(<FileInput variant="zona" onSelect={onSelect} accept=".pdf" />);
        const entrada = screen.getByTestId('file-input');
        expect(entrada).toHaveClass('sr-only');
        expect(entrada.closest('label')).toHaveTextContent('selecciona un archivo');
        const archivo = pdf();
        await userEvent.upload(entrada, archivo);
        expect(onSelect).toHaveBeenCalledWith(archivo);
    });

    it('con teclado la zona recibe el foco por el input nativo', async () => {
        render(<FileInput variant="zona" onSelect={() => {}} />);
        await userEvent.tab();
        expect(screen.getByTestId('file-input')).toHaveFocus();
    });

    it('arrastrar cambia de estado y soltar entrega el archivo', () => {
        const onSelect = vi.fn();
        const { container } = render(<FileInput variant="zona" onSelect={onSelect} accept=".pdf" />);
        const zona = zonaDe(container);
        expect(zona).toHaveAttribute('data-estado', 'vacio');
        const archivo = pdf();
        fireEvent.dragEnter(zona, { dataTransfer: { types: ['Files'] } });
        expect(zona).toHaveAttribute('data-estado', 'arrastrando');
        expect(screen.getByText('Suelta para agregar')).toBeInTheDocument();
        fireEvent.dragOver(zona, { dataTransfer: { types: ['Files'] } });
        fireEvent.drop(zona, { dataTransfer: { types: ['Files'], files: [archivo] } });
        expect(onSelect).toHaveBeenCalledWith(archivo);
        expect(zona).toHaveAttribute('data-estado', 'vacio');
    });

    it('pasar por un hijo no apaga el estado de arrastre (se cuentan entradas y salidas)', () => {
        const { container } = render(<FileInput variant="zona" onSelect={() => {}} />);
        const zona = zonaDe(container);
        const hijo = zona.querySelector('label');
        fireEvent.dragEnter(zona, { dataTransfer: { types: ['Files'] } });
        fireEvent.dragEnter(hijo, { dataTransfer: { types: ['Files'] } });
        fireEvent.dragLeave(zona, { dataTransfer: { types: ['Files'] } });
        expect(zona).toHaveAttribute('data-estado', 'arrastrando');
        fireEvent.dragLeave(hijo, { dataTransfer: { types: ['Files'] } });
        expect(zona).toHaveAttribute('data-estado', 'vacio');
    });

    it('ignora arrastres que no son archivos (texto, enlaces)', () => {
        const { container } = render(<FileInput variant="zona" onSelect={() => {}} />);
        const zona = zonaDe(container);
        fireEvent.dragEnter(zona, { dataTransfer: { types: ['text/plain'] } });
        expect(zona).toHaveAttribute('data-estado', 'vacio');
    });

    it('un archivo soltado inválido muestra error, marca la zona y vacía la selección', () => {
        const onSelect = vi.fn();
        const { container } = render(<FileInput variant="zona" onSelect={onSelect} accept=".pdf" />);
        const zona = zonaDe(container);
        fireEvent.drop(zona, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'virus.exe')] } });
        expect(onSelect).toHaveBeenCalledWith(null);
        expect(screen.getByRole('alert')).toHaveTextContent('Tipo de archivo no permitido.');
        expect(zona).toHaveAttribute('data-estado', 'error');
        expect(screen.getByTestId('file-input')).toHaveAttribute('aria-invalid', 'true');
    });

    it('lista el archivo elegido con tamaño y lo quita', async () => {
        const onSelect = vi.fn();
        const { container } = render(<FileInput variant="zona" value={pdf('acta.pdf', 3 * 1024)} onSelect={onSelect} />);
        expect(zonaDe(container)).toHaveAttribute('data-estado', 'listo');
        const fila = screen.getByRole('listitem');
        expect(within(fila).getByText('acta.pdf')).toBeInTheDocument();
        expect(within(fila).getByText('3 KB')).toBeInTheDocument();
        expect(screen.getByText(/reemplazarlo/)).toBeInTheDocument();
        await userEvent.click(within(fila).getByRole('button', { name: 'Quitar' }));
        expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('preview=imagen dibuja la miniatura y preview=nombre solo el icono', async () => {
        const { rerender } = render(<FileInput variant="zona" value={foto()} onSelect={() => {}} preview="imagen" />);
        await waitFor(() => expect(document.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png/));
        rerender(<FileInput variant="zona" value={foto()} onSelect={() => {}} preview="nombre" />);
        expect(document.querySelector('img')).toBeNull();
    });

    it('multiple + maxFiles: avisa el máximo y quita el selector al llenarse', () => {
        const a = pdf('a.pdf');
        const b = pdf('b.pdf');
        const { rerender } = render(<FileInput variant="zona" multiple maxFiles={2} accept=".pdf" value={[a]} onSelect={() => {}} />);
        expect(screen.getByText('PDF. Hasta 2 archivos.')).toBeInTheDocument();
        expect(screen.getByText(/Arrastra más archivos, o/)).toBeInTheDocument();
        rerender(<FileInput variant="zona" multiple maxFiles={2} accept=".pdf" value={[a, b]} onSelect={() => {}} />);
        expect(screen.queryByTestId('file-input')).toBeNull();
        expect(screen.getByText(/Llegaste al máximo de 2 archivos/)).toBeInTheDocument();
    });

    it('no acepta soltar mientras sube o si está deshabilitado', () => {
        const onSelect = vi.fn();
        const { container, rerender } = render(<FileInput variant="zona" onSelect={onSelect} progress={20} />);
        fireEvent.drop(zonaDe(container), { dataTransfer: { types: ['Files'], files: [pdf()] } });
        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
        expect(zonaDe(container)).toHaveAttribute('data-estado', 'cargando');
        rerender(<FileInput variant="zona" onSelect={onSelect} disabled />);
        fireEvent.drop(zonaDe(container), { dataTransfer: { types: ['Files'], files: [pdf()] } });
        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByTestId('file-input')).toBeDisabled();
    });

    it('con Field: etiqueta el input, hereda aria-describedby y marca required sin el atributo nativo', () => {
        render(
            <Field label="Documento" required hint="Escanea la hoja firmada">
                <FileInput variant="zona" onSelect={() => {}} accept=".pdf" maxBytes={10 * MB} />
            </Field>,
        );
        const entrada = screen.getByLabelText(/Documento/);
        expect(entrada).toBe(screen.getByTestId('file-input'));
        expect(entrada).not.toHaveAttribute('required');
        expect(entrada).toHaveAttribute('aria-required', 'true');
        expect(entrada).toHaveAccessibleDescription(/Escanea la hoja firmada/);
        expect(entrada).toHaveAccessibleDescription(/PDF. Máximo 10 MB./);
    });

    it('un error externo se muestra en la zona y se une a la descripción', () => {
        const { container } = render(<FileInput variant="zona" onSelect={() => {}} error="El servidor lo rechazó." />);
        expect(screen.getByRole('alert')).toHaveTextContent('El servidor lo rechazó.');
        expect(zonaDe(container)).toHaveAttribute('data-estado', 'error');
    });
});
