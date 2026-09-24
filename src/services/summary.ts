import { api } from './api.ts';
import { STATUS, PRIORIDADES } from '../types/solicitacao.ts';
import type { Status, Prioridade } from '../types/solicitacao.ts';

export interface Summary {
  total: number;
  status: Record<Status, number>;
  prioridade: Record<Prioridade, number>;
}

/** Usa meta.total para contar todos os registros, sem limitar o resumo à página visível. */
export async function getSummary(signal: AbortSignal): Promise<Summary> {
  const [total, statuses, prioridades] = await Promise.all([
    api.listarSolicitacoes({ per_page: 1 }, { signal }),
    Promise.all(STATUS.map(async (status) => ({ status, total: (await api.listarSolicitacoes({ status, per_page: 1 }, { signal })).meta.total }))),
    Promise.all(PRIORIDADES.map(async (prioridade) => ({ prioridade, total: (await api.listarSolicitacoes({ prioridade, per_page: 1 }, { signal })).meta.total }))),
  ]);
  const result: Summary = {
    total: total.meta.total,
    status: { RECEBIDA: 0, EM_ANALISE: 0, AGENDADA: 0, CONCLUIDA: 0, CANCELADA: 0 },
    prioridade: { BAIXA: 0, MEDIA: 0, ALTA: 0, URGENTE: 0 },
  };
  for (const item of statuses) result.status[item.status] = item.total;
  for (const item of prioridades) result.prioridade[item.prioridade] = item.total;
  return result;
}
