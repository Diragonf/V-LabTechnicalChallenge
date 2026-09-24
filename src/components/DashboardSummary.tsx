import { useCallback } from 'react';
import { STATUS, PRIORIDADES } from '../types/solicitacao.ts';
import { statusLabels, prioridadeLabels } from '../domain/solicitacao.ts';
import { getSummary } from '../services/summary.ts';
import type { Summary } from '../services/summary.ts';
import { useAsyncResource } from '../hooks/useAsyncResource.ts';
import { AsyncFeedback } from './AsyncFeedback.tsx';
import styles from './Components.module.css';

const isEmpty = (data: Summary) => data.total === 0;
export function DashboardSummary({ refreshKey = 0 }: { refreshKey?: number }) {
  const load = useCallback((signal: AbortSignal) => { void refreshKey; return getSummary(signal); }, [refreshKey]);
  const { state, retry } = useAsyncResource(load, isEmpty);
  return <section aria-labelledby="summary-title" className={styles.section} aria-busy={state.status === 'loading'}>
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Visão geral</p><h2 id="summary-title">Cada solicitação, acompanhada.</h2></div><span className={styles.muted}>Todas as solicitações</span></div>
    {state.status === 'loading' && <AsyncFeedback status="loading" message="Carregando indicadores…" />}
    {state.status === 'error' && <AsyncFeedback status="error" message={state.message} onRetry={retry} />}
    {state.status === 'empty' && <><div className={styles.total}>0 <span>solicitações cadastradas</span></div><AsyncFeedback status="empty" message="Ainda não há solicitações. Cadastre a primeira no formulário abaixo." /></>}
    {state.status === 'success' && <div data-state="success">
      <div className={styles.total}>{state.data.total.toLocaleString('pt-BR')} <span>solicitações no total</span></div>
      <h3 className={styles.groupTitle}>Por status</h3>
      <div className={styles.statusGrid}>{STATUS.map((status) => <article className={styles.metric} key={status}>
        <span className={styles.metricLabel}><i className={styles.dot} data-tone={status} aria-hidden="true" />{statusLabels[status]}</span><strong>{state.data.status[status]}</strong>
      </article>)}</div>
      <h3 className={styles.groupTitle}>Por prioridade</h3>
      <div className={styles.priorityGrid}>{PRIORIDADES.map((prioridade) => <article className={styles.priorityMetric} key={prioridade}>
        <span className={styles.badge} data-tone={prioridade}>{prioridadeLabels[prioridade]}</span><strong>{state.data.prioridade[prioridade]}</strong>
      </article>)}</div>
    </div>}
  </section>;
}
