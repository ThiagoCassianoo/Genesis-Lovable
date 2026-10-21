import { Link, Outlet } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { NOME_PROPRIEDADE } from '@/data/config';

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-white focus:p-2">
        Pular para o conteúdo
      </a>
      <header className="bg-mata text-white">
        <div className="mx-auto flex max-w-2xl items-baseline justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-lg font-bold">
            {NOME_PROPRIEDADE}
          </Link>
          <span className="text-sm text-white/85">Diário de lavoura</span>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-5">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-2xl px-4 pb-28 text-sm text-tinta-suave">
        <p className="flex items-start gap-2">
          <Smartphone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Os dados ficam só neste aparelho, neste navegador. Limpar o navegador apaga os registros.
        </p>
      </footer>
    </div>
  );
}
