import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ClipboardList } from 'lucide-react';
import { EstadoCarregando } from '@/components/EstadoCarregando';
import { EstadoErro } from '@/components/EstadoErro';
import { EstadoVazio } from '@/components/EstadoVazio';
import { ExemploBadge } from '@/components/ExemploBadge';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { TIPOS_ATIVIDADE } from '@/data/tiposAtividade';
import { formatarDataBr } from '@/lib/dates';
import { useAtividades } from '@/lib/queries';

export function HistoricoSection({ talhaoId }: { talhaoId: string }) {
  const { data: atividades, isPending, isError, error, refetch } = useAtividades(talhaoId);
  const [params, setParams] = useSearchParams();
  const filtro = params.get('tipo') ?? '';

  if (isPending) return <EstadoCarregando texto="Carregando histórico…" />;
  if (isError) return <EstadoErro erro={error} onTentarDeNovo={() => refetch()} />;

  const visiveis = filtro ? atividades.filter((a) => a.tipo === filtro) : atividades;

  function mudarFiltro(valor: string) {
    const novo = new URLSearchParams(params);
    if (valor) novo.set('tipo', valor);
    else novo.delete('tipo');
    setParams(novo, { replace: true });
  }

  return (
    <section aria-labelledby="titulo-historico" className="mt-6">
      <h2 id="titulo-historico" className="text-xl font-bold">
        Histórico
      </h2>

      {atividades.length === 0 ? (
        <div className="mt-3">
          <EstadoVazio
            icone={ClipboardList}
            titulo="Nenhuma atividade registrada"
            descricao="O que for registrado aqui aparece em ordem, do mais recente para o mais antigo."
          />
        </div>
      ) : (
        <>
          <div className="mt-3 mb-4">
            <Label htmlFor="filtro-tipo">Filtrar por tipo</Label>
            <Select id="filtro-tipo" value={filtro} onChange={(e) => mudarFiltro(e.target.value)}>
              <option value="">Todos os tipos ({atividades.length})</option>
              {TIPOS_ATIVIDADE.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </Select>
          </div>

          {visiveis.length === 0 ? (
            <p role="status" className="text-tinta-suave">
              Nenhuma atividade do tipo “{filtro}” neste talhão.
            </p>
          ) : (
            <ol aria-label="Atividades, da mais recente para a mais antiga" className="space-y-0 border-l-2 border-cafe/40 pl-4">
              {visiveis.map((a) => (
                <li key={a.id} className="relative pb-4">
                  <span aria-hidden="true" className="absolute -left-[1.4rem] top-1.5 size-3 rounded-full bg-cafe" />
                  <p className="flex flex-wrap items-center gap-2 text-sm text-tinta-suave">
                    <CalendarDays aria-hidden="true" className="size-4" />
                    <time dateTime={a.data}>{formatarDataBr(a.data)}</time>
                    {a.ficticio && <ExemploBadge />}
                  </p>
                  <p className="font-semibold">{a.tipo}</p>
                  {a.nota && <p className="mt-0.5 whitespace-pre-line break-words text-tinta-suave">{a.nota}</p>}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
