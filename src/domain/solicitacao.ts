import type { Categoria, Prioridade, Status } from '../types/solicitacao.ts';

export const statusLabels: Record<Status, string> = {
  RECEBIDA: 'Recebida', EM_ANALISE: 'Em análise', AGENDADA: 'Agendada', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
};
export const prioridadeLabels: Record<Prioridade, string> = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', URGENTE: 'Urgente' };
export const categoriaLabels: Record<Categoria, string> = { CONSULTA: 'Consulta', EXAME: 'Exame', VACINACAO: 'Vacinação', OUTRO: 'Outro' };
export const transicoes: Record<Status, readonly Status[]> = {
  RECEBIDA: ['EM_ANALISE', 'CANCELADA'], EM_ANALISE: ['AGENDADA', 'CANCELADA'],
  AGENDADA: ['CONCLUIDA', 'CANCELADA'], CONCLUIDA: [], CANCELADA: [],
};
export const acaoLabels: Partial<Record<Status, string>> = {
  EM_ANALISE: 'Iniciar análise', AGENDADA: 'Agendar solicitação', CONCLUIDA: 'Concluir solicitação', CANCELADA: 'Cancelar solicitação',
};
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));
}
