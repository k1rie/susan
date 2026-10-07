// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Input from '@/components/ui/Input';
import { hayCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import Modal from '../Modal/Modal.jsx';
import Asistente from './Asistente.jsx';

const INICIAL = { materia: '', docente: '', aula: '', notas: '' };
const CAMPOS = { datos: ['materia', 'docente'], aula: ['aula'], extra: [] };
const validar = (v) => ({
    materia: v.materia ? undefined : 'Elige la materia',
    docente: v.docente ? undefined : 'Elige el docente',
    aula: v.aula ? undefined : 'Elige el aula',
});

function Campo({ f, nombre, etiqueta }) {
    const c = f.campo(nombre);
    return (
        <div>
            <label>
                {etiqueta}
                <Input {...c.props} />
            </label>
            {c.error && <span>{c.error}</span>}
        </div>
    );
}

function Grupo({ onFinalizar = async () => ({ id: 7 }), conRevision = true, extraAsistente = {}, conOpcional = false }) {
    const f = useFormulario({ inicial: INICIAL, validar });
    const pasos = [
        { id: 'datos', titulo: 'Materia y docente', descripcion: 'Qué se imparte y quién', contenido: (
            <>
                <Campo f={f} nombre="materia" etiqueta="Materia" />
                <Campo f={f} nombre="docente" etiqueta="Docente" />
            </>
        ) },
        { id: 'aula', titulo: 'Aula', contenido: <Campo f={f} nombre="aula" etiqueta="Aula" /> },
        ...(conOpcional ? [{ id: 'extra', titulo: 'Notas', opcional: true, contenido: <Campo f={f} nombre="notas" etiqueta="Notas" /> }] : []),
    ];
    return (
        <>
            <button onClick={() => f.setCampo('materia', '')}>Borrar materia desde fuera</button>
            <Asistente
                pasos={pasos}
                valores={f.valores}
                sucio={f.sucio}
                validarPaso={(id) => f.validarCampos(CAMPOS[id]) || f.erroresDe(CAMPOS[id])}
                onFinalizar={onFinalizar}
                etiquetaFinalizar="Crear grupo"
                resumen={
                    conRevision
                        ? (v) => [
                              { id: 'mat', titulo: 'Materia y docente', paso: 'datos', filas: [{ etiqueta: 'Materia', valor: v.materia }, { etiqueta: 'Docente', valor: v.docente }] },
                              { id: 'au', titulo: 'Aula', paso: 'aula', filas: [{ etiqueta: 'Aula', valor: v.aula }] },
                          ]
                        : undefined
                }
                exito={(res) => ({ title: `Grupo ${res?.id} creado`, actions: [{ label: 'Ir a la lista', href: '/admin/grupos' }, { label: 'Crear otro', onClick: () => {} }] })}
                {...extraAsistente}
            />
        </>
    );
}

const escribir = (user, etiqueta, texto) => user.type(screen.getByLabelText(etiqueta), texto);

describe('Asistente · navegación y validación por paso', () => {
    it('empieza en el primer paso con título, descripción y «Paso 1 de 3»', () => {
        render(<Grupo />);
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument();
        expect(screen.getByText('Qué se imparte y quién')).toBeInTheDocument();
        expect(screen.getAllByText(/Paso 1 de 3/).length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: /Atrás/ })).toBeNull();
        expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    });

    it('un paso inválido no avanza: muestra el resumen de errores y enfoca el primer campo inválido', async () => {
        const user = userEvent.setup();
        render(<Grupo />);
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument();
        const alerta = screen.getByRole('alert');
        expect(alerta).toHaveTextContent('Revisa este paso antes de continuar');
        expect(alerta).toHaveTextContent('Elige la materia');
        expect(alerta).toHaveTextContent('Elige el docente');
        expect(screen.getByLabelText('Materia')).toHaveFocus();
        expect(screen.getByLabelText('Materia')).toHaveAttribute('aria-invalid', 'true');
    });

    it('con el paso válido avanza, el foco va al título y se anuncia «Paso 2 de 3»', async () => {
        const user = userEvent.setup();
        render(<Grupo />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        const titulo = screen.getByRole('heading', { name: 'Aula' });
        expect(titulo).toHaveFocus();
        expect(screen.getByText('Paso 2 de 3: Aula', { selector: 'p.sr-only' })).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('Enter dentro de un campo avanza igual que «Siguiente»', async () => {
        const user = userEvent.setup();
        render(<Grupo />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana{Enter}');
        expect(screen.getByRole('heading', { name: 'Aula' })).toBeInTheDocument();
    });

    it('Atrás vuelve sin validar y conserva lo capturado', async () => {
        const user = userEvent.setup();
        render(<Grupo />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await user.click(screen.getByRole('button', { name: /Atrás/ }));
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument();
        expect(screen.getByLabelText('Materia')).toHaveValue('Álgebra');
    });

    it('el Stepper permite volver a un paso hecho, pero no saltar a uno sin recorrer', async () => {
        const user = userEvent.setup();
        render(<Grupo />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        const nav = screen.getByRole('navigation', { name: 'Progreso' });
        expect(within(nav).queryByRole('button', { name: /Revisión/ })).toBeNull();
        await user.click(within(nav).getByRole('button', { name: /Materia y docente/ }));
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument();
    });

    it('un paso opcional ofrece «Omitir por ahora» sin validar y queda como omitido', async () => {
        const user = userEvent.setup();
        render(<Grupo conOpcional />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await escribir(user, 'Aula', 'A-12');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.getByRole('heading', { name: 'Notas' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Omitir por ahora' }));
        expect(screen.getByRole('heading', { name: 'Revisión' })).toBeInTheDocument();
        expect(within(screen.getByRole('navigation', { name: 'Progreso' })).getAllByRole('listitem')[2]).toHaveTextContent('omitido');
    });
});

describe('Asistente · revisión y envío', () => {
    async function llegarARevision(user) {
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await escribir(user, 'Aula', 'A-12');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    }

    it('el último paso es la revisión con una tarjeta por sección y el botón con verbo y objeto', async () => {
        const user = userEvent.setup();
        render(<Grupo />);
        await llegarARevision(user);
        expect(screen.getByRole('heading', { name: 'Revisión' })).toBeInTheDocument();
        const tarjeta = screen.getByRole('region', { name: 'Materia y docente' });
        expect(tarjeta).toHaveTextContent('Álgebra');
        expect(tarjeta).toHaveTextContent('Ana');
        expect(screen.getByRole('region', { name: 'Aula' })).toHaveTextContent('A-12');
        expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    });

    it('«Editar» vuelve al paso exacto y «Volver a la revisión» regresa sin recorrer los demás', async () => {
        const user = userEvent.setup();
        render(<Grupo />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Editar Materia y docente' }));
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Materia'), { target: { value: 'Cálculo' } });
        await user.click(screen.getByRole('button', { name: 'Volver a la revisión' }));
        expect(screen.getByRole('heading', { name: 'Revisión' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Materia y docente' })).toHaveTextContent('Cálculo');
    });

    it('lo vacío se dice «Sin especificar» en la revisión', async () => {
        const user = userEvent.setup();
        render(<Grupo extraAsistente={{ resumen: () => [{ id: 's', titulo: 'Extra', filas: [{ etiqueta: 'Notas', valor: '' }] }] }} />);
        await llegarARevision(user);
        expect(screen.getByText('Sin especificar')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Editar Extra/ })).toBeNull();
    });

    it('al finalizar llama a onFinalizar con los valores y muestra el éxito con lo que devolvió', async () => {
        const user = userEvent.setup();
        const onFinalizar = vi.fn().mockResolvedValue({ id: 42 });
        render(<Grupo onFinalizar={onFinalizar} />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        expect(onFinalizar).toHaveBeenCalledWith({ materia: 'Álgebra', docente: 'Ana', aula: 'A-12', notas: '' });
        expect(await screen.findByRole('heading', { name: 'Grupo 42 creado' })).toHaveFocus();
        expect(screen.getByRole('link', { name: 'Ir a la lista' })).toHaveAttribute('href', '/admin/grupos');
        expect(screen.queryByRole('navigation', { name: 'Progreso' })).toBeNull();
    });

    it('si onFinalizar falla muestra el error, conserva todo y deja reintentar', async () => {
        const user = userEvent.setup();
        const onFinalizar = vi.fn().mockRejectedValueOnce(new Error('Ya existe un grupo con esa clave')).mockResolvedValueOnce({ id: 1 });
        render(<Grupo onFinalizar={onFinalizar} />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        expect(await screen.findByText('Ya existe un grupo con esa clave')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Revisión' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeEnabled();
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        expect(await screen.findByRole('heading', { name: 'Grupo 1 creado' })).toBeInTheDocument();
        expect(onFinalizar).toHaveBeenCalledTimes(2);
    });

    it('no permite un doble envío mientras onFinalizar está en curso', async () => {
        const user = userEvent.setup();
        let resolver;
        const onFinalizar = vi.fn(() => new Promise((r) => { resolver = r; }));
        render(<Grupo onFinalizar={onFinalizar} />);
        await llegarARevision(user);
        const boton = screen.getByRole('button', { name: 'Crear grupo' });
        await user.click(boton);
        await user.click(boton);
        expect(onFinalizar).toHaveBeenCalledTimes(1);
        expect(boton).toHaveAttribute('aria-busy', 'true');
        await act(async () => resolver({ id: 3 }));
        expect(await screen.findByRole('heading', { name: 'Grupo 3 creado' })).toBeInTheDocument();
    });

    it('al finalizar revalida todos los pasos: si uno quedó inválido vuelve a él y no envía', async () => {
        const user = userEvent.setup();
        const onFinalizar = vi.fn();
        render(<Grupo onFinalizar={onFinalizar} />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Borrar materia desde fuera' }));
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        expect(onFinalizar).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Elige la materia');
        expect(screen.getByLabelText('Materia')).toHaveFocus();
    });

    it('«Volver a la revisión» también valida el paso que se está editando', async () => {
        const user = userEvent.setup();
        render(<Grupo />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Editar Materia y docente' }));
        fireEvent.change(screen.getByLabelText('Materia'), { target: { value: '' } });
        await user.click(screen.getByRole('button', { name: 'Volver a la revisión' }));
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Elige la materia');
    });

    it('sin `resumen` no hay revisión: el último paso ya crea', async () => {
        const user = userEvent.setup();
        const onFinalizar = vi.fn().mockResolvedValue({ id: 5 });
        render(<Grupo conRevision={false} onFinalizar={onFinalizar} />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.queryByRole('heading', { name: 'Revisión' })).toBeNull();
        await escribir(user, 'Aula', 'A-12');
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        expect(await screen.findByRole('heading', { name: 'Grupo 5 creado' })).toBeInTheDocument();
    });

    it('resumenLateral muestra el resumen vivo junto al formulario (no en la revisión)', async () => {
        const user = userEvent.setup();
        render(<Grupo extraAsistente={{ resumenLateral: true }} />);
        const lateral = screen.getByRole('complementary', { name: 'Resumen' });
        expect(lateral).toHaveTextContent('Sin especificar');
        await escribir(user, 'Materia', 'Álgebra');
        expect(lateral).toHaveTextContent('Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await escribir(user, 'Aula', 'A-12');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.queryByRole('complementary', { name: 'Resumen' })).toBeNull();
    });
});

describe('Asistente · cancelar y cambios sin guardar', () => {
    it('registra beforeunload mientras hay cambios y lo retira al terminar', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<Grupo />);
        expect(hayCambiosSinGuardar()).toBe(false);
        await escribir(user, 'Materia', 'Á');
        expect(hayCambiosSinGuardar()).toBe(true);
        unmount();
        expect(hayCambiosSinGuardar()).toBe(false);
    });

    it('Cancelar solo aparece en el primer paso y sale directo si no hay cambios', async () => {
        const user = userEvent.setup();
        const onCancelar = vi.fn();
        render(<Grupo extraAsistente={{ onCancelar }} />);
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onCancelar).toHaveBeenCalledTimes(1);
    });

    it('con cambios, Cancelar pregunta «¿Salir sin guardar?» y respeta «Seguir editando»', async () => {
        const user = userEvent.setup();
        const onCancelar = vi.fn();
        render(<Grupo extraAsistente={{ onCancelar }} />);
        await escribir(user, 'Materia', 'Á');
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        const confirmacion = screen.getByRole('dialog', { name: '¿Salir sin guardar?' });
        await user.click(within(confirmacion).getByText('Seguir editando'));
        expect(onCancelar).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        await user.click(screen.getByText('Salir'));
        expect(onCancelar).toHaveBeenCalledTimes(1);
    });

    it('sin onCancelar y fuera de un contenedor no hay «Cancelar»', () => {
        render(<Grupo />);
        expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    });

    it('dentro de un Modal, Cancelar usa el cierre del Modal (que respeta su dirty)', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Modal open dirty onClose={onClose} title="Nuevo grupo" size="lg">
                <Grupo />
            </Modal>,
        );
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument();
        await user.click(screen.getByText('Descartar cambios'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('dentro de un contenedor las acciones se pegan al borde del contenedor, no a la barra inferior', () => {
        render(
            <Modal open onClose={() => {}} title="Nuevo grupo">
                <Grupo />
            </Modal>,
        );
        const barra = screen.getByRole('button', { name: 'Siguiente' }).closest('.sticky');
        expect(barra.className).toContain('sticky bottom-0');
    });
});

describe('Asistente · accesibilidad', () => {
    it('es una sección nombrada y el contenido del paso no se desmonta con los valores', async () => {
        render(<Grupo extraAsistente={{ label: 'Alta de grupo' }} />);
        expect(screen.getByRole('region', { name: 'Alta de grupo' })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText('Materia')).toBeInTheDocument());
    });
});

describe('Asistente · saltar de paso desde fuera (ref.irAPaso)', () => {
    it('ref.current.irAPaso(id) lleva a ese paso, enfoca el título y conserva lo capturado', async () => {
        const user = userEvent.setup();
        const ref = createRef();
        render(<Grupo extraAsistente={{ ref }} />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        expect(screen.getByRole('heading', { name: 'Aula' })).toBeInTheDocument();
        let fue;
        act(() => {
            fue = ref.current.irAPaso('datos');
        });
        expect(fue).toBe(true);
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toHaveFocus();
        expect(screen.getByLabelText('Materia')).toHaveValue('Álgebra');
        expect(screen.getByText('Paso 1 de 3: Materia y docente', { selector: 'p.sr-only' })).toBeInTheDocument();
    });

    it('puede saltar adelante (decisión de quien llama, no valida) y a la revisión con «revision»', async () => {
        const ref = createRef();
        render(<Grupo extraAsistente={{ ref }} />);
        act(() => {
            ref.current.irAPaso('aula');
        });
        expect(screen.getByRole('heading', { name: 'Aula' })).toBeInTheDocument();
        let fue;
        act(() => {
            fue = ref.current.irAPaso('revision');
        });
        expect(fue).toBe(true);
        expect(screen.getByRole('heading', { name: 'Revisión' })).toBeInTheDocument();
    });

    it('un id desconocido devuelve false y no mueve nada; «revision» sin resumen tampoco existe', () => {
        const ref = createRef();
        render(<Grupo conRevision={false} extraAsistente={{ ref }} />);
        let r1;
        let r2;
        act(() => {
            r1 = ref.current.irAPaso('no-existe');
            r2 = ref.current.irAPaso('revision');
        });
        expect(r1).toBe(false);
        expect(r2).toBe(false);
        expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument();
    });

    it('caso real: onFinalizar falla por un dato de un paso anterior y quien llama vuelve a ese paso', async () => {
        const user = userEvent.setup();
        const ref = createRef();
        const onFinalizar = vi.fn(async () => {
            // Equivale a un DUPLICADO del servidor sobre un campo del primer paso.
            ref.current.irAPaso('datos');
            throw new Error('Ya existe un grupo con esa clave');
        });
        render(<Grupo onFinalizar={onFinalizar} extraAsistente={{ ref }} />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await escribir(user, 'Aula', 'A-1');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Materia y docente' })).toBeInTheDocument());
        expect(await screen.findByText('Ya existe un grupo con esa clave')).toBeInTheDocument();
        expect(screen.getByLabelText('Materia')).toHaveValue('Álgebra');
    });

    it('tras terminar bien ya no navega: devuelve false', async () => {
        const user = userEvent.setup();
        const ref = createRef();
        render(<Grupo extraAsistente={{ ref }} />);
        await escribir(user, 'Materia', 'Álgebra');
        await escribir(user, 'Docente', 'Ana');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await escribir(user, 'Aula', 'A-1');
        await user.click(screen.getByRole('button', { name: 'Siguiente' }));
        await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
        await screen.findByRole('heading', { name: 'Grupo 7 creado' });
        let fue;
        act(() => {
            fue = ref.current.irAPaso('datos');
        });
        expect(fue).toBe(false);
    });
});
