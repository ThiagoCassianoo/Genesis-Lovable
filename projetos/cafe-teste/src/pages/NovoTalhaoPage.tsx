import { VoltarLink } from '@/components/VoltarLink';
import { TalhaoFormSection } from '@/sections/TalhaoFormSection';

export function NovoTalhaoPage() {
  return (
    <>
      <VoltarLink />
      <h1 className="mb-4 text-2xl font-bold">Novo talhão</h1>
      <TalhaoFormSection />
    </>
  );
}
