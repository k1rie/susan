import clsx from 'clsx';
import { ArrowDown, ArrowUp } from 'lucide-react';
import Spinner from '../Spinner/Spinner.jsx';

const ALINEACION = { left: 'text-left', right: 'text-right', center: 'text-center' };
const OCULTAR = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell' };

const clasesCelda = (col) => clsx(ALINEACION[col.align] || 'text-left', col.hideBelow && OCULTAR[col.hideBelow], col.className);

// Tabla simple y semántica. En pantallas angostas el contenedor se desplaza en horizontal
// (360 px); hideBelow oculta columnas secundarias. El orden lo hace el servidor (onSort solo notifica).
export default function Table({
    columns,
    rows = [],
    rowKey = 'id',
    caption,
    emptyMessage = 'Sin resultados',
    onRowClick,
    loading = false,
    sort,
    onSort,
    stickyHeader = false,
    className,
}) {
    const claveDe = (row, i) => (typeof rowKey === 'function' ? rowKey(row) : (row[rowKey] ?? i));
    const ariaSort = (col) => (sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined);

    return (
        <div className={clsx('overflow-x-auto rounded-xl border border-border bg-card', stickyHeader && 'max-h-[70dvh] overflow-y-auto', className)}>
            <table className="w-full min-w-max border-collapse text-sm">
                {caption && <caption className="px-4 py-2 text-left text-sm text-muted-foreground">{caption}</caption>}
                <thead className={clsx('bg-muted/50 text-xs font-medium text-muted-foreground', stickyHeader && 'sticky top-0 z-10')}>
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                scope="col"
                                aria-sort={ariaSort(col)}
                                className={clsx('px-4 py-3 font-medium', clasesCelda(col))}
                            >
                                {onSort && col.sortable !== false ? (
                                    <button type="button" onClick={() => onSort(col.key)} className="min-h-9 font-medium">
                                        {col.header}
                                        {sort?.key === col.key && (sort.dir === 'asc' ? <ArrowUp aria-hidden="true" className="ml-1 inline size-3.5" strokeWidth={2} /> : <ArrowDown aria-hidden="true" className="ml-1 inline size-3.5" strokeWidth={2} />)}
                                    </button>
                                ) : (
                                    col.header
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody aria-busy={loading ? 'true' : undefined}>
                    {loading && rows.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-10 text-center">
                                <Spinner />
                            </td>
                        </tr>
                    )}
                    {!loading && rows.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                    {rows.map((row, i) => (
                        <tr
                            key={claveDe(row, i)}
                            tabIndex={onRowClick ? 0 : undefined}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            onKeyDown={
                                onRowClick
                                    ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              onRowClick(row);
                                          }
                                      }
                                    : undefined
                            }
                            className={clsx('border-t border-border transition-colors', onRowClick && 'cursor-pointer hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none')}
                        >
                            {columns.map((col) => (
                                <td key={col.key} className={clsx('px-4 py-3', col.primary && 'font-medium', clasesCelda(col))}>
                                    {col.render ? col.render(row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
