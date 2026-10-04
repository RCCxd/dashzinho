# Dashboard do 2B

Aplicativo escolar responsivo para matérias, atividades, estudo Pomodoro, conquistas, metas semanais e notas pessoais. O destino escolhido é **Vercel Hobby + TiDB Cloud Starter**, exclusivamente dentro das condições e cotas gratuitas. O app externo usa login local por e-mail/senha e não depende do Manus para autenticar ou servir a aplicação.

> “100% gratuito” depende de os provedores manterem seus planos e do uso ficar dentro das cotas. Não adicionar cartão, ativar billing, comprar domínio nem fazer upgrade. Se um provedor pedir pagamento/cartão ou alterar as condições, pare antes de prosseguir.

## Stack e arquitetura externa

- React + TypeScript + Vite + Tailwind CSS.
- Express + tRPC, exportados como aplicação Express em `server.ts`, reconhecida pela Vercel como uma única Function Node.
- O script `pnpm build:vercel` compila Vite e copia os assets para `public/`, servidos pelo CDN da Vercel. A Function trata `/api/trpc`, `/api/health` e as rotas da SPA.
- Drizzle ORM + TiDB Cloud Starter (compatível com MySQL), TLS 1.2+, pool curto por instância serverless e região Vercel `iad1`.
- Autenticação local: hash scrypt, sessões opacas persistidas por SHA-256, cookie seguro, proteção CSRF double-submit e rate limits compartilhados no banco.
- Tema escuro permanente; PWA com manifesto, ícones, service worker e tela offline.

## Desenvolvimento local

```bash
pnpm install --frozen-lockfile
cp .env.example .env
# Ajuste DATABASE_URL para um MySQL/TiDB de desenvolvimento seu.
pnpm db:migrate
pnpm dev
```

O servidor local usa `PORT` (padrão `3000`). `GET /api/health` retorna `200` somente quando uma consulta SQL funciona; sem banco acessível retorna `503`. `INSECURE_LOCAL_COOKIES=true` só tem efeito em `NODE_ENV=development` com hostname localhost; cookies públicos permanecem `Secure; SameSite=None`.

## Autenticação

- A conta existente marcada `role=admin` pode definir sua primeira senha uma única vez usando `ADMIN_BOOTSTRAP_CODE`, com pelo menos 32 caracteres aleatórios.
- Cadastros novos recebem sempre papel `user` (aluno). `ALLOW_PUBLIC_SIGNUP=false` por padrão, durante a preparação/importação; habilite-o somente para Production depois dos testes.
- A tela permite selecionar explicitamente **“Tenho um código de administrador”**, mesmo com cadastro de aluno fechado.
- O MVP não tem verificação de e-mail nem recuperação de senha. Escolha um e-mail ao qual o aluno mantenha acesso e guarde a senha com segurança.

## Provisionamento e migração

1. Crie uma instância **TiDB Cloud Starter**, região AWS `us-east-1` para ficar próxima da Function Vercel `iad1`, e mantenha-a no plano Starter. Nunca habilite spending limit ou upgrade. Revise o firewall: permita tráfego AWS para o deploy e, se a migração feita pelo Sandbox Manus for bloqueada, adicione seu IP de saída apenas temporariamente; não deixe `0.0.0.0/0` aberto.
2. No projeto Vercel, configure as variáveis de **Preview** (e, mais tarde, Production):
   - `DATABASE_URL`: DSN MySQL do TiDB, com endpoint público e porta `4000`;
   - `DATABASE_TLS=true`;
   - `ALLOW_PUBLIC_SIGNUP=false` durante importação/bootstrap;
   - `ADMIN_BOOTSTRAP_CODE`: segredo aleatório de 32+ caracteres, somente no ambiente Preview inicial.
3. Autentique o CLI e vincule um projeto **sem conectar GitHub**:

   ```bash
   npx vercel login
   npx vercel link
   ```

4. A partir do Sandbox que ainda possui a conexão da base de origem Manus e com o Preview vinculado, aplique migrations no destino e transfira os dados. O segredo `DATABASE_URL` de Preview é passado em memória pelo CLI; não use `source` em arquivos de ambiente, não o imprima e não o envie pelo chat:

   ```bash
   LEGACY_DATABASE_URL="$DATABASE_URL" npx vercel env run -e preview -- sh -c 'TARGET_DATABASE_URL="$DATABASE_URL" pnpm db:migrate:legacy'
   ```

   O importador (`scripts/migrate-legacy-mysql.ts`) força TLS 1.2 e porta 4000 para TiDB, aplica migrations Drizzle **somente no destino**, lê a origem em snapshot consistente somente-leitura, copia dados em uma transação e valida contagens/catalogação. Não copia sessões nem rate limits; não modifica nem exclui a origem. Ele cancela se a origem não tiver exatamente uma conta admin elegível, se o destino já contiver dados ou se as validações divergirem.

5. Faça um deploy **Preview** para testar:

   ```bash
   pnpm build:vercel
   npx vercel deploy
   ```

   Verifique `/api/health`, a tela de login, que o cadastro de alunos está fechado, o bootstrap/admin, login/logout, CSRF, permissões e carregamento direto de rotas como `/activities` e `/focus`.
6. Depois que a senha admin estiver criada, remova `ADMIN_BOOTSTRAP_CODE` de Preview e redeploye. Só quando o proprietário revisar e aprovar a abertura pública, defina `ALLOW_PUBLIC_SIGNUP=true` **em Production** e faça deploy de produção. O comando `npx vercel deploy --prod` não faz parte desta preparação e exige aprovação explícita separada.

## Limites gratuitos e operação

- **Vercel Hobby:** plano gratuito sujeito a quotas e destinado a uso pessoal/não comercial. Atingir limites pode pausar o serviço até o reset. Não habilitar Pro/billing.
- **TiDB Cloud Starter:** o plano atual documenta cotas de armazenamento e Request Units; ao exceder a quota, novas conexões podem ser negadas até o reset. Não habilitar billing.
- Use apenas `*.vercel.app`; não compre domínio. O endpoint TiDB é público e exige credenciais fortes, TLS e firewall restrito.
- A migração é de sentido único: a base Manus permanece intacta como referência/rollback, mas dados escritos depois do corte no TiDB não voltam automaticamente para ela.

## Verificações feitas e estado

```bash
pnpm check
pnpm test
pnpm build
pnpm build:vercel
```

A checagem TypeScript, os 7 testes Vitest e o build estático para Vercel passaram. O build de Vite informa apenas um aviso não bloqueante sobre bundle JavaScript acima de 500 kB. Ainda faltam contas/serviços externos, conexão real ao TiDB, importação de dados e validação em Preview; nenhum deploy externo de produção ou corte foi feito.

Documentação: [requisitos](docs/requirements.md) · [design](docs/design.md) · [tarefas](docs/tasks.md) · [esquema SQL](docs/sql-schema.md) · [plano de migração](docs/migration-out-of-manus.md)
