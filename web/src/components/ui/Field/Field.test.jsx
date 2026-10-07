// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Input from '../Input/Input.jsx';
import Field from './Field.jsx';

describe('Field (base compatible)', () => {
    it('etiqueta el control y enlaza la ayuda con aria-describedby', () => {
        render(
            <Field label="Matrícula" hint="Hasta 10 caracteres">
                <Input />
            </Field>,
        );
        const campo = screen.getByLabelText('Matrícula');
        const ayuda = screen.getByText('Hasta 10 caracteres');
        expect(campo).toHaveAttribute('aria-describedby', ayuda.id);
        expect(campo).not.toHaveAttribute('aria-invalid');
    });

    it('el error es un alert, marca aria-invalid y se enlaza al campo', () => {
        render(
            <Field label="Correo" hint="ayuda" error="Escribe un correo válido.">
                <Input />
            </Field>,
        );
        const alerta = screen.getByRole('alert');
        expect(alerta).toHaveTextContent('Escribe un correo válido.');
        const campo = screen.getByLabelText('Correo');
        expect(campo).toHaveAttribute('aria-invalid', 'true');
        expect(campo.getAttribute('aria-describedby')).toContain(alerta.id);
    });

    it('required añade el asterisco decorativo y el atributo nativo', () => {
        render(
            <Field label="Nombres" required>
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText(/Nombres/)).toBeRequired();
        expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    });

    it('respeta el id del hijo y htmlFor, y conserva su aria-describedby', () => {
        render(
            <Field label="Propio">
                <Input id="mio" aria-describedby="externo" />
            </Field>,
        );
        const campo = screen.getByLabelText('Propio');
        expect(campo).toHaveAttribute('id', 'mio');
        expect(campo).toHaveAttribute('aria-describedby', 'externo');
        render(
            <Field label="Con htmlFor" htmlFor="otro">
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText('Con htmlFor')).toHaveAttribute('id', 'otro');
    });

    it('sin extras el DOM es el de siempre: etiqueta, control y mensajes como hijos directos', () => {
        const { container } = render(
            <Field label="Simple" hint="ayuda">
                <Input />
            </Field>,
        );
        const raiz = container.firstChild;
        expect(Array.from(raiz.children).map((n) => n.tagName)).toEqual(['LABEL', 'INPUT', 'P']);
    });
});

