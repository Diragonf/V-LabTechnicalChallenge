# V-Lab — Gestão de Solicitações

Aplicação do desafio técnico V-Lab para cadastrar e acompanhar solicitações fictícias de atendimento. Combina uma API REST Laravel, interface React com TypeScript e persistência em PostgreSQL.

A interface oferece indicadores globais, listagem paginada com filtros, formulário de cadastro e modal de detalhes com alteração de status. As telas apresentam estados de carregamento, sucesso, ausência de dados e erro.

## Tecnologias e versões

As versões de bibliotecas abaixo correspondem aos lockfiles do repositório. As imagens Docker usam as tags indicadas, sem fixar uma versão patch.

| Tecnologia | Versão utilizada | Finalidade |
| --- | --- | --- |
| React / React DOM | 19.3.0 | Interface e componentes |
| TypeScript | 5.9.3 | Tipagem estrita do frontend e do cliente REST |
| Node.js | 24 no Docker e no CI | Instalação, build e testes do frontend |
| Vite | 8.3.0 | Desenvolvimento e build estático |
| PHP | 8.4 no Docker e no CI | Execução da API; atende às dependências travadas |
| Laravel | 13.33.0 | API REST, validação e persistência |
| PostgreSQL | 16 (`postgres:16-alpine`) | Banco relacional |
| Docker Compose | v2 | Orquestração dos três serviços |
| Apache | Incluído em `php:8.4-apache` | Servidor HTTP da API |
| Nginx | `stable-alpine` | Arquivos estáticos e proxy da API |
| Composer | 2 | Dependências PHP |
| PHPUnit / Laravel Pint | 12.5.35 / 1.32.1 | Testes e estilo PHP |
| Vitest / React Testing Library | 5.0.1 / 16.3.3 | Testes de componentes |
| ESLint | 10.11.0 | Análise estática do frontend |

Fontes: [package-lock.json](package-lock.json), [composer.lock](backend/composer.lock), [Dockerfile do frontend](Dockerfile), [Dockerfile do backend](backend/Dockerfile) e [Compose](docker-compose.yml).

## Guia de execução com Docker Compose

### 1. Pré-requisitos

- Git, para obter o repositório, ou uma cópia local do código.
- Docker Desktop ou Docker Engine em execução, com Docker Compose v2.
- Acesso à internet na primeira execução para baixar imagens e dependências.
- Porta local `8080` disponível.

Não é necessário instalar PHP, Composer, Node.js ou PostgreSQL no host para executar a aplicação com Docker.

### 2. Abra o diretório do projeto

Após clonar ou extrair o repositório, abra um terminal na raiz, onde está o arquivo `docker-compose.yml`:

```sh
cd V-LabTechnicalChallenge
```

### 3. Inicie a aplicação com um comando

```sh
docker-compose up --build
```

Esse comando pressupõe que o executável `docker-compose` disponibiliza Compose v2. Se sua instalação expõe apenas o plugin integrado ao Docker, use a forma equivalente:

```sh
docker compose up --build
```

Não é necessário criar um `.env` para a primeira execução: o Compose já fornece valores padrão de demonstração. Também não é necessário executar migrations ou seeds manualmente.

Durante a inicialização:

1. O Docker constrói a API com PHP, extensões `pdo_pgsql`, OPcache, mbstring e XML, além das dependências Composer.
2. O frontend é compilado com Node/Vite e seus arquivos estáticos são copiados para o Nginx.
3. O PostgreSQL inicia com armazenamento em volume persistente e passa pelo healthcheck.
4. O entrypoint do backend aguarda uma consulta autenticada ao banco responder e executa `php artisan migrate --force --no-interaction` e `php artisan db:seed --force --no-interaction`.
5. O Apache inicia a API. O frontend aguarda a API ficar saudável antes de iniciar.

O terminal permanece mostrando os logs. Para executar em segundo plano e aguardar os healthchecks, use `docker compose up --build -d --wait`.

### 4. Acesse a aplicação

