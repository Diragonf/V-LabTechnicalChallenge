import { useCallback, useState } from 'react';
import { api } from '../services/api.ts';
import { CATEGORIAS, PRIORIDADES, STATUS } from '../types/solicitacao.ts';
import type { Categoria, Prioridade, Status, PaginatedSolicitacoes, FiltrosSolicitacao } from '../types/solicitacao.ts';
import { categoriaLabels, prioridadeLabels, statusLabels, formatDate } from '../domain/solicitacao.ts';
import { useAsyncResource } from '../hooks/useAsyncResource.ts';
import { AsyncFeedback } from './AsyncFeedback.tsx';
import styles from './Components.module.css';

const isEmpty = (data: PaginatedSolicitacoes) => data.data.length === 0;
interface Props { refreshKey?: number; onSelect: (id: number) => void }
export function SolicitacoesList({ refreshKey = 0, onSelect }: Props) {
  const [status, setStatus] = useState<Status | ''>('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [page, setPage] = useState(1);
  const load = useCallback((signal: AbortSignal) => {
    void refreshKey;
    const filters: FiltrosSolicitacao = { page, per_page: 10 };
    if (status) filters.status = status;
    if (categoria) filters.categoria = categoria;
    if (prioridade) filters.prioridade = prioridade;
    return api.listarSolicitacoes(filters, { signal });
  }, [status, categoria, prioridade, page, refreshKey]);
  const { state, retry } = useAsyncResource(load, isEmpty);
  function clear() { setStatus(''); setCategoria(''); setPrioridade(''); setPage(1); }

  return <section className={styles.section} aria-labelledby="list-title">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Atendimento</p><h2 id="list-title">Solicitações</h2></div><button className={styles.secondary} onClick={retry} disabled={state.status === 'loading'}>Atualizar lista</button></div>
    <div className={styles.filters}>
      <label>Status<select value={status} onChange={(e) => { const value = STATUS.find((item) => item === e.target.value); setStatus(value ?? ''); setPage(1); }}><option value="">Todos os status</option>{STATUS.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label>
      <label>Categoria<select value={categoria} onChange={(e) => { const value = CATEGORIAS.find((item) => item === e.target.value); setCategoria(value ?? ''); setPage(1); }}><option value="">Todas as categorias</option>{CATEGORIAS.map((item) => <option key={item} value={item}>{categoriaLabels[item]}</option>)}</select></label>
      <label>Prioridade<select value={prioridade} onChange={(e) => { const value = PRIORIDADES.find((item) => item === e.target.value); setPrioridade(value ?? ''); setPage(1); }}><option value="">Todas as prioridades</option>{PRIORIDADES.map((item) => <option key={item} value={item}>{prioridadeLabels[item]}</option>)}</select></label>
      <button className={styles.textButton} onClick={clear}>Limpar filtros</button>
    </div>
    <div aria-busy={state.status === 'loading'}>
      {state.status === 'loading' && <AsyncFeedback status="loading" message="Carregando solicitações…" />}
      {state.status === 'error' && <AsyncFeedback status="error" message={state.message} onRetry={retry} />}
      {state.status === 'empty' && <><AsyncFeedback status="empty" message="Nenhuma solicitação encontrada para esta página e estes filtros." />{page > 1 && <button className={styles.secondary} onClick={() => setPage(1)}>Voltar à primeira página</button>}</>}
      {state.status === 'success' && <div data-state="success">
        <div className={styles.tableScroll} role="region" aria-label="Tabela de solicitações" tabIndex={0}>
          <table><caption className={styles.srOnly}>Solicitações, mais recentes primeiro</caption><thead><tr><th scope="col">Protocolo / solicitante</th><th scope="col">Categoria</th><th scope="col">Prioridade</th><th scope="col">Status</th><th scope="col">Criação</th><th scope="col"><span className={styles.srOnly}>Ações</span></th></tr></thead>
            <tbody>{state.data.data.map((item) => <tr key={item.id}>
              <th scope="row"><span className={styles.protocol}>{item.protocolo}</span><span className={styles.person}>{item.nome_solicitante}</span></th>
              <td>{categoriaLabels[item.categoria]}</td><td><span className={styles.badge} data-tone={item.prioridade}>{prioridadeLabels[item.prioridade]}</span></td><td><span className={styles.badge} data-tone={item.status}>{statusLabels[item.status]}</span></td>
              <td className={styles.date}>{formatDate(item.data_criacao)}</td><td><button className={styles.textButton} onClick={() => onSelect(item.id)} aria-label={`Ver solicitação ${item.protocolo}`}>Ver detalhes <span aria-hidden="true">↗</span></button></td>
            </tr>)}</tbody></table>
        </div>
        <nav className={styles.pagination} aria-label="Paginação de solicitações"><span role="status">{state.data.meta.from}–{state.data.meta.to} de {state.data.meta.total} solicitações</span><div><button className={styles.secondary} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {state.data.meta.current_page} de {state.data.meta.last_page}</span><button className={styles.secondary} disabled={page >= state.data.meta.last_page} onClick={() => setPage((value) => value + 1)}>Próxima</button></div></nav>
      </div>}
    </div>
  </section>;
}
