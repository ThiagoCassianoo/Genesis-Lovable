import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EstadoVazio } from '@/components/EstadoVazio';
import { buttonVariants } from '@/components/ui/buttonVariants';

export function NaoEncontradaPage() {
  return (
    <EstadoVazio
      icone={Compass}
      titulo="Página não encontrada"
      descricao="Esse endereço não existe no diário."
      acao={
        <Link to="/" className={buttonVariants({ variant: 'primary' })}>
          Ir para os talhões
        </Link>
      }
    />
  );
}
