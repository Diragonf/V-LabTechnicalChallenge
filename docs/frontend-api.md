# Cliente TypeScript

Os tipos estão em `src/types/solicitacao.ts`; o cliente Fetch está em `src/services/api.ts`. Não há dependências de execução externas nem necessidade de inicializar React para usar o cliente.

```ts
import { api, ApiError, createApiClient } from '../src/services/api.ts';

try {
  const pagina = await api.listarSolicitacoes({ prioridade: 'ALTA', page: 1, per_page: 15 });
  console.log(pagina.data, pagina.meta.total);
} catch (error: unknown) {
  if (error instanceof ApiError) {
    console.log(error.message, error.status, error.errors);
  }
}

// Para backend em outra origem, forneça a URL pública da API.
const backend = createApiClient('http://localhost:8000/api/v1');
await backend.verificarSaude();
```

O cliente padrão usa `/api/v1` na mesma origem. Em desenvolvimento com frontend separado, configure proxy para o backend ou use uma URL base e configure CORS no backend. Nenhum segredo deve ser incluído nessa URL.

Métodos: `criarSolicitacao`, `listarSolicitacoes`, `detalharSolicitacao`, `atualizarStatusSolicitacao`, `verificarSaude`. Criação, detalhe e atualização devolvem diretamente `Solicitacao`; listagem preserva `data`, `links` e `meta`. Todos aceitam uma opção final `{ signal }` para cancelamento por `AbortController`.

`ApiError` fornece `message`, `status` (null quando não existe resposta HTTP), `code` e `errors`. Em 422, mantém os erros de validação por campo. Respostas 5xx usam mensagens genéricas. Health 503 lança `ApiError` com o estado retornado em `health`. HTML, JSON inválido e contratos de sucesso incompatíveis são rejeitados; o cliente não repete automaticamente operações de escrita.

O DTO de criação exige justificativa quando a prioridade é URGENTE. A validação de conteúdo não vazio continua sendo feita pelo backend. Datas permanecem como strings ISO 8601. Como o contrato atual transmite IDs bigint como números JSON, o cliente rejeita IDs além de `Number.MAX_SAFE_INTEGER` para evitar acessar um registro com ID arredondado; suporte ao intervalo completo exigiria IDs como strings no contrato do backend.

## Verificação

Com Node.js 24 ou superior:

```sh
npm ci
npm run typecheck
npm test
```

Os testes usam Fetch simulado e cobrem requisições, filtros, paginação, erros HTTP, rede, cancelamento e health check. Não substituem uma integração de navegador com backend/proxy/CORS configurados.

## Interface React

```sh
npm ci
npm run dev
npm run build
npm test
```

O Vite disponibiliza o frontend em `http://localhost:5173`. Em desenvolvimento, `/api` é encaminhado para `http://127.0.0.1:8000` (configuração em `vite.config.ts`); execute o backend Laravel separadamente nessa origem. A aplicação não substitui falhas de API por dados de demonstração: exibe o erro e permite nova tentativa. Em produção, configure o servidor para encaminhar `/api` ao backend; o proxy do Vite só atua em desenvolvimento.

- `DashboardSummary`: cartões de total, status e prioridade. Usa `meta.total` em dez consultas pequenas, sem contar apenas os itens da página. As contagens são globais e independentes dos filtros da lista. Como não existe endpoint agregado no contrato atual, as consultas não representam um snapshot transacional quando ocorrem alterações simultâneas.
- `SolicitacoesList`: filtros combinados, dez itens por página, reinício na página 1 ao alterar filtros e callback `onSelect(id)` para abrir detalhes.
- `SolicitacaoForm`: validação durante edição, justificativa condicional para URGENTE, erros 422 junto aos campos, preservação dos valores em falhas e bloqueio de envios duplicados. `onCreated` notifica o cadastro.
- `SolicitacaoDetailsModal`: `dialog` nativo com foco modal, Escape, restauração do foco, descrição completa e apenas ações permitidas. Estados finais não oferecem transições. Durante uma atualização, ações e fechamento ficam bloqueados. Um conflito 422 recarrega o registro e preserva o aviso de erro. `onUpdated` notifica a alteração.

`App` conecta os callbacks para atualizar lista e indicadores após cada gravação. As leituras usam AbortController e descartam respostas de consultas antigas. Os quatro estados têm apresentação explícita: loading com indicador, success com dados/confirmação, empty com orientação e error com mensagem. Formulários usam o estado vazio antes do primeiro envio; o detalhe usa vazio para solicitação inexistente.

Os estilos são CSS Modules, com grades adaptáveis e tabela em região de rolagem própria em telas estreitas. Há rótulos associados, mensagens de erro via `aria-describedby`, avisos de estado, foco visível, link para pular ao conteúdo e respeito à preferência de movimento reduzido.

Verificação realizada: build de produção, TypeScript estrito sem `any`, 14 testes do cliente Fetch e 17 testes de componentes. Os testes de componentes usam jsdom (incluindo substituto de `showModal`); a revisão visual e do foco nativo em navegador real permanece pendente, pois não havia navegador conectado na sessão.
