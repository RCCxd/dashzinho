# Migração do Dashboard do 2B — Vercel Hobby + TiDB Cloud Starter

**Decisão do proprietário:** usar somente Vercel Hobby + TiDB Cloud Starter, sem cartão, upgrade, billing, domínio pago ou GitHub. Esta decisão não significa que os serviços externos já foram criados. Até o momento não há cluster TiDB conectado, importação executada, deploy externo ou corte público.

## Limite da promessa “100% free”

A aplicação e as instruções foram preparadas para os planos gratuitos atuais; nenhum provedor pode garantir que seus termos e limites nunca mudarão. As quotas podem pausar o app quando atingidas. Antes de criar os serviços, confirme que o provedor ainda permite iniciar sem cartão. Se pedir cartão/pagamento, upgrade ou ativação de billing, **pare**. O Vercel Hobby é destinado a uso pessoal/não comercial; não usar para operação comercial/institucional sem verificar os termos atuais.

## Arquitetura implementada

- **Vercel:** `server.ts` exporta a aplicação Express, que a Vercel transforma em uma Node Function. Ela serve `/api/trpc`, `/api/health` e o fallback das rotas declaradas da SPA. O build `pnpm build:vercel` copia os assets do Vite para `public/**`; arquivos estáticos são servidos pelo CDN Vercel, não por `express.static()` dentro da Function. `vercel.json` inclui `public/**` no pacote para a Function poder devolver `index.html` nas rotas do cliente.
- **Região:** Vercel `iad1`; criar TiDB Starter na região AWS mais próxima compatível (`us-east-1`) para reduzir latência e alinhar a regra de firewall AWS.
- **Banco:** `DATABASE_URL` aponta ao endpoint público TiDB na porta `4000`; o app usa `DATABASE_TLS=true`, TLS mínimo 1.2, pool pequeno, conexões ociosas curtas e keep-alive TCP desligado.
- **Autenticação:** local por e-mail/senha, scrypt, sessões opacas em banco, CSRF double-submit e limites persistidos em `auth_rate_limits`. O cadastro público fica fechado (`ALLOW_PUBLIC_SIGNUP=false`) durante preparação; as contas novas sempre recebem papel `user`.
- **Bootstrap:** somente a conta legada já marcada `admin` pode ativar sua senha, uma vez, com segredo aleatório `ADMIN_BOOTSTRAP_CODE` (mínimo de 32 caracteres). A atualização condicional só funciona enquanto `passwordHash IS NULL`; depois da ativação, remover o segredo do ambiente.

## Estado conhecido dos dados de origem

Na última conferência, sem exibir PII, havia **1 conta admin**, **7 definições de conquista** e **7 linhas `user_achievements`**. Matérias, atividades, conclusões, sessões de estudo, notas e metas estavam vazias. O importador ainda verifica as contagens atuais; se a origem tiver mudado, revise o resultado antes de continuar. A base Manus não é apagada nem modificada pela cópia e deve permanecer disponível para rollback.

## Firewall e conexão

O endpoint público do Starter exige TLS; revisar suas regras de firewall antes de armazenar dados reais. Permita os clientes Vercel em AWS, e se a execução one-off da migração neste Sandbox não passar pelo acesso AWS, autorize o IP de saída do Sandbox **temporariamente** e remova essa regra ao terminar. Não deixar `0.0.0.0/0` aberto. A senha permanece em variável sensível do Vercel/ambiente, nunca no repositório, documentação ou chat.

## Sequência segura de execução

### 1. Provisionar manualmente os planos gratuitos

- Criar TiDB Cloud Starter na região AWS `us-east-1`, sem spending limit/upgrade.
- Criar ou selecionar um projeto Vercel Hobby e manter o domínio `*.vercel.app` gratuito.
- Se qualquer tela pedir cartão, pagamento ou plano pago, interromper.

### 2. Variáveis Preview e autenticação de CLI

No projeto Vercel, configurar para **Preview**:

- `DATABASE_URL` — DSN MySQL/TiDB da porta `4000`;
- `DATABASE_TLS=true`;
- `ALLOW_PUBLIC_SIGNUP=false`;
- `ADMIN_BOOTSTRAP_CODE` — segredo aleatório de pelo menos 32 caracteres (ex.: gerar localmente com `openssl rand -hex 32`).

No Sandbox do repositório, sem GitHub:

```bash
npx vercel login
npx vercel link
```

Não enviar o valor do banco ou código bootstrap por mensagem. Use o armazenamento de segredo do Vercel e mantenha `DATABASE_URL` fora de arquivos versionados.

### 3. Migrations e cópia

