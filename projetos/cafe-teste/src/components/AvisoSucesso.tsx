import { CircleCheck } from 'lucide-react';

/** Só é exibido depois que a escrita resolveu — nunca de forma otimista. */
export function AvisoSucesso({ texto }: { texto: string }) {
  return (
    <p role="status" className="mb-4 flex items-center gap-2 rounded-md border border-mata bg-white px-3 py-2 font-semibold text-mata">
      <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
      {texto}
    </p>
  );
}
