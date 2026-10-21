import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface EstadoVazioProps {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}

export function EstadoVazio({ icone: Icone, titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <div className="rounded-lg border border-dashed border-linha bg-white px-4 py-8 text-center">
      <Icone aria-hidden="true" className="mx-auto mb-3 size-8 text-cafe" />
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="mx-auto mt-1 max-w-prose text-tinta-suave">{descricao}</p>
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}
