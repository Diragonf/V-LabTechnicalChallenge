# Integração contínua

O workflow `.github/workflows/ci.yml` executa em todo `push` e `pull_request`,
sem filtros de branch ou caminho. Os jobs são independentes e usam permissões
somente de leitura do repositório.

- **Backend:** PHP 8.4, dependências do `composer.lock`, Pint e PHPUnit.
  Um serviço PostgreSQL 16 fornece o banco descartável `vlab_testing`, com
  healthcheck antes dos testes. As credenciais fictícias existem apenas no runner;
  não é necessário configurar secrets. Os testes `RefreshDatabase` executam as migrations.
- **Frontend:** Node 24, `npm ci`, TypeScript (`tsc --noEmit`), ESLint 10,
  Vitest e testes do cliente de API. O cache npm usa `package-lock.json`.

Comandos equivalentes locais:

```sh
# Na raiz
npm ci
npm run typecheck
npm run lint
npm run test:components
npm run test:api

# Em backend/, com banco isolado de testes configurado conforme docs/api.md
composer install
composer lint
composer test
```

Para corrigir automaticamente o estilo PHP, execute `composer lint:fix` em
`backend/`. O CI usa `composer lint`, que apenas verifica e falha em divergências.

Configuração ESLint baseada nas regras recomendadas do
[typescript-eslint](https://typescript-eslint.io/getting-started/).
