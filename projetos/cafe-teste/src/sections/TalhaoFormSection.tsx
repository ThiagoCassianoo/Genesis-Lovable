import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { parseNumeroPtBr } from '@/lib/ptBrNumber';
import { useCriarTalhao } from '@/lib/queries';
import { NOME_MAX, talhaoFormSchema, type TalhaoFormData } from '@/lib/schemas';

export function TalhaoFormSection() {
  const navigate = useNavigate();
  const criar = useCriarTalhao();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TalhaoFormData>({
    resolver: zodResolver(talhaoFormSchema),
    defaultValues: { nome: '', areaHa: '', variedade: '' },
  });

  async function onSubmit(dados: TalhaoFormData) {
    const areaHa = parseNumeroPtBr(dados.areaHa);
    if (areaHa === null) return; // inalcançável: o schema já garantiu
    try {
      await criar.mutateAsync({ nome: dados.nome, areaHa, variedade: dados.variedade });
      navigate('/', { state: { aviso: 'Talhão cadastrado.' } });
    } catch {
      // erro exibido abaixo via criar.isError
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField id="nome" label="Nome do talhão" hint="Como você chama esse pedaço da lavoura." error={errors.nome?.message}>
        {(a11y) => <Input autoComplete="off" maxLength={NOME_MAX} {...a11y} {...register('nome')} />}
      </FormField>

      <FormField id="areaHa" label="Área (hectares)" hint="Pode usar vírgula, por exemplo 1,5." error={errors.areaHa?.message}>
        {(a11y) => <Input inputMode="decimal" autoComplete="off" {...a11y} {...register('areaHa')} />}
      </FormField>

      <FormField id="variedade" label="Variedade" opcional error={errors.variedade?.message}>
        {(a11y) => <Input autoComplete="off" maxLength={NOME_MAX} {...a11y} {...register('variedade')} />}
      </FormField>

      {criar.isError && (
        <p role="alert" className="font-semibold text-erro">
          Não foi possível salvar o talhão neste aparelho. Tente de novo.
        </p>
      )}

      <Button type="submit" size="full" disabled={criar.isPending} className="min-h-14 text-lg">
        {criar.isPending ? 'Salvando…' : 'Salvar talhão'}
      </Button>
    </form>
  );
}
