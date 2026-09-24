import styles from './Components.module.css';

interface Props {
  status: 'loading' | 'empty' | 'error' | 'success';
  message: string;
  onRetry?: () => void;
}
export function AsyncFeedback({ status, message, onRetry }: Props) {
  return <div className={`${styles.feedback} ${styles[status]}`} role={status === 'error' ? 'alert' : 'status'} data-state={status}>
    {status === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
    <span>{message}</span>
    {status === 'error' && onRetry && <button type="button" className={styles.secondary} onClick={onRetry}>Tentar novamente</button>}
  </div>;
}
