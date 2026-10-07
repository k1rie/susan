// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ importarInscripciones: vi.fn() }));
const descargar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => api);
vi.mock('../compartido/descargar.js', () => ({ descargarTexto: (...a) => descargar(...a) }));
import ImportarCsv from './ImportarCsv.jsx';

// jsdom no trae Blob.text() en todas las versiones: el componente lee el archivo con file.text().
if (!File.prototype.text) {
    File.prototype.text = function leer() {
        return new Promise((resolver) => {
            const lector = new FileReader();
            lector.onload = () => resolver(String(lector.result));
            lector.readAsText(this);
        });
    };
}

const CSV = [
    'matricula,apellido_paterno,apellido_materno,nombres,correo',
    'ZZP001,Prueba,Uno,ZZ Prueba Uno,zzprueba1@unach.test',
    'ZZP002,Prueba,Dos,ZZ Prueba Dos,zzprueba2@unach.test',
    'ZZP003',
    'ZZP001,Prueba,Uno,ZZ Prueba Uno,zzprueba1@unach.test',
    ',Prueba,Sin,ZZ Prueba Sin,x@unach.test',
    'ZZP005,Prueba,Cinco,ZZ Prueba Cinco,correo-invalido',
    'ZZP006,Prueba,Seis,ZZ Prueba Seis,zzprueba6@unach.test',
].join('\n');

const archivo = (texto = CSV, nombre = 'zz.csv') => new File([texto], nombre, { type: 'text/csv' });

beforeEach(() => {
    api.importarInscripciones.mockReset();
    descargar.mockReset();
});

async function abrir(user, props = {}) {
    render(<ImportarCsv idGrupo={5} {...props} />);
    await user.click(screen.getByRole('button', { name: 'Importar desde CSV' }));
    return screen.getByRole('dialog', { name: 'Importar alumnos desde CSV' });
}
const subir = (user, texto) => user.upload(screen.getByTestId('file-input'), archivo(texto));
const siguiente = (user) => user.click(screen.getByRole('button', { name: /Siguiente/ }));

