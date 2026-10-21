import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { ClipboardList } from 'lucide-react';
import { EstadoCarregando } from '@/components/EstadoCarregando';
import { EstadoErro } from '@/components/EstadoErro';
import { EstadoVazio } from '@/components/EstadoVazio';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { TIPOS_ATIVIDADE } from '@/data/tiposAtividade';
import { hojeLocal } from '@/lib/dates';
import { useCriarAtividade, useTalhoes } from '@/lib/queries';
import { atividadeFormSchema, NOTA_MAX } from '@/lib/schemas';
import type { Talhao } from '@/lib/schemas';

type FormIn = z.input<typeof atividadeFormSchema>;
type FormOut = z.output<typeof atividadeFormSchema>;

export function AtividadeFormSection({ talhaoInicial }: { talhaoInicial?: string }) {
  const { data: talhoes, isPending, isError, error, refetch } = useTalhoes();

  if (isPending) return <EstadoCarregando />;
  if (isError) return <EstadoErro erro={error} onTentarDeNovo={() => refetch()} />;
  if (talhoes.length === 0) {
    return (
      <EstadoVazio
        icone={ClipboardList}
        titulo="Cadastre um talhão primeiro"
        descricao="Toda atividade fica ligada a um talhão."
        acao={
          <Link to="/talhoes/novo" className={buttonVariants({ variant: 'primary' })}>
            Cadastrar talhão
          </Link>
        }
      />
    );
  }

  const inicial = talhoes.some((t) => t.id === talhaoInicial)
    ? talhaoInicial
    : talhoes.length === 1
      ? talhoes[0].id
      : '';

  return <AtividadeForm talhoes={talhoes} talhaoInicial={inicial ?? ''} />;
}

function AtividadeForm({ talhoes, talhaoInicial }: { talhoes: Talhao[]; talhaoInicial: string }) {
  const navigate = useNavigate();
  const criar = useCriarAtividade();
  const hoje = hojeLocal();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(atividadeFormSchema),
    defaultValues: { talhaoId: talhaoInicial, data: hoje, nota: '' },
  });

  async function onSubmit(dados: FormOut) {
    try {
      const atividade = await criar.mutateAsync(dados);
      navigate(`/talhoes/${atividade.talhaoId}`, { state: { aviso: 'Atividade registrada.' } });
    } catch {
      // erro exibido abaixo via criar.isError
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField id="talhaoId" label="Talhão" error={errors.talhaoId?.message}>
        {(a11y) => (
          <Select {...a11y} {...register('talhaoId')}>
            <option value="">Escolha o talhão</option>
            {talhoes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField id="tipo" label="O que foi feito" error={errors.tipo?.message}>
        {(a11y) => (
          <Select {...a11y} {...register('tipo')}>
            <option value="">Escolha o tipo</option>
            {TIPOS_ATIVIDADE.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField id="data" label="Data" error={errors.data?.message}>
        {(a11y) => <Input type="date" max={hoje} {...a11y} {...register('data')} />}
      </FormField>

      <FormField
        id="nota"
        label="Anotação"
        opcional
        hint={`Produto, dose, quantidade colhida… até ${NOTA_MAX} caracteres.`}
        error={errors.nota?.message}
      >
        {(a11y) => <Textarea rows={3} {...a11y} {...register('nota')} />}
      </FormField>

      {criar.isError && (
        <p role="alert" className="font-semibold text-erro">
          Não foi possível salvar. Nada foi registrado — tente de novo.
        </p>
      )}

      <Button type="submit" size="full" disabled={criar.isPending} className="min-h-14 text-lg">
        {criar.isPending ? 'Salvando…' : 'Salvar atividade'}
      </Button>
    </form>
  );
}