| Recurso | Endereço |
| --- | --- |
| Interface React | http://localhost:8080 |
| Listagem REST | http://localhost:8080/api/v1/solicitacoes |
| Saúde da API e conexão com banco | http://localhost:8080/api/v1/health |

O seed cria 20 registros fictícios, cobrindo todas as combinações de prioridade e status. A prioridade `URGENTE` exige justificativa. O seed utiliza protocolos fixos: reinicializações não duplicam os registros nem sobrescrevem alterações feitas pelo usuário. Registros de demonstração removidos são recriados no próximo seed.

### 5. Configuração opcional

Para personalizar o ambiente, copie o exemplo antes de iniciar:

```sh
cp .env.example .env
```

| Variável | Padrão | Uso |
| --- | --- | --- |
| `FRONTEND_PORT` | `8080` | Porta HTTP no host |
| `DB_DATABASE` | `vlab` | Banco da aplicação |
| `DB_USERNAME` | `vlab` | Usuário local de demonstração |
| `DB_PASSWORD` | `vlab_local_only` | Senha fictícia para o ambiente local |
| `APP_KEY` | Vazia | O entrypoint gera uma chave em memória quando não informada |

O Compose define internamente `DB_HOST=postgres`, `DB_PORT=5432` e `DB_CONNECTION=pgsql`. Não é necessário criar `backend/.env`. Somente o frontend publica uma porta, vinculada a `127.0.0.1`; API e PostgreSQL usam a rede interna.

Para preservar a chave da aplicação entre recriações, execute `docker compose exec backend php artisan key:generate --show` e copie o resultado para `APP_KEY` no `.env`. Esse arquivo é ignorado pelo Git. Os valores do exemplo são exclusivos de demonstração local.

### 6. Logs, parada e persistência

```sh
docker compose ps
docker compose logs -f backend
docker compose exec backend php artisan migrate:status
docker compose down
```

`Ctrl+C` encerra a execução em primeiro plano. `docker compose down` remove os containers e a rede, preservando o volume `postgres_data`. Não use `down -v` se quiser manter os dados. Alterar credenciais no `.env` não reconfigura um volume PostgreSQL já inicializado.

Após mudar o código, execute novamente o comando com `--build`: as imagens contêm uma cópia do código, sem montagem local ou hot reload.

Se houver `TLS handshake timeout` no Docker Hub, confira a conectividade do Docker com o registry e repita o comando. Para falhas de inicialização da API, consulte `docker compose logs backend postgres`. Mais detalhes em [docs/docker.md](docs/docker.md).

## Decisões arquiteturais

### Backend: Controllers, FormRequests e Services

O fluxo de uma operação é: **rota → FormRequest → Controller → Service → Eloquent/PostgreSQL → Resource JSON**.

- **FormRequests** validam campos obrigatórios, enums, limites, justificativa de urgência, filtros e paginação. Campos desconhecidos são rejeitados; o Controller recebe apenas dados validados.
- **Controllers** coordenam a requisição HTTP, injetam o serviço e escolhem a resposta. Regras de negócio ficam fora dessa camada.
- **Services** concentram geração do protocolo, persistência, filtros e transições de status. A atualização de status usa transação e `lockForUpdate`, mantendo leitura e alteração sob o mesmo bloqueio. A regra de justificativa urgente também é protegida no serviço.
- **Resources** definem o contrato JSON. Middleware e tratamento centralizado de exceções padronizam erros e evitam expor detalhes internos.

Essa separação permite testar regras de negócio sem HTTP e verificar validação, respostas e persistência em testes funcionais. Não há uma camada Repository adicional: o serviço usa Eloquent diretamente, mantendo a estrutura adequada ao tamanho do desafio.

As transições permitidas são:

| Estado atual | Próximos estados |
| --- | --- |
| `RECEBIDA` | `EM_ANALISE`, `CANCELADA` |
| `EM_ANALISE` | `AGENDADA`, `CANCELADA` |
| `AGENDADA` | `CONCLUIDA`, `CANCELADA` |
| `CONCLUIDA` / `CANCELADA` | Nenhum |

### Desacoplamento REST

