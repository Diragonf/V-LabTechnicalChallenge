import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '../services/api.ts';
import type { Solicitacao, Status } from '../types/solicitacao.ts';
import { acaoLabels, categoriaLabels, formatDate, prioridadeLabels, statusLabels, transicoes } from '../domain/solicitacao.ts';
import { errorMessage, useAsyncResource } from '../hooks/useAsyncResource.ts';
import { AsyncFeedback } from './AsyncFeedback.tsx';
import styles from './Components.module.css';

interface Props { id: number; onClose: () => void; onUpdated?: (solicitacao: Solicitacao) => void }
const isEmpty = (data: Solicitacao | null) => data === null;
export function SolicitacaoDetailsModal({ id, onClose, onUpdated }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const mutation = useRef<AbortController | null>(null);
  const [action, setAction] = useState<{ status: 'loading' | 'error' | 'success'; message: string } | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await api.detalharSolicitacao(id, { signal }); }
    catch (error: unknown) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }, [id]);
  const { state, setState, retry } = useAsyncResource(load, isEmpty);
  const busy = action?.status === 'loading';
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      mutation.current?.abort(); element?.close(); document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  async function transition(status: Status) {
    if (mutation.current || state.status !== 'success' || !state.data || !transicoes[state.data.status].includes(status)) return;
    const controller = new AbortController(); mutation.current = controller;
    setAction({ status: 'loading', message: 'Atualizando status…' });
    try {
      const updated = await api.atualizarStatusSolicitacao(id, { status }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setState({ status: 'success', data: updated });
      setAction({ status: 'success', message: `Status atualizado para ${statusLabels[updated.status]}.` });
      onUpdated?.(updated);
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setAction({ status: 'error', message: errorMessage(error) });
      if (error instanceof ApiError && (error.status === 422 || error.status === 404)) retry();
    } finally { if (mutation.current === controller) mutation.current = null; }
  }
  return <dialog ref={dialog} className={styles.modal} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.modalHeader}><div><p className={styles.eyebrow}>Detalhes do atendimento</p><h2 id={titleId}>Solicitação</h2></div><button className={styles.secondary} onClick={onClose} disabled={busy} aria-label="Fechar detalhes">Fechar ×</button></div>
    <div aria-busy={state.status === 'loading' || busy}>
      {state.status === 'loading' && <AsyncFeedback status="loading" message="Carregando detalhes…" />}
      {state.status === 'error' && <AsyncFeedback status="error" message={state.message} onRetry={retry} />}
      {state.status === 'empty' && <AsyncFeedback status="empty" message="Esta solicitação não foi encontrada ou não está mais disponível." />}
      {state.status === 'success' && state.data && <div data-state="success">
        <p className={styles.modalProtocol}>{state.data.protocolo}</p>
        <div className={styles.badges}><span className={styles.badge} data-tone={state.data.status}>{statusLabels[state.data.status]}</span><span className={styles.badge} data-tone={state.data.prioridade}>Prioridade {prioridadeLabels[state.data.prioridade]}</span></div>
        <dl className={styles.details}>
          <div><dt>Solicitante</dt><dd>{state.data.nome_solicitante}</dd></div><div><dt>Categoria</dt><dd>{categoriaLabels[state.data.categoria]}</dd></div>
          <div><dt>Data de criação</dt><dd>{formatDate(state.data.data_criacao)}</dd></div><div><dt>Última atualização</dt><dd>{formatDate(state.data.data_atualizacao)}</dd></div>
          <div className={styles.full}><dt>Descrição</dt><dd>{state.data.descricao}</dd></div><div className={styles.full}><dt>Justificativa da prioridade</dt><dd>{state.data.justificativa_prioridade || 'Não informada.'}</dd></div>
        </dl>
        {transicoes[state.data.status].length === 0 ? <AsyncFeedback status="empty" message="Fluxo encerrado. Este status não permite novas transições." /> : <div className={styles.actions}>
          {transicoes[state.data.status].map((status) => <button key={status} className={status === 'CANCELADA' ? styles.danger : styles.primary} disabled={busy} onClick={() => void transition(status)}>{acaoLabels[status]}</button>)}
        </div>}
      </div>}
      {action && <AsyncFeedback status={action.status} message={action.message} />}
    </div>
  </dialog>;
}
