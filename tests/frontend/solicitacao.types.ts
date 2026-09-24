import type { CriarSolicitacaoDTO, AtualizarStatusSolicitacaoDTO } from '../../src/types/solicitacao.ts';

const base = { nome_solicitante: 'Pessoa Fictícia Alfa', categoria: 'EXAME', descricao: 'Cenário fictício.' } as const;
export const urgente: CriarSolicitacaoDTO = { ...base, prioridade: 'URGENTE', justificativa_prioridade: 'Motivo fictício.' };
export const comum: CriarSolicitacaoDTO = { ...base, prioridade: 'MEDIA' };

// @ts-expect-error URGENTE exige justificativa.
export const semJustificativa: CriarSolicitacaoDTO = { ...base, prioridade: 'URGENTE' };
// @ts-expect-error URGENTE não aceita justificativa nula.
export const justificativaNula: CriarSolicitacaoDTO = { ...base, prioridade: 'URGENTE', justificativa_prioridade: null };
// @ts-expect-error Status deve pertencer ao enum da API.
export const statusInvalido: AtualizarStatusSolicitacaoDTO = { status: 'INVALIDO' };
// @ts-expect-error Protocolo é definido pelo servidor.
export const protocoloForjado: CriarSolicitacaoDTO = { ...base, prioridade: 'MEDIA', protocolo: 'SOL-FORJADO' };