O frontend se comunica exclusivamente por HTTP/JSON em `/api/v1`. Não acessa o banco nem depende de templates Laravel. A API pode ser consumida por outros clientes que respeitem o contrato OpenAPI.

No Docker, o Nginx serve o React e encaminha `/api/` ao backend, mantendo a mesma origem no navegador. O cliente Fetch centraliza requisições, cancelamento com `AbortController`, interpretação de respostas e erros tipados. Falhas reais da API são mostradas ao usuário, sem substituição por dados simulados.

### Tipagem e organização no React

O TypeScript está em modo estrito. Tipos de domínio, DTOs e respostas paginadas ficam em [src/types/solicitacao.ts](src/types/solicitacao.ts); o acesso HTTP fica em [src/services/api.ts](src/services/api.ts).

O DTO de criação usa uma união discriminada: `URGENTE` exige `justificativa_prioridade` em tempo de compilação. Como tipos TypeScript não validam dados recebidos pela rede, o cliente também verifica o formato das respostas em tempo de execução. A validação definitiva das entradas permanece no backend.

Os componentes dividem as responsabilidades entre indicadores, listagem, cadastro e detalhes. Hooks controlam operações assíncronas e descartam respostas antigas; callbacks notificam alterações para atualizar lista e indicadores. CSS Modules isolam estilos. A interface usa rótulos associados, mensagens por campo e feedback acessível de estado.

Os indicadores usam os totais de consultas paginadas, pois o contrato atual não inclui endpoint agregado; essas consultas não constituem um snapshot transacional único.

## Estrutura do repositório

```text
.github/workflows/ci.yml     # Integração contínua
backend/
  app/Http/                 # Controllers, FormRequests, middleware e Resources
  app/Services/             # Regras de negócio e saúde do banco
  database/                 # Migrations, factories e seeders
  docker/                   # Apache, PHP e scripts de inicialização
  public/index.php          # Entrada HTTP do Laravel
  tests/                    # PHPUnit: Unit e Feature
  Dockerfile
src/
  components/               # Interface React
  domain/                   # Validação e regras de apresentação
  hooks/                    # Controle assíncrono
  services/api.ts           # Cliente REST
  types/                    # Tipos e DTOs
tests/                      # Testes frontend
docs/                       # OpenAPI e documentação complementar
docker/nginx.conf           # Servidor estático e proxy
Dockerfile                  # Build e imagem do frontend
docker-compose.yml          # frontend, backend e postgres
.env.example                # Configuração local sem segredos reais
```

## Especificação OpenAPI

O contrato OpenAPI 3.0.3 está em **[docs/openapi.yaml](docs/openapi.yaml)**. Ele descreve schemas, exemplos, filtros, paginação, erros e respostas de saúde. Pode ser aberto em uma ferramenta compatível com OpenAPI; não há interface Swagger hospedada pela aplicação.

| Método | Rota | Operação |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Verificar conexão com PostgreSQL |
| `GET` | `/api/v1/solicitacoes` | Listar com filtros e paginação |
| `POST` | `/api/v1/solicitacoes` | Cadastrar solicitação |
| `GET` | `/api/v1/solicitacoes/{id}` | Consultar detalhes |
| `PATCH` | `/api/v1/solicitacoes/{id}/status` | Alterar status |

As escritas exigem `Content-Type: application/json`. A listagem retorna `data`, `links` e `meta`; erros de validação retornam HTTP 422. O healthcheck possui envelope próprio e retorna 503 quando o banco está indisponível.

## Testes e qualidade

### Backend no Docker

Com a stack iniciada, crie um banco separado para testes **uma única vez**:

```sh
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" vlab_testing'
```

Execute a suíte usando explicitamente esse banco:

```sh
docker compose exec -e APP_ENV=testing -e DB_DATABASE=vlab_testing backend composer test
docker compose exec backend composer lint
```

`RefreshDatabase` recria tabelas. O override `DB_DATABASE=vlab_testing` é necessário porque o container normalmente recebe o banco da aplicação pelo ambiente. Nunca execute os testes funcionais no banco com dados que deseja preservar. Se `vlab_testing` já existir, pule sua criação.

