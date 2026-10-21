import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { isRepositoryError } from '@/lib/repository/types';
import { useRepository } from '@/lib/repository/useRepository';

export interface EstadoErroProps {
  erro: unknown;
  onTentarDeNovo?: () => void;
}

/**
 * Erro de leitura. Dado corrompido não se resolve tentando de novo:
 * oferece "recomeçar", com confirmação, porque apaga o que está no aparelho.
 */
export function EstadoErro({ erro, onTentarDeNovo }: EstadoErroProps) {
  const repo = useRepository();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const corrompido = isRepositoryError(erro) && erro.code === 'CORROMPIDO';

  async function recomecar() {
    await repo.recomecar();
    await queryClient.invalidateQueries();
  }

  return (
    <div role="alert" className="rounded-lg border-2 border-erro bg-white p-4">
      <div className="flex items-start gap-2">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-erro" />
        <div>
          <h2 className="font-semibold text-erro">
            {corrompido ? 'Os dados salvos neste aparelho não puderam ser lidos.' : 'Algo deu errado ao carregar.'}
          </h2>
          <p className="mt-1 text-tinta-suave">
            {corrompido
              ? 'Pode ter sido limpeza do navegador ou falta de espaço. Para voltar a usar, é preciso recomeçar do zero.'
              : 'Verifique se o navegador permite salvar dados e tente de novo.'}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {corrompido ? (
          confirmando ? (
            <>
              <Button variant="danger" onClick={recomecar}>
                Sim, apagar e recomeçar
              </Button>
              <Button variant="ghost" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmando(true)}>
              Recomeçar do zero
            </Button>
          )
        ) : (
          onTentarDeNovo && (
            <Button variant="secondary" onClick={onTentarDeNovo}>
              Tentar de novo
            </Button>
          )
        )}
      </div>
    </div>
  );
}
