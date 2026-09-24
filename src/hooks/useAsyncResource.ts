import { useEffect, useState } from 'react';
import { ApiError } from '../services/api.ts';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação. Tente novamente.';
}

export function useAsyncResource<T>(load: (signal: AbortSignal) => Promise<T>, isEmpty: (data: T) => boolean) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    void load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState(isEmpty(data) ? { status: 'empty' } : { status: 'success', data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: errorMessage(error) });
    });
    return () => controller.abort();
  }, [load, isEmpty, attempt]);
  return { state, setState, retry: () => setAttempt((value) => value + 1) };
}