### Backend local

Com PHP 8.4+, Composer 2, as extensões do Dockerfile e PostgreSQL disponíveis:

```sh
cd backend
composer install
composer lint
composer test:unit
```

Os testes unitários não precisam de banco. Para os funcionais, crie um banco isolado `vlab_testing` e configure `backend/.env.testing` com `APP_ENV=testing`, `DB_CONNECTION=pgsql`, host, porta e credenciais locais, conforme [docs/api.md](docs/api.md). Em seguida:

```sh
composer test:feature
composer test
```

A suíte cobre validação, transições de status, criação, filtros, paginação, erros HTTP, healthcheck e seed idempotente. Para aplicar correções de estilo: `composer lint:fix`.

### Frontend

Na raiz, com Node.js 24 e npm:

```sh
npm ci
npm run typecheck
npm run lint
npm run test:components
npm run test:api
npm run build
```

`npm test` executa as duas suítes de frontend. O Vitest roda com React Testing Library e jsdom, incluindo justificativa condicional, erros de carregamento e preenchimento/envio com mock da API. Os testes do cliente Fetch usam o executor nativo do Node e verificam contratos e tratamento de falhas. Essas suítes não exigem o backend em execução.

A imagem final do frontend contém apenas Nginx e arquivos estáticos; os comandos de testes devem ser executados no ambiente Node, não nesse container.

### GitHub Actions

O workflow [ci.yml](.github/workflows/ci.yml) executa em todo push e pull request:

- **Backend:** PHP 8.4, instalação Composer, Pint e PHPUnit, com PostgreSQL 16 descartável.
- **Frontend:** Node 24, `npm ci`, TypeScript, ESLint, Vitest e testes do cliente REST.

Veja [docs/ci.md](docs/ci.md) para os comandos equivalentes.

### Validação realizada e limites

- 50 testes Laravel aprovados, com 351 assertions, em PostgreSQL local isolado.
- 22 testes de componentes e 14 testes do cliente REST aprovados.
- Pint, ESLint, TypeScript e build React aprovados.
- Configuração Compose, sintaxe PHP/shell e YAML do workflow verificadas.

A execução local do PHPUnit utilizou PHP 8.5.10 e PostgreSQL 18. O ambiente definido para Docker/CI usa PHP 8.4 e PostgreSQL 16. A execução completa dos containers ficou pendente por timeout TLS no download das imagens do Docker Hub; a integração via Apache/Nginx ainda precisa ser validada. A execução do workflow no GitHub depende do envio ao repositório. A revisão visual em navegador real também permanece pendente; jsdom não substitui essa verificação.

O projeto é uma demonstração com dados fictícios, sem autenticação nesta etapa. A imagem da API inclui dependências de desenvolvimento porque o seeder utiliza Faker e factories.

## Política de uso de IA

O **OpenAI Codex** foi utilizado como ferramenta de apoio à estruturação do projeto, elaboração e escrita de código, criação de testes, configuração de Docker e GitHub Actions e redação da documentação. A colaboração ocorreu a partir de requisitos e orientações fornecidos pelo responsável pelo projeto, com execução de verificações automatizadas e registro das limitações encontradas.

O uso de IA faz parte declarada do processo de desenvolvimento. Código sugerido ou produzido com esse auxílio continua sujeito à revisão, aos testes e à responsabilidade técnica de quem entrega a solução. Os resultados de validação descritos acima distinguem o que foi executado do que ainda está pendente.

**Declaração do responsável pela entrega:** “Declaro domínio total da solução entregue e assumo responsabilidade por suas decisões arquiteturais, regras de negócio, implementação e testes. Estou apto a explicar, reproduzir, depurar e modificar seus componentes, incluindo o código elaborado com auxílio do OpenAI Codex.”

## Documentação complementar

- [API, regras e testes backend](docs/api.md)
- [Contrato OpenAPI](docs/openapi.yaml)
- [Cliente TypeScript e componentes React](docs/frontend-api.md)
- [Infraestrutura Docker](docs/docker.md)
- [Integração contínua](docs/ci.md)
