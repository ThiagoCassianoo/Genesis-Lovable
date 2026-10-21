import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Sprout } from 'lucide-react';
import { EstadoCarregando } from '@/components/EstadoCarregando';
import { EstadoErro } from '@/components/EstadoErro';
import { EstadoVazio } from '@/components/EstadoVazio';
import { ExemploBadge } from '@/components/ExemploBadge';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { formatarArea } from '@/lib/ptBrNumber';
import { useRemoverExemplos, useTalhoes } from '@/lib/queries';

export function TalhoesSection() {
  const { data: talhoes, isPending, isError, error, refetch } = useTalhoes();
  const remover = useRemoverExemplos();
  // Mesmo padrão de confirmação em dois passos do "Recomeçar do zero" (EstadoErro):
  // remover apaga também atividades reais registradas em talhão de exemplo.
  const [confirmando, setConfirmando] = useState(false);

  if (isPending) return <EstadoCarregando texto="Carregando talhões…" />;
  if (isError) return <EstadoErro erro={error} onTentarDeNovo={() => refetch()} />;

  const temExemplos = talhoes.some((t) => t.ficticio);

  return (
    <section aria-labelledby="titulo-talhoes">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 id="titulo-talhoes" className="text-2xl font-bold">
          Talhões
        </h1>
        {talhoes.length > 0 && (
          <Link to="/talhoes/novo" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            <Plus aria-hidden="true" className="size-4" />
            Novo talhão
          </Link>
        )}
      </div>

      {temExemplos && (
        <div className="mb-4 rounded-md border border-aviso bg-white p-3 text-sm">
          <p>
            Os talhões marcados como <strong>Exemplo</strong> são fictícios, só para mostrar como funciona.
            Remover apaga também as atividades registradas neles.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {confirmando ? (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={remover.isPending}
                  onClick={() => remover.mutate(undefined, { onSettled: () => setConfirmando(false) })}
                >
                  {remover.isPending ? 'Removendo…' : 'Sim, remover exemplos e as atividades deles'}
                </Button>
                <Button variant="ghost" size="sm" disabled={remover.isPending} onClick={() => setConfirmando(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConfirmando(true)}>
                Remover exemplos
              </Button>
            )}
          </div>
          {remover.isError && (
            <p role="alert" className="mt-2 font-semibold text-erro">
              Não foi possível remover os exemplos. Tente de novo.
            </p>
          )}
        </div>
      )}

      {talhoes.length === 0 ? (
        <EstadoVazio
          icone={Sprout}
          titulo="Nenhum talhão cadastrado"
          descricao="Cadastre o primeiro talhão para começar a registrar adubação, poda, colheita e o que mais acontecer na lavoura."
          acao={
            <Link to="/talhoes/novo" className={buttonVariants({ variant: 'primary' })}>
              <Plus aria-hidden="true" className="size-5" />
              Cadastrar talhão
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-linha overflow-hidden rounded-lg border border-linha bg-white">
          {talhoes.map((t) => (
            <li key={t.id}>
              <Link to={`/talhoes/${t.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-papel">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{t.nome}</span>
                    {t.ficticio && <ExemploBadge />}
                  </div>
                  <p className="text-sm text-tinta-suave">
                    {formatarArea(t.areaHa)}
                    {t.variedade && ` · ${t.variedade}`}
                  </p>
                </div>
                <ChevronRight aria-hidden="true" className="size-5 text-tinta-suave" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
