import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { api, ApiError } from '../../src/services/api.ts';
import { DashboardSummary } from '../../src/components/DashboardSummary.tsx';
import { SolicitacoesList } from '../../src/components/SolicitacoesList.tsx';
import { SolicitacaoForm } from '../../src/components/SolicitacaoForm.tsx';
import { SolicitacaoDetailsModal } from '../../src/components/SolicitacaoDetailsModal.tsx';
import type { PaginatedSolicitacoes, Solicitacao, Status } from '../../src/types/solicitacao.ts';

const item: Solicitacao = { id: 1, protocolo: 'SOL-20260923-A1B2C3D4E5F60708', nome_solicitante: 'Pessoa Fictícia Alfa', categoria: 'EXAME', prioridade: 'ALTA', status: 'RECEBIDA', descricao: 'Atendimento fictício.', justificativa_prioridade: null, data_criacao: '2026-09-23T12:00:00Z', data_atualizacao: '2026-09-23T12:00:00Z' };
function page(data: Solicitacao[] = [item], total = data.length, current = 1): PaginatedSolicitacoes {
  return { data, links: { first: '/', last: '/', prev: null, next: null }, meta: { current_page: current, from: data.length ? 1 : null, last_page: Math.max(1, Math.ceil(total / 10)), links: [], path: '/', per_page: 10, to: data.length || null, total } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
const fail = () => new ApiError('Serviço indisponível.', 'HTTP_ERROR', 503);

describe('DashboardSummary', () => {
  test('mostra carregamento e usa totais globais, não tamanho da página', async () => {
    const pending = deferred<PaginatedSolicitacoes>();
    const mock = vi.spyOn(api, 'listarSolicitacoes').mockReturnValue(pending.promise);
    render(<DashboardSummary />);
    expect(screen.getByText('Carregando indicadores…')).toBeVisible();
    await act(async () => { pending.resolve(page([item], 37)); });
    expect(await screen.findByText('solicitações no total')).toBeVisible();
    expect(screen.getAllByText('37')).toHaveLength(10);
    expect(mock).toHaveBeenCalledTimes(10);
    expect(mock).toHaveBeenCalledWith({ prioridade: 'URGENTE', per_page: 1 }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  test('exibe vazio', async () => {
    vi.spyOn(api, 'listarSolicitacoes').mockResolvedValue(page([], 0));
    render(<DashboardSummary />);
    expect(await screen.findByText(/Ainda não há solicitações/)).toBeVisible();
  });
  test('exibe erro e permite nova tentativa', async () => {
    const mock = vi.spyOn(api, 'listarSolicitacoes').mockRejectedValue(fail());
    render(<DashboardSummary />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível.');
    mock.mockResolvedValue(page());
    await userEvent.click(screen.getByText('Tentar novamente'));
    expect(await screen.findByText('solicitações no total')).toBeVisible();
  });
});

describe('SolicitacoesList', () => {
  test('pagina, aplica os três filtros e reinicia a página', async () => {
    const mock = vi.spyOn(api, 'listarSolicitacoes').mockImplementation(async (filters) => page([item], 21, filters?.page ?? 1));
    const select = vi.fn(); render(<SolicitacoesList onSelect={select} />);
    await screen.findByText(item.protocolo);
    await userEvent.click(screen.getByText('Próxima'));
    await screen.findByText('Página 2 de 3');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'EM_ANALISE');
    await screen.findByText('Página 1 de 3');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'EXAME');
    await userEvent.selectOptions(screen.getByLabelText('Prioridade'), 'ALTA');
    await waitFor(() => expect(mock).toHaveBeenLastCalledWith({ page: 1, per_page: 10, status: 'EM_ANALISE', categoria: 'EXAME', prioridade: 'ALTA' }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    await userEvent.click(await screen.findByRole('button', { name: `Ver solicitação ${item.protocolo}` }));
    expect(select).toHaveBeenCalledWith(1);
  });
  test('respostas antigas não substituem o filtro atual', async () => {
    const old = deferred<PaginatedSolicitacoes>();
    vi.spyOn(api, 'listarSolicitacoes').mockReturnValueOnce(old.promise).mockResolvedValue(page([{ ...item, protocolo: 'PROTOCOLO-NOVO' }]));
    render(<SolicitacoesList onSelect={() => {}} />);
    expect(screen.getByText('Carregando solicitações…')).toBeVisible();
    await userEvent.selectOptions(screen.getByLabelText('Prioridade'), 'URGENTE');
    await screen.findByText('PROTOCOLO-NOVO');
    await act(async () => { old.resolve(page()); });
    expect(screen.queryByText(item.protocolo)).not.toBeInTheDocument();
  });
  test('exibe a falha da API e permite tentar novamente até uma listagem vazia', async () => {
    const user = userEvent.setup();
    const list = vi.spyOn(api, 'listarSolicitacoes').mockRejectedValueOnce(fail()).mockResolvedValue(page([]));
    render(<SolicitacoesList onSelect={() => {}} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent('Serviço indisponível.');
    expect(screen.queryByText('Carregando solicitações…')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma solicitação encontrada/)).not.toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText(/Nenhuma solicitação encontrada/)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe('SolicitacaoForm', () => {
  test.each(['BAIXA', 'MEDIA', 'ALTA'])('exibe justificativa apenas para URGENTE e a remove ao selecionar %s', async (prioridade) => {
    const user = userEvent.setup();
    render(<SolicitacaoForm />);
    const select = screen.getByRole('combobox', { name: 'Prioridade *' });
    expect(screen.queryByRole('textbox', { name: /Justificativa/ })).not.toBeInTheDocument();
    await user.selectOptions(select, prioridade);
    expect(screen.queryByRole('textbox', { name: /Justificativa/ })).not.toBeInTheDocument();
    await user.selectOptions(select, 'URGENTE');
    expect(screen.getByRole('textbox', { name: /Justificativa/ })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /Justificativa/ })).toBeRequired();
    await user.selectOptions(select, prioridade);
    expect(screen.queryByRole('textbox', { name: /Justificativa/ })).not.toBeInTheDocument();
  });

  test.each(['ALTA', 'URGENTE'] as const)('envia os dados preenchidos com prioridade %s ao serviço mockado', async (prioridade) => {
    const user = userEvent.setup();
    const justificativa = 'Motivo fictício da urgência.';
    const created: Solicitacao = { ...item, prioridade, justificativa_prioridade: prioridade === 'URGENTE' ? justificativa : null };
    const create = vi.spyOn(api, 'criarSolicitacao').mockResolvedValue(created);
    const onCreated = vi.fn();
    render(<SolicitacaoForm onCreated={onCreated} />);

    await user.type(screen.getByRole('textbox', { name: 'Nome fictício do solicitante *' }), item.nome_solicitante);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Categoria *' }), 'EXAME');
    await user.type(screen.getByRole('textbox', { name: 'Descrição *' }), item.descricao);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Prioridade *' }), 'URGENTE');
    await user.type(screen.getByRole('textbox', { name: /Justificativa/ }), justificativa);
    // Uma justificativa preenchida deixa de integrar o envio ao sair de URGENTE.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Prioridade *' }), prioridade);
    await user.click(screen.getByRole('button', { name: 'Cadastrar solicitação' }));

    expect(await screen.findByRole('status')).toHaveTextContent(`Solicitação cadastrada. Protocolo: ${created.protocolo}`);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      nome_solicitante: item.nome_solicitante,
      categoria: 'EXAME',
      prioridade,
      descricao: item.descricao,
      ...(prioridade === 'URGENTE' ? { justificativa_prioridade: justificativa } : {}),
    }, { signal: expect.any(AbortSignal) });
    expect(onCreated).toHaveBeenCalledExactlyOnceWith(created);
  });

  async function fill() {
    await userEvent.type(screen.getByLabelText('Nome fictício do solicitante *'), 'Pessoa Fictícia Alfa');
    await userEvent.type(screen.getByLabelText('Descrição *'), 'Atendimento fictício.');
  }
  test('valida em tempo real e exige justificativa dinâmica para URGENTE', async () => {
    const create = vi.spyOn(api, 'criarSolicitacao').mockResolvedValue(item);
    render(<SolicitacaoForm />);
    expect(screen.getByText('Nenhuma solicitação enviada neste formulário.')).toBeVisible();
    expect(screen.queryByLabelText(/Justificativa/)).not.toBeInTheDocument();
    await fill();
    await userEvent.selectOptions(screen.getByLabelText('Prioridade *'), 'URGENTE');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar solicitação' }));
    expect(await screen.findByText('Justifique a prioridade urgente.')).toBeVisible();
    expect(create).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Justificativa da prioridade urgente *'), 'Motivo fictício.');
    expect(screen.queryByText('Justifique a prioridade urgente.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar solicitação' }));
    expect(await screen.findByText(/Solicitação cadastrada. Protocolo:/)).toBeVisible();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ prioridade: 'URGENTE', justificativa_prioridade: 'Motivo fictício.' }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  test('bloqueia envio duplicado enquanto carrega e notifica o cadastro', async () => {
    const pending = deferred<Solicitacao>();
    const create = vi.spyOn(api, 'criarSolicitacao').mockReturnValue(pending.promise);
    const onCreated = vi.fn(); render(<SolicitacaoForm onCreated={onCreated} />); await fill();
    await userEvent.dblClick(screen.getByRole('button', { name: 'Cadastrar solicitação' }));
    expect(screen.getByText('Enviando solicitação…')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(item); });
    expect(onCreated).toHaveBeenCalledWith(item);
  });
  test('mostra erro 422 junto do campo e preserva valores', async () => {
    vi.spyOn(api, 'criarSolicitacao').mockRejectedValue(new ApiError('Revise os dados.', 'HTTP_ERROR', 422, { nome_solicitante: ['Nome inválido no cenário fictício.'] }));
    render(<SolicitacaoForm />); await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar solicitação' }));
    expect(await screen.findByText('Nome inválido no cenário fictício.')).toBeVisible();
    expect(screen.getByLabelText('Nome fictício do solicitante *')).toHaveValue('Pessoa Fictícia Alfa');
    expect(screen.getByRole('alert')).toHaveTextContent('Revise os dados.');
  });
});

describe('SolicitacaoDetailsModal', () => {
  test.each<[Status, string | null]>([['RECEBIDA', 'Iniciar análise'], ['EM_ANALISE', 'Agendar solicitação'], ['AGENDADA', 'Concluir solicitação'], ['CONCLUIDA', null], ['CANCELADA', null]])('oferece apenas ações permitidas para %s', async (status, advance) => {
    vi.spyOn(api, 'detalharSolicitacao').mockResolvedValue({ ...item, status });
    render(<SolicitacaoDetailsModal id={1} onClose={() => {}} />);
    await screen.findByText(item.protocolo);
    const dialog = screen.getByRole('dialog', { name: 'Solicitação' });
    expect(within(dialog).getByText('Atendimento fictício.')).toBeVisible();
    if (advance) {
      expect(within(dialog).getByRole('button', { name: advance })).toBeVisible();
      expect(within(dialog).getByRole('button', { name: 'Cancelar solicitação' })).toBeVisible();
      expect(within(dialog).getAllByRole('button')).toHaveLength(3);
    } else {
      expect(within(dialog).getByText(/Fluxo encerrado/)).toBeVisible();
      expect(within(dialog).getAllByRole('button')).toHaveLength(1);
    }
  });
  test('atualiza status com feedback e bloqueia ações concorrentes', async () => {
    vi.spyOn(api, 'detalharSolicitacao').mockResolvedValue(item);
    const pending = deferred<Solicitacao>();
    vi.spyOn(api, 'atualizarStatusSolicitacao').mockReturnValue(pending.promise);
    const onUpdated = vi.fn(); render(<SolicitacaoDetailsModal id={1} onClose={() => {}} onUpdated={onUpdated} />);
    await userEvent.click(await screen.findByText('Iniciar análise'));
    expect(screen.getByText('Atualizando status…')).toBeVisible();
    expect(screen.getByText('Cancelar solicitação')).toBeDisabled();
    await act(async () => { pending.resolve({ ...item, status: 'EM_ANALISE' }); });
    expect(await screen.findByText('Status atualizado para Em análise.')).toBeVisible();
    expect(onUpdated).toHaveBeenCalledOnce();
    expect(screen.getByText('Agendar solicitação')).toBeVisible();
  });
  test('404 exibe vazio; Escape solicita fechamento', async () => {
    vi.spyOn(api, 'detalharSolicitacao').mockRejectedValue(new ApiError('Não encontrada.', 'HTTP_ERROR', 404));
    const close = vi.fn(); render(<SolicitacaoDetailsModal id={1} onClose={close} />);
    expect(screen.getByText('Carregando detalhes…')).toBeVisible();
    await screen.findByText(/Esta solicitação não foi encontrada/);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(close).toHaveBeenCalledOnce();
  });
  test('erro de consulta oferece retry', async () => {
    vi.spyOn(api, 'detalharSolicitacao').mockRejectedValueOnce(fail()).mockResolvedValue(item);
    render(<SolicitacaoDetailsModal id={1} onClose={() => {}} />);
    await screen.findByRole('alert');
    await userEvent.click(screen.getByText('Tentar novamente'));
    expect(await screen.findByText(item.protocolo)).toBeVisible();
  });
});
