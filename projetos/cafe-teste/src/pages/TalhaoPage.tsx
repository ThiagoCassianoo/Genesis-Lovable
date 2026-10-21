import { Link, useLocation, useParams } from 'react-router-dom';
import { ClipboardPlus, MapPinOff } from 'lucide-react';
import { AvisoSucesso } from '@/components/AvisoSucesso';
import { EstadoCarregando } from '@/components/EstadoCarregando';
import { EstadoErro } from '@/components/EstadoErro';
import { EstadoVazio } from '@/components/EstadoVazio';
import { ExemploBadge } from '@/components/ExemploBadge';
import { VoltarLink } from '@/components/VoltarLink';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { lerAviso } from '@/lib/avisoNavegacao';
import { formatarArea } from '@/lib/ptBrNumber';
import { useTalhao } from '@/lib/queries';
import { HistoricoSection } from '@/sections/HistoricoSection';

export function TalhaoPage() {
  const { id = '' } = useParams();
  const aviso = lerAviso(useLocation().state);
  const { data: talhao, isPending, isError, error, refetch } = useTalhao(id);

  if (isPending) return <EstadoCarregando />;
  if (isError) return <EstadoErro erro={error} onTentarDeNovo={() => refetch()} />;
  if (!talhao) {
    return (
      <EstadoVazio
        icone={MapPinOff}
        titulo="Talhão não encontrado"
        descricao="Ele pode ter sido removido (os exemplos, por exemplo)."
        acao={
          <Link to="/" className={buttonVariants({ variant: 'primary' })}>
            Ver talhões
          </Link>
        }
      />
    );
  }

  return (
    <>
      <VoltarLink />
      {aviso && <AvisoSucesso texto={aviso} />}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{talhao.nome}</h1>
        {talhao.ficticio && <ExemploBadge />}
      </div>
      <p className="text-tinta-suave">
        {formatarArea(talhao.areaHa)}
        {talhao.variedade && ` · ${talhao.variedade}`}
      </p>
      <Link
        to={`/registrar?talhao=${encodeURIComponent(talhao.id)}`}
        className={`${buttonVariants({ variant: 'primary', size: 'full' })} mt-4 sm:w-auto`}
      >
        <ClipboardPlus aria-hidden="true" className="size-5" />
        Registrar atividade neste talhão
      </Link>
      <HistoricoSection talhaoId={talhao.id} />
    </>
  );
}
