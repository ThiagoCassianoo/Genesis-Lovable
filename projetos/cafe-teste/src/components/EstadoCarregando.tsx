import { LoaderCircle } from 'lucide-react';

export function EstadoCarregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-tinta-suave">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
      <span>{texto}</span>
    </div>
  );
}
