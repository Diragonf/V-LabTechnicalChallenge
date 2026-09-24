import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createApiClient } from '../../src/services/api.ts';

const solicitacao = {
  id: 1,
  protocolo: 'SOL-20260923-A1B2C3D4E5F60708',
  nome_solicitante: 'Pessoa Fictícia Alfa',
  categoria: 'EXAME',
  prioridade: 'URGENTE',
  status: 'RECEBIDA',
  descricao: 'Cenário fictício de teste.',
  justificativa_prioridade: 'Motivo fictício de urgência.',
  data_criacao: '2026-09-23T12:00:00.000000Z',
  data_atualizacao: '2026-09-23T12:00:00.000000Z',
};
const dto = {
  nome_solicitante: solicitacao.nome_solicitante,
  categoria: solicitacao.categoria,
  prioridade: solicitacao.prioridade,
  descricao: solicitacao.descricao,
  justificativa_prioridade: solicitacao.justificativa_prioridade,
};
const pagina = {
  data: [solicitacao],
  links: { first: 'http://localhost/api/v1/solicitacoes?page=1', last: 'http://localhost/api/v1/solicitacoes?page=1', prev: null, next: null },
  meta: {
    current_page: 1, from: 1, last_page: 1, links: [{ url: null, label: 'Anterior', active: false }],
    path: 'http://localhost/api/v1/solicitacoes', per_page: 15, to: 1, total: 1,
  },
};
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

function errorWith(code, status) {
  return (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}

test('criação envia JSON e devolve data sem envelope', async () => {
  const api = createApiClient('/api/v1/', async (url, init) => {
    assert.equal(url, '/api/v1/solicitacoes');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Accept, 'application/json');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), dto);
    return json({ data: solicitacao }, 201);
  });
  assert.deepEqual(await api.criarSolicitacao(dto), solicitacao);
});

test('listagem serializa filtros e preserva dados, links e meta', async () => {
  const api = createApiClient('http://localhost/api/v1', async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/api/v1/solicitacoes');
    assert.deepEqual(Object.fromEntries(parsed.searchParams), { status: 'RECEBIDA', categoria: 'EXAME', prioridade: 'URGENTE', page: '2', per_page: '15' });
    assert.equal(init.method, 'GET');
    assert.equal(init.body, undefined);
    return json(pagina);
  });
  assert.deepEqual(await api.listarSolicitacoes({ status: 'RECEBIDA', categoria: 'EXAME', prioridade: 'URGENTE', page: 2, per_page: 15 }), pagina);
});

test('listagem omite filtros ausentes e aceita página vazia', async () => {
  const vazio = { ...pagina, data: [], meta: { ...pagina.meta, from: null, to: null, total: 0 } };
  const api = createApiClient('/api/v1', async (url) => {
    assert.equal(url, '/api/v1/solicitacoes');
    return json(vazio);
  });
  assert.deepEqual(await api.listarSolicitacoes(), vazio);
});

test('detalhe e atualização usam ID e método corretos', async () => {
  const api = createApiClient('/api/v1', async (url, init) => {
    if (init.method === 'PATCH') {
      assert.equal(url, '/api/v1/solicitacoes/1/status');
      assert.deepEqual(JSON.parse(init.body), { status: 'EM_ANALISE' });
      return json({ data: { ...solicitacao, status: 'EM_ANALISE' } });
    }
    assert.equal(url, '/api/v1/solicitacoes/1');
    return json({ data: solicitacao });
  });
  assert.deepEqual(await api.detalharSolicitacao(1), solicitacao);
  assert.equal((await api.atualizarStatusSolicitacao(1, { status: 'EM_ANALISE' })).status, 'EM_ANALISE');
});