describe('ImportarCsv (4 pasos)', () => {
    it('abre en el paso Archivo con la plantilla, la zona de arrastre y el motivo por el que no se puede continuar', async () => {
        const user = userEvent.setup();
        const dialogo = await abrir(user);
        expect(within(dialogo).getAllByText(/Paso 1 de 4/).length).toBeGreaterThan(0);
        expect(within(dialogo).getByText(/Arrastra y suelta aquí/)).toBeTruthy();
        expect(within(dialogo).getByText('CSV con coma o punto y coma. Máximo 1 MB y 500 filas.')).toBeTruthy();
        expect(within(dialogo).getByRole('button', { name: /Siguiente/ })).toBeDisabled();
        expect(within(dialogo).getByText('Elige un archivo CSV para continuar.')).toBeTruthy();
        await user.click(within(dialogo).getByRole('button', { name: 'Descargar plantilla' }));
        expect(descargar).toHaveBeenCalledWith('plantilla-inscripciones.csv', expect.stringContaining('matricula,apellido_paterno,apellido_materno,nombres,correo'));
    });

    it('un archivo sin la columna matrícula se explica en el mismo paso y no deja avanzar', async () => {
        const user = userEvent.setup();
        await abrir(user);
        await subir(user, 'nombre\nAna');
        expect(await screen.findByText(/Falta la columna "matricula"/)).toBeTruthy();
        expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
        expect(screen.getByText('Corrige el archivo para continuar.')).toBeTruthy();
    });

    it('la revisión da los cuatro contadores y agrupa los errores por causa con sus filas', async () => {
        const user = userEvent.setup();
        await abrir(user, { matriculasInscritas: ['ZZP002'] });
        await subir(user);
        await siguiente(user);
        const revision = await screen.findByText('Filas descartadas: no se importarán');
        expect(revision).toBeTruthy();
        const tarjeta = (nombre) => screen.getByText(nombre).closest('.rounded-xl');
        expect(within(tarjeta('Se inscribirán')).getByText('3')).toBeTruthy(); // ZZP001, ZZP003, ZZP006
        expect(within(tarjeta('Ya inscritos')).getByText('1')).toBeTruthy(); // ZZP002
        expect(within(tarjeta('Con aviso')).getByText('1')).toBeTruthy(); // ZZP003 solo matrícula
        expect(within(tarjeta('Descartadas')).getByText('3')).toBeTruthy();
        expect(screen.getByText(/Matrícula repetida en el archivo\. — fila 5/)).toBeTruthy();
        expect(screen.getByText(/Falta la matrícula\. — fila 6/)).toBeTruthy();
        expect(screen.getByText(/El correo no es válido\. — fila 7/)).toBeTruthy();
        expect(screen.getByText(/Solo trae la matrícula|Filas con solo la matrícula/)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Descargar filas con error' }));
        expect(descargar).toHaveBeenCalledWith('filas-con-error.csv', expect.stringContaining('Falta la matrícula.'));
    });

    it('confirma con el conteo real, envía solo lo que corresponde y muestra el resultado con el reporte de fallidos', async () => {
        api.importarInscripciones.mockResolvedValueOnce({
            id_grupo: 5, total: 3, inscritos: 2, reinscritos: 0, omitidos: 0, errores: 1, alumnos_creados: 2,
            filas: [
                { fila: 1, matricula: 'ZZP001', resultado: 'inscrito', mensaje: 'Alumno creado e inscrito.' },
                { fila: 2, matricula: 'ZZP003', resultado: 'error', codigo: 'VALIDACION', mensaje: 'Faltan datos del alumno nuevo.' },
                { fila: 3, matricula: 'ZZP006', resultado: 'inscrito', mensaje: 'Alumno creado e inscrito.' },
            ],
        });
        const onImported = vi.fn();
        const user = userEvent.setup();
        await abrir(user, { matriculasInscritas: ['ZZP002'], activos: 1, capacidadAula: 40, onImported });
        await subir(user);
        await siguiente(user);
        await screen.findByText('Filas descartadas: no se importarán');
        await siguiente(user);
        expect(await screen.findByText(/Vas a inscribir/)).toBeTruthy();
        expect(screen.getByText('3 alumnos')).toBeTruthy();
        expect(screen.getByText(/Con la lista actual quedarían 36 lugares libres/)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Importar 3 alumnos' }));

        expect(await screen.findByRole('heading', { name: '2 alumnos inscritos' })).toBeTruthy();
        // Se envían las 3 filas válidas (no la ya inscrita ni las descartadas) con el formato de siempre del payload.
        expect(api.importarInscripciones).toHaveBeenCalledWith({
            idGrupo: 5,
            filas: [
                { matricula: 'ZZP001', apellido_paterno: 'Prueba', apellido_materno: 'Uno', nombres: 'ZZ Prueba Uno', correo: 'zzprueba1@unach.test' },
                { matricula: 'ZZP003' },
                { matricula: 'ZZP006', apellido_paterno: 'Prueba', apellido_materno: 'Seis', nombres: 'ZZ Prueba Seis', correo: 'zzprueba6@unach.test' },
            ],
        });
        expect(onImported).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/Total 3: inscritos 2/)).toBeTruthy();
        // 3 descartadas al leer + 1 rechazada por el servidor = 4 en el reporte, con la fila del ARCHIVO (no la del lote).
        await user.click(screen.getByText(/Descargar el reporte de 4 filas con error/));
        const [nombre, texto] = descargar.mock.calls[0];
        expect(nombre).toBe('filas-con-error.csv');
        expect(texto).toContain('4,ZZP003,VALIDACION,Faltan datos del alumno nuevo.');
        expect(texto).toContain('6,,Descartada al leer el archivo,Falta la matrícula.');
    });

    it('si el servidor falla se queda en Confirmar con el mensaje y se puede reintentar', async () => {
        api.importarInscripciones.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'ERROR_INTERNO' }));
        api.importarInscripciones.mockResolvedValueOnce({ total: 1, inscritos: 1, reinscritos: 0, omitidos: 0, errores: 0, alumnos_creados: 1, filas: [{ fila: 1, matricula: 'A1', resultado: 'inscrito' }] });
        const user = userEvent.setup();
        await abrir(user);
        await subir(user, 'matricula,nombres,apellido_paterno,correo\nA1,Ana,Ramos,a@u.mx');
        await siguiente(user);
        await siguiente(user);
        await user.click(await screen.findByRole('button', { name: 'Importar 1 alumno' }));
        expect(await screen.findByText('No se pudo importar')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Importar 1 alumno' })).toBeEnabled();
        await user.click(screen.getByRole('button', { name: 'Importar 1 alumno' }));
        expect(await screen.findByRole('heading', { name: '1 alumno inscrito' })).toBeTruthy();
    });

    it('«Atrás» y el Stepper vuelven a pasos hechos; cerrar con un archivo cargado pide confirmar', async () => {
        const user = userEvent.setup();
        await abrir(user);
        await subir(user);
        await siguiente(user);
        await screen.findByText('Filas descartadas: no se importarán');
        await user.click(screen.getByRole('button', { name: 'Atrás' }));
        expect(screen.getByText('zz.csv')).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(await screen.findByText('¿Descartar los cambios?')).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
        expect(screen.getByRole('dialog', { name: 'Importar alumnos desde CSV' })).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        await user.click(await screen.findByRole('button', { name: 'Descartar cambios' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Importar alumnos desde CSV' })).toBeNull());
    });
});
