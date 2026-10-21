import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders, AppRoutes, criarQueryClient } from './App';
import { createLocalStorageRepository } from './lib/repository/localStorageRepository';
import { STORAGE_KEY } from './data/config';

function renderApp(rota = '/') {
  const repository = createLocalStorageRepository({ semearExemplos: false });
  const utils = render(
    <AppProviders repository={repository} queryClient={criarQueryClient()}>
      <MemoryRouter initialEntries={[rota]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
  return { repository, ...utils };
}

describe('caminho feliz: registrar atividade', () => {
  it('escolhe talhão e tipo, salva, e a atividade aparece no topo do histórico', async () => {
    const user = userEvent.setup();
    const seed = createLocalStorageRepository({ semearExemplos: false });
    const talhao = await seed.createTalhao({ nome: 'Talhão da Mina', areaHa: 1.5, variedade: 'Catuaí' });
    await seed.createTalhao({ nome: 'Talhão do Morro', areaHa: 2, variedade: '' });
    await seed.createAtividade({ talhaoId: talhao.id, data: '2020-01-01', tipo: 'Poda', nota: 'antiga' });

    renderApp('/');

    expect(await screen.findByText('Talhão da Mina')).toBeInTheDocument();
    expect(screen.getByText(/dados ficam só neste aparelho/i)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Registrar atividade' }));
    expect(await screen.findByRole('heading', { name: 'Registrar atividade' })).toBeInTheDocument();

    // Envio vazio mostra erros ligados ao campo via aria-describedby.
    await user.click(screen.getByRole('button', { name: 'Salvar atividade' }));
    const selectTalhao = screen.getByLabelText('Talhão');
    expect(selectTalhao).toHaveAttribute('aria-invalid', 'true');
    expect(selectTalhao).toHaveAccessibleDescription('Escolha o talhão.');
    expect(screen.getByLabelText('O que foi feito')).toHaveAccessibleDescription('Escolha o tipo de atividade.');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').atividades).toHaveLength(1);

    await user.selectOptions(selectTalhao, 'Talhão da Mina');
    await user.selectOptions(screen.getByLabelText('O que foi feito'), 'Colheita');
    await user.type(screen.getByLabelText(/Anotação/), '12 sacas');
    await user.click(screen.getByRole('button', { name: 'Salvar atividade' }));

    expect(await screen.findByRole('heading', { name: 'Talhão da Mina' })).toBeInTheDocument();
    expect(screen.getByText('Atividade registrada.')).toHaveAttribute('role', 'status');

    const lista = await screen.findByRole('list', { name: /mais recente/i });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Colheita');
    expect(itens[0]).toHaveTextContent('12 sacas');
    expect(itens[1]).toHaveTextContent('Poda');

    // Filtro por tipo
    await user.selectOptions(screen.getByLabelText('Filtrar por tipo'), 'Poda');
    expect(within(lista).getAllByRole('listitem')).toHaveLength(1);
  });

  it('dado corrompido mostra erro com opção de recomeçar', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, 'não é json');
    renderApp('/');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/não puderam ser lidos/);
    await user.click(within(alerta).getByRole('button', { name: 'Recomeçar do zero' }));
    await user.click(screen.getByRole('button', { name: 'Sim, apagar e recomeçar' }));
    expect(await screen.findByText('Nenhum talhão cadastrado')).toBeInTheDocument();
  });

  it('primeiro uso mostra exemplos marcados e permite remover com confirmação', async () => {
    const user = userEvent.setup();
    const repository = createLocalStorageRepository();
    render(
      <AppProviders repository={repository} queryClient={criarQueryClient()}>
        <MemoryRouter>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText('[EXEMPLO] Talhão da Baixada')).toBeInTheDocument();
    expect(screen.getAllByText('Exemplo').length).toBeGreaterThan(0);
    // 1º clique só pede confirmação — nada é apagado ainda.
    await user.click(screen.getByRole('button', { name: 'Remover exemplos' }));
    expect(screen.getByRole('button', { name: 'Sim, remover exemplos e as atividades deles' })).toBeInTheDocument();
    expect(screen.getByText('[EXEMPLO] Talhão da Baixada')).toBeInTheDocument();
    expect((await repository.listTalhoes()).some((t) => t.ficticio)).toBe(true);

    // Cancelar mantém os exemplos e volta ao botão original.
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Sim, remover exemplos e as atividades deles' })).not.toBeInTheDocument();
    expect(screen.getByText('[EXEMPLO] Talhão da Baixada')).toBeInTheDocument();
    expect((await repository.listTalhoes()).some((t) => t.ficticio)).toBe(true);

    // Confirmar remove.
    await user.click(screen.getByRole('button', { name: 'Remover exemplos' }));
    await user.click(screen.getByRole('button', { name: 'Sim, remover exemplos e as atividades deles' }));
    expect(await screen.findByText('Nenhum talhão cadastrado')).toBeInTheDocument();
    expect(await repository.listTalhoes()).toHaveLength(0);
  });
});
