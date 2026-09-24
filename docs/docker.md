# Executar com Docker

Requisitos: Docker Engine/Desktop em execução e Docker Compose v2.

Na raiz do projeto:

```sh
cp .env.example .env
docker compose up --build -d --wait
```

Acesse **http://localhost:8080**. A API fica na mesma origem, em
`http://localhost:8080/api/v1`; a saúde do banco pode ser consultada em
`http://localhost:8080/api/v1/health`. Ajuste `FRONTEND_PORT` no `.env` se necessário.

## Serviços

- `frontend`: build com Node 24 e arquivos estáticos servidos pelo Nginx. O proxy
  `/api/` encaminha as chamadas ao backend sem exigir configuração de CORS.
- `backend`: PHP 8.4 com Apache, Composer, PDO PostgreSQL, OPcache, mbstring e XML.
  PHP 8.4 atende também às dependências do `composer.lock`. O diretório público
  é `backend/public`; o restante do código não é servido pelo Apache.
- `postgres`: PostgreSQL 16 com volume persistente `postgres_data`.

Somente o frontend publica uma porta, vinculada a `127.0.0.1`. Backend e banco
se comunicam pela rede interna do Compose, usando os nomes dos serviços.

## Inicialização

O Compose espera o healthcheck do PostgreSQL antes de criar o backend, conforme a
[documentação do Docker](https://docs.docker.com/compose/how-tos/startup-order/).
O entrypoint também testa uma consulta autenticada ao banco, com até 30 tentativas
separadas por dois segundos. Em seguida executa, nesta ordem:

```sh
php artisan migrate --force --no-interaction
php artisan db:seed --force --no-interaction
```

Qualquer falha interrompe a inicialização. O Apache só inicia depois dessas etapas;
o frontend aguarda o endpoint de saúde da API responder com sucesso.

O seed cria 20 solicitações fictícias com protocolos fixos. Reiniciar o backend
não duplica esses registros nem sobrescreve alterações feitas pelo usuário.
Registros de demonstração removidos são recriados no próximo seed. Registros
criados por versões anteriores do seed, com protocolos aleatórios, são preservados.

A imagem inclui dependências Composer de desenvolvimento porque o seeder atual
usa factories e Faker. Essa configuração destina-se à demonstração local.

## Ambiente e persistência

O `.env.example` contém somente valores fictícios para uso local. O Compose injeta
as variáveis do Laravel; não é necessário criar `backend/.env`. O banco usa
`DB_HOST=postgres`, `DB_PORT=5432` e `DB_CONNECTION=pgsql` internamente.

Com `APP_KEY` vazia, o entrypoint gera uma chave em memória a cada inicialização.
Para manter a chave entre recriações, gere-a e copie o resultado para `APP_KEY`
no `.env` (arquivo ignorado pelo Git):

```sh
docker compose exec backend php artisan key:generate --show
```

O banco permanece no volume após `docker compose down`. Alterar usuário, senha ou
nome do banco no `.env` não modifica um volume PostgreSQL já inicializado.

## Operação e validação

```sh
docker compose ps
docker compose logs backend
curl --fail http://localhost:8080/api/v1/health
docker compose exec backend php artisan migrate:status
docker compose restart backend
docker compose down
```

Para reconstruir após alterações no código, execute novamente
`docker compose up --build -d --wait`. Os containers usam código copiado para a
imagem, sem montagem do diretório local.

## Validação realizada

A configuração passou em `docker compose --env-file .env.example config --quiet`,
na verificação de sintaxe PHP/shell e no build do frontend. A suíte Laravel passou
com 50 testes e 351 assertions usando PostgreSQL local isolado, incluindo a
idempotência do seed e a preservação de alterações. A consulta do script de espera
também foi validada nesse banco.

A execução completa dos containers ficou pendente: duas tentativas de baixar
`postgres:16-alpine` falharam com `TLS handshake timeout` no Docker Hub. Portanto,
o build das imagens e a integração via Apache/Nginx ainda precisam ser verificados
com o comando de inicialização acima quando o registry estiver acessível.
