import { Link } from 'react-router-dom';
import { ClipboardPlus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { cn } from '@/lib/cn';
import { useTalhoes } from '@/lib/queries';

/** Ação principal na thumb zone (Fitts): fixa embaixo, largura cheia no celular. */
export function BotaoRegistrarFixoSection() {
  const { data: talhoes } = useTalhoes();
  if (!talhoes || talhoes.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-linha bg-papel/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto max-w-2xl">
        <Link to="/registrar" className={cn(buttonVariants({ variant: 'primary', size: 'full' }), 'min-h-14 text-lg')}>
          <ClipboardPlus aria-hidden="true" className="size-6" />
          Registrar atividade
        </Link>
      </div>
    </div>
  );
}
