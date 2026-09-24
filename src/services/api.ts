import { CATEGORIAS, PRIORIDADES, STATUS } from '../types/solicitacao.ts';
import type {
  ApiErrorResponse,
  AtualizarStatusSolicitacaoDTO,
  CriarSolicitacaoDTO,
  FiltrosSolicitacao,
  HealthResponse,
  PaginatedSolicitacoes,
  Solicitacao,
  SolicitacaoResponse,
} from '../types/solicitacao.ts';

export type ApiErrorCode = 'HTTP_ERROR' | 'NETWORK_ERROR' | 'ABORTED' | 'INVALID_RESPONSE' | 'INVALID_REQUEST';

/** Formato único para falhas HTTP, rede, cancelamento e contrato inválido. */
export class ApiError extends Error implements ApiErrorResponse {
  readonly status: number | null;
  readonly code: ApiErrorCode;
  readonly errors: Record<string, string[]>;
  readonly health: HealthResponse | undefined;

  constructor(
    message: string,
    code: ApiErrorCode,
    status: number | null = null,
    errors: Record<string, string[]> = {},
    health?: HealthResponse,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.errors = errors;
    this.health = health;
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}

function isDate(value: unknown): value is string {
  return isString(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function isSolicitacao(value: unknown): value is Solicitacao {
  return isRecord(value)
    && isInteger(value.id) && value.id > 0
    && isString(value.protocolo) && /^SOL-\d{8}-[A-F0-9]{16}$/.test(value.protocolo)
    && isString(value.nome_solicitante)
    && CATEGORIAS.some((categoria) => categoria === value.categoria)
    && PRIORIDADES.some((prioridade) => prioridade === value.prioridade)
    && STATUS.some((status) => status === value.status)
    && isString(value.descricao)
    && isNullableString(value.justificativa_prioridade)
    && isDate(value.data_criacao) && isDate(value.data_atualizacao);
}

function isSolicitacaoResponse(value: unknown): value is SolicitacaoResponse {
  return isRecord(value) && isSolicitacao(value.data);
}

function isPaginated(value: unknown): value is PaginatedSolicitacoes {
  if (!isRecord(value) || !Array.isArray(value.data) || !value.data.every(isSolicitacao)
    || !isRecord(value.links) || !isRecord(value.meta)) return false;

  const { links, meta } = value;
  return isString(links.first) && isString(links.last)
    && isNullableString(links.prev) && isNullableString(links.next)
    && isInteger(meta.current_page) && meta.current_page > 0
    && isNullableInteger(meta.from) && isNullableInteger(meta.to)
    && isInteger(meta.last_page) && meta.last_page > 0
    && isInteger(meta.per_page) && meta.per_page > 0 && meta.per_page <= 100
    && isInteger(meta.total) && meta.total >= 0 && isString(meta.path)
    && Array.isArray(meta.links) && meta.links.every((link: unknown) =>
      isRecord(link) && isNullableString(link.url) && isString(link.label) && typeof link.active === 'boolean');
}

function isHealth(value: unknown): value is HealthResponse {
  return isRecord(value) && isDate(value.timestamp)
    && ((value.status === 'ok' && value.database === 'connected')
      || (value.status === 'error' && value.database === 'disconnected'));
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && isString(value.message) && value.message.trim().length > 0
    && isRecord(value.errors)
    && Object.values(value.errors).every((messages: unknown) =>
      Array.isArray(messages) && messages.every(isString));
}

function fallbackMessage(status: number): string {
  switch (status) {
    case 400: return 'Requisição inválida.';
    case 401: return 'Autenticação necessária.';
    case 403: return 'Acesso não permitido.';
    case 404: return 'Recurso não encontrado.';
    case 415: return 'Envie o conteúdo como application/json.';
    case 422: return 'Os dados informados são inválidos.';
    case 429: return 'Muitas requisições. Tente novamente mais tarde.';
    case 503: return 'Serviço temporariamente indisponível.';
    default: return status >= 500
      ? 'Ocorreu um erro interno. Tente novamente mais tarde.'
      : 'Não foi possível processar a requisição.';
  }
}

function httpError(status: number, body: unknown): ApiError {
  if (status === 503 && isHealth(body)) {
    return new ApiError('Não foi possível conectar ao banco de dados.', 'HTTP_ERROR', status, {}, body);
  }
  // Mensagens de validação são úteis; respostas 5xx nunca propagam detalhes do servidor.
  if (status < 500 && isApiErrorResponse(body)) {
    return new ApiError(body.message, 'HTTP_ERROR', status, body.errors);
  }
  return new ApiError(fallbackMessage(status), 'HTTP_ERROR', status);
}

function pathForId(id: number): string {
  // PostgreSQL bigint pode exceder a precisão de number; não envie um ID arredondado.
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError('O identificador deve ser um inteiro positivo seguro.', 'INVALID_REQUEST');
  }
  return `/solicitacoes/${id}`;
}

/** baseUrl inclui /api/v1. O padrão usa a mesma origem do frontend. */
export function createApiClient(baseUrl = '/api/v1', fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
  const base = baseUrl.replace(/\/+$/, '');

  async function request<T>(
    path: string,
    validate: (value: unknown) => value is T,
    options: RequestOptions = {},
    method: 'GET' | 'POST' | 'PATCH' = 'GET',
    body?: CriarSolicitacaoDTO | AtualizarStatusSolicitacaoDTO,
  ): Promise<T> {
    const init: RequestInit = { method, headers: { Accept: 'application/json' } };
    if (options.signal) init.signal = options.signal;
    if (body !== undefined) {
      init.headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    if (path === '/health') init.cache = 'no-store';

    let response: Response;
    let text: string;
    try {
      response = await fetcher(`${base}${path}`, init);
      text = await response.text();
    } catch (error: unknown) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new ApiError('Requisição cancelada.', 'ABORTED');
      }
      throw new ApiError('Não foi possível conectar à API. Verifique sua conexão.', 'NETWORK_ERROR');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      if (!response.ok) throw httpError(response.status, undefined);
      throw new ApiError('A API retornou uma resposta inválida.', 'INVALID_RESPONSE', response.status);
    }
    if (!response.ok) throw httpError(response.status, payload);
    if (!validate(payload)) {
      throw new ApiError('A API retornou uma resposta incompatível com o contrato.', 'INVALID_RESPONSE', response.status);
    }
    return payload;
  }

  return {
    async criarSolicitacao(dto: CriarSolicitacaoDTO, options?: RequestOptions): Promise<Solicitacao> {
      return (await request('/solicitacoes', isSolicitacaoResponse, options, 'POST', dto)).data;
    },
    async listarSolicitacoes(filtros: FiltrosSolicitacao = {}, options?: RequestOptions): Promise<PaginatedSolicitacoes> {
      const query = new URLSearchParams();
      for (const campo of ['status', 'categoria', 'prioridade', 'page', 'per_page'] as const) {
        const value = filtros[campo];
        if (value !== undefined) query.set(campo, String(value));
      }
      const suffix = query.size > 0 ? `?${query.toString()}` : '';
      return request(`/solicitacoes${suffix}`, isPaginated, options);
    },
    async detalharSolicitacao(id: number, options?: RequestOptions): Promise<Solicitacao> {
      return (await request(pathForId(id), isSolicitacaoResponse, options)).data;
    },
    async atualizarStatusSolicitacao(id: number, dto: AtualizarStatusSolicitacaoDTO, options?: RequestOptions): Promise<Solicitacao> {
      return (await request(`${pathForId(id)}/status`, isSolicitacaoResponse, options, 'PATCH', dto)).data;
    },
    async verificarSaude(options?: RequestOptions): Promise<HealthResponse> {
      return request('/health', isHealth, options);
    },
  };
}

export const api = createApiClient();
