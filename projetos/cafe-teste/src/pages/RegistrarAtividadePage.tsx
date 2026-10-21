import { useSearchParams } from 'react-router-dom';
import { VoltarLink } from '@/components/VoltarLink';
import { AtividadeFormSection } from '@/sections/AtividadeFormSection';

export function RegistrarAtividadePage() {
  const [params] = useSearchParams();
  const talhao = params.get('talhao') ?? undefined;
  return (
    <>
      <VoltarLink to={talhao ? `/talhoes/${talhao}` : '/'} texto="Voltar" />
      <h1 className="mb-4 text-2xl font-bold">Registrar atividade</h1>
      <AtividadeFormSection talhaoInicial={talhao} />
    </>
  );
}
