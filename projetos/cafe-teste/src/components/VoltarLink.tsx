import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function VoltarLink({ to = '/', texto = 'Talhões' }: { to?: string; texto?: string }) {
  return (
    <Link to={to} className="mb-3 inline-flex min-h-11 items-center gap-1 font-semibold text-mata">
      <ArrowLeft aria-hidden="true" className="size-4" />
      {texto}
    </Link>
  );
}
