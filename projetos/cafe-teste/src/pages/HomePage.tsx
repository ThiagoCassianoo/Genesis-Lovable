import { useLocation } from 'react-router-dom';
import { AvisoSucesso } from '@/components/AvisoSucesso';
import { lerAviso } from '@/lib/avisoNavegacao';
import { BotaoRegistrarFixoSection } from '@/sections/BotaoRegistrarFixoSection';
import { TalhoesSection } from '@/sections/TalhoesSection';

export function HomePage() {
  const aviso = lerAviso(useLocation().state);
  return (
    <>
      {aviso && <AvisoSucesso texto={aviso} />}
      <TalhoesSection />
      <BotaoRegistrarFixoSection />
    </>
  );
}
