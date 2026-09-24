export const CATEGORIAS = ['CONSULTA', 'EXAME', 'VACINACAO', 'OUTRO'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const STATUS = ['RECEBIDA', 'EM_ANALISE', 'AGENDADA', 'CONCLUIDA', 'CANCELADA'] as const;
export type Status = (typeof STATUS)[number];

export interface Solicitacao {
  id: number;
  protocolo: string;
  nome_solicitante: string;
  categoria: Categoria;
  prioridade: Prioridade;
  status: Status;
  descricao: string;
  justificativa_prioridade: string | null;
  /** ISO 8601, conforme retornado pela API. */
  data_criacao: string;
  data_atualizacao: string;
}

interface CriarSolicitacaoBase {
  nome_solicitante: string;
  categoria: Categoria;
  descricao: string;
}

/** URGENTE exige justificativa também em tempo de compilação. */
export type CriarSolicitacaoDTO = CriarSolicitacaoBase & (
  | { prioridade: 'URGENTE'; justificativa_prioridade: string }
  | { prioridade: Exclude<Prioridade, 'URGENTE'>; justificativa_prioridade?: string | null }
);

export interface AtualizarStatusSolicitacaoDTO {
  status: Status;
}

export interface FiltrosSolicitacao {
  status?: Status;
  categoria?: Categoria;
  prioridade?: Prioridade;
  page?: number;
  per_page?: number;
}

export interface SolicitacaoResponse {
  data: Solicitacao;
}

export interface PaginatedSolicitacoes {
  data: Solicitacao[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
}

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

export interface ApiErrorResponse {
  message: string;
  errors: Record<string, string[]>;
}
