# Design — Dashboard do 2B

## Arquitetura externa

O cliente React/Vite é compilado para `public/**` e servido pelo CDN da Vercel. `server.ts` exporta uma aplicação Express; a Vercel a executa como uma Node Function para tRPC, health check e fallback da SPA. `server/_core/app.ts` contém middlewares e rotas, e `server/_core/index.ts` continua sendo o servidor do Preview/desenvolvimento local. Drizzle conecta ao TiDB Cloud Starter, compatível com MySQL, via TLS 1.2+.

```text
Navegador ── CDN Vercel: public/** (HTML, assets, PWA)
    │
    └── Function Express em iad1
          ├── /api/trpc ── autorização por papel
          ├── /api/health ── SELECT 1
          ├── auth_sessions ── TiDB
          ├── auth_rate_limits ── TiDB
          └── serviços ── Drizzle ── dados do Dashboard
```

A migration `0003_auth_rate_limits.sql` persiste limites de tentativa entre instâncias. O pool é pequeno, reutilizado por instância, usa idle timeout curto e desliga TCP keep-alive para o endpoint Starter.

## Limites de autorização

- `protectedProcedure` exige sessão e usuário persistido; `adminProcedure` exige também `role === 'admin'`.
- Procedures pessoais ignoram `userId` recebido do cliente e usam `ctx.user.id`.
- Consultas de dashboard agregam conclusões/estudos apenas do usuário corrente.
- `auth_sessions` armazena apenas o hash SHA-256 do token aleatório e sua expiração; o token em claro só existe no cookie seguro.
- `users.passwordHash` deriva com scrypt; a API retorna apenas `id`, `name`, `email` e `role`.
- Bootstrap admin exige segredo de pelo menos 32 caracteres, valida a linha preexistente de papel `admin` e atualiza a senha apenas se `passwordHash IS NULL`.
- Signup fechado não impede o bootstrap admin; quando aberto, novos usuários recebem exclusivamente `user`.

## Modelo relacional

- `users 1—N activity_completions`, `study_sessions`, `user_achievements`, `quick_notes` e `weekly_goals`.
- `subjects 1—N activities`; `activities 1—N activity_completions`.
- `auth_sessions` e `auth_rate_limits` guardam apenas material não reutilizável/hashed de autenticação.

`activity_completions` é única por `(activityId, userId)`; `user_achievements` é única por `(userId, achievementCode)`; `weekly_goals` é única por `(userId, weekStart)`. `0002_local_auth.sql` adiciona senha e sessões; `0003_auth_rate_limits.sql` cria a tabela e o índice de janela. A transferência não copia sessões ou buckets temporários.

## Domínios tRPC

| Domínio | Procedures principais |
| --- | --- |
| `auth` | `me`, `signupStatus`, `register`, `login`, `logout` |
| `dashboard` | `summary` (cards, prazos e séries de gráficos) |
| `subjects` | `list`, `create`, `update`, `remove` |
| `activities` | `list`, `create`, `update`, `remove` |
| `completions` | `toggle` |
| `study` | `stats`, `record` |
| `achievements` | `list` |
| `planner` | `note`, `saveNote`, `goal`, `saveGoal` |
| `export` | `data` (JSON/CSV do próprio usuário) |

## Direção visual e experiência

**Academic Command Center** combina estrutura editorial e sinais de progresso. O tema escuro permanente usa `#10111a` como fundo e `#181a25` para superfícies; Índigo 2B (`#5B6CFF`) é ação/identidade, verde-menta sinaliza progresso e cores das matérias carregam contexto. Plus Jakarta Sans conduz títulos/interface; DM Mono diferencia métricas, prazo e temporizador. No desktop há sidebar; no celular, navegação inferior. Transições respeitam `prefers-reduced-motion`.

A interface cobre carregamento, vazio, erro, sucesso, confirmação destrutiva e feedback de conquista. A PWA tem manifesto próprio, ícones, service worker, cache do shell e rota offline; instalação é opcional e não altera a autenticação.

## Operação e limites

`GET /api/health` é público e retorna `200` quando `SELECT 1` funciona; caso contrário, responde `503`. O Vercel Hobby serve a Function e arquivos pelo domínio gratuito `*.vercel.app`; o TiDB Starter é o banco gratuito escolhido. Quotas e termos do provedor podem mudar e podem suspender serviço ao exceder limites; não habilitar billing/cartão/upgrade. O firewall TiDB deve ser restrito a AWS e, se necessário, ao IP temporário usado na migração.

O importador aplica migrations no destino, lê a origem em snapshot consistente somente-leitura e importa em transação. Não modifica nem exclui o banco Manus; dados criados depois do corte não sincronizam de volta. Nenhum deploy público de produção ou corte será feito sem revisão/aprovação separada do proprietário.
