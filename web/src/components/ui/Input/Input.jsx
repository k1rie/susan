import clsx from 'clsx';

export const CONTROL_BASE =
    'w-full min-h-11 rounded-md border bg-card px-3 text-base text-foreground placeholder:text-muted-foreground disabled:bg-muted disabled:opacity-70';

// Campo de texto nativo; endAdornment se coloca a la derecha dentro del borde.
export default function Input({ type = 'text', invalid, endAdornment, className, ...rest }) {
    const borde = invalid || rest['aria-invalid'] ? 'border-destructive' : 'border-border';
    const input = <input type={type} className={clsx(CONTROL_BASE, borde, endAdornment && 'pr-10', !endAdornment && className)} {...rest} />;
    if (!endAdornment) return input;
    return (
        <div className={clsx('relative', className)}>
            {input}
            <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground">{endAdornment}</span>
        </div>
    );
}
