import Spinner from '@/components/ui/Spinner/Spinner.jsx';

export default function Loading() {
    return (
        <div className="flex justify-center py-16">
            <Spinner size="lg" label="Cargando" />
        </div>
    );
}
