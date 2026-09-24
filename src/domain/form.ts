import type { Categoria, Prioridade } from '../types/solicitacao.ts';
export interface FormValues {
  nome_solicitante: string;
  categoria: Categoria;
  prioridade: Prioridade;
  descricao: string;
  justificativa_prioridade: string;
}
export type FormErrors = Partial<Record<keyof FormValues, string>>;
export const initialValues: FormValues = { nome_solicitante: '', categoria: 'CONSULTA', prioridade: 'MEDIA', descricao: '', justificativa_prioridade: '' };
export function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.nome_solicitante.trim()) errors.nome_solicitante = 'Informe o nome fictício do solicitante.';
  else if ([...values.nome_solicitante.trim()].length > 255) errors.nome_solicitante = 'Use até 255 caracteres.';
  if (!values.descricao.trim()) errors.descricao = 'Descreva a solicitação.';
  else if ([...values.descricao.trim()].length > 10000) errors.descricao = 'Use até 10.000 caracteres.';
  if (values.prioridade === 'URGENTE') {
    if (!values.justificativa_prioridade.trim()) errors.justificativa_prioridade = 'Justifique a prioridade urgente.';
    else if ([...values.justificativa_prioridade.trim()].length > 10000) errors.justificativa_prioridade = 'Use até 10.000 caracteres.';
  }
  return errors;
}