Com o projeto Vercel vinculado e as variáveis Preview já definidas, execute no Sandbox que ainda tem `DATABASE_URL` da origem Manus:

```bash
LEGACY_DATABASE_URL="$DATABASE_URL" npx vercel env run -e preview -- sh -c 'TARGET_DATABASE_URL="$DATABASE_URL" pnpm db:migrate:legacy'
```

O CLI fornece a DSN Preview somente ao processo filho. O comando não sobrescreve a DSN de origem do processo pai. O script:

1. valida que origem e destino são bancos diferentes e que o destino é TiDB na porta `4000`;
2. aplica migrations Drizzle **apenas no destino**, com TLS 1.2;
3. abre snapshot consistente somente-leitura da origem;
4. exige exatamente uma conta admin legada com `passwordHash` nulo, e catálogo de conquistas compatível;
5. exige tabelas de destino vazias (exceto catálogo seedado), valida as colunas e importa os registros preservando IDs em transação;
6. valida contagens, admin, sessões e rate limits no destino e só então faz commit;
7. não copia sessões/rate limits nem escreve/apaga linhas na origem.

O script cancela sem confirmar registros se houver divergência; as migrations aditivas do destino podem já ter sido aplicadas e podem ser repetidas. A migração só pode ser executada depois que o firewall permitir temporariamente o cliente de origem.

### 4. Deploy Preview e testes

```bash
pnpm check
pnpm test
pnpm build:vercel
npx vercel deploy
```

Testar `/api/health` (200 com DB; 503 sem DB), abertura direta de `/login`, `/activities`, `/subjects` e `/focus`, login/bootstrap admin, logout, cookie `Secure`, CSRF, cadastro de aluno desativado, papéis/permissões, Pomodoro e persistência. Se o banco não estiver acessível, corrigir TLS, credenciais, região e firewall; não abrir firewall globalmente.

### 5. Produção só após revisão

Depois do bootstrap, remover `ADMIN_BOOTSTRAP_CODE` de Preview e redeployar. `ALLOW_PUBLIC_SIGNUP` deve permanecer `false` em Preview. O proprietário revisa a URL Preview e os testes; **não fazer deploy `--prod`, abrir cadastros publicamente, mudar domínio/DNS ou cortar a aplicação de origem sem aprovação explícita separada**. Quando aprovado, configurar as variáveis de Production (com `ALLOW_PUBLIC_SIGNUP=true` para cadastro aberto de alunos) e executar deploy de produção.

Não há verificação de e-mail nem recuperação de senha no MVP; isso deve ser comunicado aos alunos. Dados criados depois do corte no TiDB não sincronizam de volta para Manus.

## Verificações realizadas no código

- `pnpm check`: aprovado.
- `pnpm test`: 7 testes aprovados.
- `pnpm build:vercel`: aprovado e assets staged em `public/`; alerta apenas sobre bundle JS acima de 500 kB.
- Bundle Node de `server.ts`: aliases TypeScript resolvidos pelo bundler local.
- Migration aditiva `0003_auth_rate_limits.sql`: criada e aplicada ao banco de desenvolvimento/origem sem alteração de dados de aplicação.
- O endpoint local atualmente não comprova a conectividade externa com TiDB; essa validação depende do cluster de destino, ainda não provisionado.
- Não foi feito deploy externo, cadastro de serviço, conexão de conta, pagamento, importação de dados, mudança DNS ou publicação de produção.

## Fontes oficiais consultadas

- [Vercel — Express on Vercel](https://vercel.com/docs/frameworks/backend/express): Express como Function e assets estáticos servidos pelo CDN.
- [Vercel — Environment variables CLI](https://vercel.com/docs/cli/env): `vercel env run` injeta variáveis no processo sem gravá-las em arquivo.
- [Vercel — Function regions](https://vercel.com/docs/functions/configuring-functions/region) e [Hobby](https://vercel.com/docs/plans/hobby): região e limites do plano.
- [TiDB Cloud — Select your plan](https://docs.pingcap.com/tidbcloud/select-cluster-tier/): quotas Starter e política de uso.
- [TiDB Cloud — TLS](https://docs.pingcap.com/tidbcloud/secure-connections-to-serverless-clusters/), [Node.js/mysql2](https://docs.pingcap.com/developer/dev-guide-sample-application-nodejs-mysql2/) e [firewall](https://docs.pingcap.com/tidbcloud/configure-serverless-firewall-rules-for-public-endpoints/).
- [TiDB Cloud — quotas e conexões](https://docs.pingcap.com/tidbcloud/serverless-limitations/) e [foreign keys](https://docs.pingcap.com/tidbcloud/foreign-key/).
