import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../services/api.ts';
import { CATEGORIAS, PRIORIDADES } from '../types/solicitacao.ts';
import type { CriarSolicitacaoDTO, Solicitacao } from '../types/solicitacao.ts';
import { categoriaLabels, prioridadeLabels } from '../domain/solicitacao.ts';
import { initialValues, validateForm } from '../domain/form.ts';
import type { FormValues, FormErrors } from '../domain/form.ts';
import { errorMessage } from '../hooks/useAsyncResource.ts';
import { AsyncFeedback } from './AsyncFeedback.tsx';
import styles from './Components.module.css';

interface Props { onCreated?: (solicitacao: Solicitacao) => void }
export function SolicitacaoForm({ onCreated }: Props) {
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const request = useRef<AbortController | null>(null);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [state, setState] = useState<'empty' | 'loading' | 'success' | 'error'>('empty');
  const [message, setMessage] = useState('');
  const errors = { ...validateForm(values), ...serverErrors };
  const busy = state === 'loading';
  useEffect(() => () => request.current?.abort(), []);

  function change<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
    setServerErrors((current) => { const next = { ...current }; delete next[field]; return next; });
    if (state === 'error') setState('empty');
  }
  function fieldProps(field: keyof FormValues) {
    return {
      id: `${prefix}-${field}`,
      name: field,
      'aria-invalid': Boolean(touched[field] && errors[field]),
      'aria-describedby': touched[field] && errors[field] ? `${prefix}-${field}-error` : undefined,
      onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
    };
  }
  function fieldError(field: keyof FormValues) {
    return touched[field] && errors[field] ? <span className={styles.fieldError} id={`${prefix}-${field}-error`} aria-live="polite">{errors[field]}</span> : null;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const validation = validateForm(values);
    setTouched({ nome_solicitante: true, categoria: true, prioridade: true, descricao: true, justificativa_prioridade: true });
    setServerErrors({});
    const firstError = Object.keys(validation)[0];
    if (firstError) {
      setState('error'); setMessage('Revise os campos indicados antes de enviar.');
      const input = formRef.current?.elements.namedItem(firstError);
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    const base = { nome_solicitante: values.nome_solicitante.trim(), categoria: values.categoria, descricao: values.descricao.trim() };
    const dto: CriarSolicitacaoDTO = values.prioridade === 'URGENTE'
      ? { ...base, prioridade: 'URGENTE', justificativa_prioridade: values.justificativa_prioridade.trim() }
      : { ...base, prioridade: values.prioridade };
    const controller = new AbortController(); request.current = controller;
    setState('loading');
    try {
      const created = await api.criarSolicitacao(dto, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setState('success'); setMessage(`Solicitação cadastrada. Protocolo: ${created.protocolo}`);
      onCreated?.(created);
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setState('error'); setMessage(errorMessage(error));
      if (error instanceof ApiError) {
        const fields: FormErrors = {};
        for (const field of Object.keys(initialValues) as Array<keyof FormValues>) {
          const fieldMessage = error.errors[field]?.[0];
          if (fieldMessage) fields[field] = fieldMessage;
        }
        setServerErrors(fields);
      }
    } finally { if (request.current === controller) request.current = null; }
  }
  function reset() { setValues(initialValues); setTouched({}); setServerErrors({}); setState('empty'); setMessage(''); }

  return <section className={styles.section} aria-labelledby="form-title">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Novo atendimento</p><h2 id="form-title">Cadastrar solicitação</h2></div><span className={styles.muted}>* Campos obrigatórios</span></div>
    <p className={styles.muted}>Utilize apenas nomes e informações fictícias neste ambiente de demonstração.</p>
    {state === 'success' ? <><AsyncFeedback status="success" message={message} /><button className={styles.primary} onClick={reset}>Cadastrar outra solicitação</button></> : <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}>
      <fieldset disabled={busy} className={styles.formGrid}>
        <legend className={styles.srOnly}>Dados da solicitação</legend>
        <div className={`${styles.field} ${styles.full}`}><label htmlFor={`${prefix}-nome_solicitante`}>Nome fictício do solicitante *</label><input {...fieldProps('nome_solicitante')} value={values.nome_solicitante} onChange={(e) => change('nome_solicitante', e.target.value)} autoComplete="off" required placeholder="Ex.: Pessoa Fictícia Alfa" />{fieldError('nome_solicitante')}</div>
        <div className={styles.field}><label htmlFor={`${prefix}-categoria`}>Categoria *</label><select {...fieldProps('categoria')} value={values.categoria} onChange={(e) => { const value = CATEGORIAS.find((item) => item === e.target.value); if (value) change('categoria', value); }}>{CATEGORIAS.map((item) => <option key={item} value={item}>{categoriaLabels[item]}</option>)}</select>{fieldError('categoria')}</div>
        <div className={styles.field}><label htmlFor={`${prefix}-prioridade`}>Prioridade *</label><select {...fieldProps('prioridade')} value={values.prioridade} onChange={(e) => { const value = PRIORIDADES.find((item) => item === e.target.value); if (value) change('prioridade', value); }}>{PRIORIDADES.map((item) => <option key={item} value={item}>{prioridadeLabels[item]}</option>)}</select>{fieldError('prioridade')}</div>
        <div className={`${styles.field} ${styles.full}`}><label htmlFor={`${prefix}-descricao`}>Descrição *</label><textarea {...fieldProps('descricao')} value={values.descricao} onChange={(e) => change('descricao', e.target.value)} rows={4} required placeholder="Descreva o atendimento solicitado…" />{fieldError('descricao')}</div>
        {values.prioridade === 'URGENTE' && <div className={`${styles.field} ${styles.full} ${styles.urgentField}`}><label htmlFor={`${prefix}-justificativa_prioridade`}>Justificativa da prioridade urgente *</label><textarea {...fieldProps('justificativa_prioridade')} value={values.justificativa_prioridade} onChange={(e) => change('justificativa_prioridade', e.target.value)} rows={3} required placeholder="Informe o motivo da urgência neste cenário fictício." />{fieldError('justificativa_prioridade')}</div>}
      </fieldset>
      {state === 'empty' && <AsyncFeedback status="empty" message="Nenhuma solicitação enviada neste formulário." />}
      {state === 'loading' && <AsyncFeedback status="loading" message="Enviando solicitação…" />}
      {state === 'error' && <AsyncFeedback status="error" message={message} />}
      <div className={styles.formFooter}><span className={styles.muted}>O protocolo será gerado automaticamente.</span><button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Cadastrar solicitação'}</button></div>
    </form>}
  </section>;
}