describe('Field (ampliaciones)', () => {
    it('optional escribe «(opcional)» dentro de la etiqueta, pero no si es obligatorio', () => {
        const { rerender } = render(
            <Field label="Apellido materno" optional>
                <Input />
            </Field>,
        );
        expect(screen.getByLabelText('Apellido materno (opcional)')).toBeInTheDocument();
        rerender(
            <Field label="Apellido materno" optional required>
                <Input />
            </Field>,
        );
        expect(screen.queryByText(/opcional/)).toBeNull();
    });

    it('valid muestra palomita con texto «Válido» (o el texto propio) y se oculta si hay error', () => {
        const { rerender } = render(
            <Field label="Matrícula" valid>
                <Input />
            </Field>,
        );
        const estado = screen.getByRole('status');
        expect(estado).toHaveTextContent('Válido');
        expect(screen.getByLabelText('Matrícula').getAttribute('aria-describedby')).toContain(estado.id);
        rerender(
            <Field label="Matrícula" valid="Matrícula disponible">
                <Input />
            </Field>,
        );
        expect(screen.getByRole('status')).toHaveTextContent('Matrícula disponible');
        rerender(
            <Field label="Matrícula" valid error="Ya existe">
                <Input />
            </Field>,
        );
        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.getByRole('alert')).toHaveTextContent('Ya existe');
    });

    it('example se escribe con «Ej.» y no lo duplica si ya lo trae', () => {
        const { rerender } = render(
            <Field label="A" hint="Hasta 10." example="E260099">
                <Input />
            </Field>,
        );
        expect(screen.getByText('Hasta 10. Ej. E260099')).toBeInTheDocument();
        rerender(
            <Field label="A" example="Ej. A-12">
                <Input />
            </Field>,
        );
        expect(screen.getByText('Ej. A-12')).toBeInTheDocument();
        expect(screen.getByLabelText('A').getAttribute('aria-describedby')).toBeTruthy();
    });

    it('counter muestra n/max y solo anuncia el límite cuando se alcanza', () => {
        const { rerender } = render(
            <Field label="Motivo" counter={{ actual: 4, max: 200 }}>
                <Input />
            </Field>,
        );
        expect(screen.getByText('4/200')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('');
        rerender(
            <Field label="Motivo" counter={{ actual: 200, max: 200 }}>
                <Input />
            </Field>,
        );
        expect(screen.getByRole('status')).toHaveTextContent('Límite de 200 caracteres alcanzado.');
    });

    it('counter.desde lo oculta hasta alcanzar esa fracción del máximo', () => {
        const { rerender } = render(
            <Field label="Motivo" counter={{ actual: 10, max: 100, desde: 0.8 }}>
                <Input />
            </Field>,
        );
        expect(screen.queryByText('10/100')).toBeNull();
        rerender(
            <Field label="Motivo" counter={{ actual: 80, max: 100, desde: 0.8 }}>
                <Input />
            </Field>,
        );
        expect(screen.getByText('80/100')).toBeInTheDocument();
    });

    it('labelAction va a la derecha de la etiqueta', () => {
        render(
            <Field label="Contraseña" labelAction={<a href="/recuperar">¿La olvidaste?</a>}>
                <Input />
            </Field>,
        );
        expect(screen.getByRole('link', { name: '¿La olvidaste?' })).toBeInTheDocument();
        expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    });

    it('reserveError mantiene la ranura del error aun sin mensaje', () => {
        const { container, rerender } = render(
            <Field label="Correo" reserveError>
                <Input />
            </Field>,
        );
        expect(container.querySelector('.min-h-5')).toBeEmptyDOMElement();
        rerender(
            <Field label="Correo" reserveError error="Falta">
                <Input />
            </Field>,
        );
        expect(within(container.querySelector('.min-h-5')).getByRole('alert')).toHaveTextContent('Falta');
    });

    it('as="fieldset" agrupa con legend y no clona el hijo', () => {
        render(
            <Field as="fieldset" label="Estatus" hint="Elige uno" error="Falta elegir" required>
                <div data-testid="grupo">opciones</div>
            </Field>,
        );
        const grupo = screen.getByRole('group', { name: /Estatus/ });
        expect(grupo.tagName).toBe('FIELDSET');
        expect(grupo.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
        expect(screen.getByTestId('grupo')).not.toHaveAttribute('id');
        expect(screen.getByText('Elige uno')).toBeInTheDocument();
    });
});

describe('Field con hijo que recibe los mensajes', () => {
    // Un campo compuesto (como CampoPassword) pinta los mensajes él mismo, justo bajo su caja.
    function Compuesto({ mensajes, ...props }) {
        return (
            <div>
                <input {...props} />
                {mensajes}
                <ul data-testid="extra" />
            </div>
        );
    }
    Compuesto.recibeMensajes = true;

    it('le pasa ayuda, error y válido en `mensajes` y no los repite después del hijo', () => {
        const { container } = render(
            <Field label="Clave" hint="Ayuda" error="Falla">
                <Compuesto />
            </Field>,
        );
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.getAllByText('Ayuda')).toHaveLength(1);
        const extra = screen.getByTestId('extra');
        // Los mensajes están antes del resto del hijo, dentro de él.
        expect(screen.getByRole('alert').compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(container.querySelector('input')).toHaveAttribute('aria-invalid', 'true');
    });

    it('un hijo normal (sin la marca) conserva los mensajes después de él', () => {
        render(
            <Field label="Clave" error="Falla">
                <Input />
            </Field>,
        );
        expect(screen.getAllByRole('alert')).toHaveLength(1);
    });
});