test('422 mantém mensagem explicativa e erros por campo', async () => {
  const payload = { message: 'A transição de RECEBIDA para CONCLUIDA não é permitida.', errors: { status: ['Transição inválida.'] } };
  const api = createApiClient('/api/v1', async () => json(payload, 422));
  await assert.rejects(api.atualizarStatusSolicitacao(1, { status: 'CONCLUIDA' }), (error) => {
    errorWith('HTTP_ERROR', 422)(error);
    assert.equal(error.message, payload.message);
    assert.deepEqual(error.errors, payload.errors);
    return true;
  });
});

test('404 é padronizado mesmo quando o servidor retorna HTML', async () => {
  const api = createApiClient('/api/v1', async () => new Response('<html>Não encontrado</html>', { status: 404 }));
  await assert.rejects(api.detalharSolicitacao(1), errorWith('HTTP_ERROR', 404));
});

test('500 não propaga detalhes técnicos do servidor', async () => {
  const api = createApiClient('/api/v1', async () => json({ message: 'SQLSTATE DETALHE_INTERNO', errors: { database: ['DETALHE_INTERNO'] }, trace: 'DETALHE_INTERNO' }, 500));
  await assert.rejects(api.listarSolicitacoes(), (error) => {
    errorWith('HTTP_ERROR', 500)(error);
    assert.doesNotMatch(error.message, /DETALHE_INTERNO/);
    assert.deepEqual(error.errors, {});
    return true;
  });
});

test('health 200 preserva timestamp e desabilita cache', async () => {
  const health = { status: 'ok', database: 'connected', timestamp: solicitacao.data_criacao };
  const api = createApiClient('/api/v1', async (url, init) => {
    assert.equal(url, '/api/v1/health');
    assert.equal(init.cache, 'no-store');
    return json(health);
  });
  assert.deepEqual(await api.verificarSaude(), health);
});

test('health 503 vira ApiError preservando o estado de saúde', async () => {
  const health = { status: 'error', database: 'disconnected', timestamp: solicitacao.data_criacao };
  const api = createApiClient('/api/v1', async () => json(health, 503));
  await assert.rejects(api.verificarSaude(), (error) => {
    errorWith('HTTP_ERROR', 503)(error);
    assert.deepEqual(error.health, health);
    return true;
  });
});

test('erro de rede recebe status nulo e mensagem segura', async () => {
  const api = createApiClient('/api/v1', async () => { throw new TypeError('DETALHE_INTERNO'); });
  await assert.rejects(api.listarSolicitacoes(), errorWith('NETWORK_ERROR', null));
});

test('cancelamento propaga signal e retorna ABORTED', async () => {
  const controller = new AbortController();
  controller.abort();
  const api = createApiClient('/api/v1', async (_url, init) => {
    assert.equal(init.signal, controller.signal);
    throw new DOMException('Abortado', 'AbortError');
  });
  await assert.rejects(api.listarSolicitacoes({}, { signal: controller.signal }), errorWith('ABORTED', null));
});

test('200 com JSON malformado ou contrato incompatível é rejeitado', async () => {
  for (const body of ['<html>erro</html>', JSON.stringify({ data: { ...solicitacao, status: 'INVALIDO' } }), JSON.stringify({ data: null })]) {
    const api = createApiClient('/api/v1', async () => new Response(body));
    await assert.rejects(api.detalharSolicitacao(1), errorWith('INVALID_RESPONSE', 200));
  }
});

test('erros por campo fora do contrato não chegam ao consumidor', async () => {
  const api = createApiClient('/api/v1', async () => json({ message: 'Inválido', errors: { status: 123 } }, 422));
  await assert.rejects(api.listarSolicitacoes(), (error) => {
    errorWith('HTTP_ERROR', 422)(error);
    assert.deepEqual(error.errors, {});
    return true;
  });
});

test('IDs inválidos ou fora da precisão segura não são enviados', async () => {
  const api = createApiClient('/api/v1', async () => { assert.fail('Não deve fazer requisição'); });
  for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(api.detalharSolicitacao(id), errorWith('INVALID_REQUEST', null));
  }
});
