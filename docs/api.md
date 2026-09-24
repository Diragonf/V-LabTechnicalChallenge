# API de solicitações

Contrato: [openapi.yaml](openapi.yaml). Todos os exemplos e testes usam dados fictícios.

A estrutura adicionada utiliza o bootstrap moderno do Laravel (11 ou superior). O repositório ainda não contém a instalação completa do framework, `composer.json`, `vendor`, `artisan` nem a configuração de conexão com PostgreSQL. Os arquivos não constituem, isoladamente, uma aplicação executável.

## Responsabilidades

- Requests: validação dos campos, enums, limites e rejeição de campos desconhecidos. O Request de listagem valida filtros e paginação.
- Controller: injeta o serviço e encaminha entradas validadas para ele; Resources definem as respostas.
- Service: persistência, filtros, paginação, protocolo e máquina de estados. A atualização mantém a leitura e a escrita na mesma transação, com bloqueio da linha.
- Middleware: exige objetos JSON válidos nas operações de escrita (400 para JSON inválido, 415 para Content-Type incorreto).
- Bootstrap: erros JSON com `message` e `errors` (objeto vazio fora da validação); transição proibida retorna 400, validação 422, ausência 404 e falhas internas 500. Detalhes internos não são enviados, mesmo com debug ativado.

A paginação usa `page` (padrão 1) e `per_page` (padrão 15, máximo 100). Filtros `status`, `categoria` e `prioridade` são combinados com AND. A ordenação é por ID decrescente. A resposta contém `data`, `links` e `meta`.

## Testes

Após instalar o Laravel e configurar o autoload PSR-4 `App\` → `app/` e `Tests\` → `tests/`, execute em `backend/`:

```sh
vendor/bin/phpunit --testsuite Feature
```

Configure a conexão local em `.env.testing`, sem versionar credenciais. Use exclusivamente um banco PostgreSQL isolado para testes (`vlab_testing` no `phpunit.xml`): `RefreshDatabase` recria as tabelas. Credenciais devem vir do ambiente local. Não há credenciais nos arquivos deste repositório.

A suíte cobre criação, unicidade dos protocolos gerados, prioridade urgente, campos indevidos, todas as 25 combinações de status, filtros, paginação, IDs inválidos, JSON malformado e ocultação de erros internos. Não substitui um teste de carga/concorrência nem força colisões de protocolo.

## Dados fictícios para demonstração

A factory usa Faker para compor nomes explicitamente marcados como fictícios e descrições de cenários simulados, sem documentos, contatos ou dados reais de pacientes. Depende de `fakerphp/faker` e do autoload PSR-4 padrão do Laravel: `Database\Factories\` → `database/factories/` e `Database\Seeders\` → `database/seeders/`.

Após instalar o framework e configurar o PostgreSQL, execute em `backend/`:

```sh
php artisan migrate
php artisan db:seed
# Alternativa: executar apenas o seeder de solicitações
php artisan db:seed --class=SolicitacaoSeeder
```

Cada execução adiciona 20 registros sem apagar os existentes. O conjunto cobre as quatro categorias e todas as combinações entre prioridade e status. Os cinco registros urgentes sempre possuem justificativa. Os estados finais são fixtures de teste inseridas diretamente pela factory; as alterações via API continuam sujeitas à máquina de estados do serviço.

## Health check

`GET /api/v1/health` executa `SELECT 1` na conexão `pgsql`, no servidor de escrita, sem depender das tabelas da aplicação. Retorna `Cache-Control: no-store` e timestamp UTC:

```json
{"status":"ok","database":"connected","timestamp":"2026-09-23T12:00:00.000000Z"}
```

Se a conexão ou consulta falhar, retorna HTTP 503 com o mesmo formato, `status: "error"` e `database: "disconnected"`, sem mensagem técnica. Este endpoint possui contrato próprio, diferente do envelope de erros dos endpoints de solicitações.

Os testes adicionais verificam cobertura e integridade do seeder, factory urgente, consulta real ao PostgreSQL e falhas simuladas do health check.
