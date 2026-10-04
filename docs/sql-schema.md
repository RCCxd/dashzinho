# Esquema SQL — Dashboard do 2B

A fonte executável do esquema é `drizzle/schema.ts`; as migrations ficam em `drizzle/`. O destino selecionado é TiDB Cloud Starter (MySQL compatível), aplicado por migrations Drizzle.

| Tabela | Finalidade | Restrições principais |
| --- | --- | --- |
| `users` | Conta local, papel e hash de senha | `accountId` é a chave de conta; no banco legado, a coluna física `openId` é preservada para não quebrar o ID importado. `email` é único; `passwordHash` é nullable até bootstrap de admin. |
| `auth_sessions` | Sessões opacas com token armazenado como SHA-256 | FK para `users`, hash único, expiração e índices de usuário/validade. |
| `auth_rate_limits` | Buckets de tentativas compartilhados entre Functions | SHA-256 como chave; índice em `windowStartedAt` para limpeza periódica; expurgo após 7 dias. |
| `subjects` | Matérias criadas pelo admin | Chave primária `id` |
| `activities` | Tarefas, provas, trabalhos e projetos | FK para matéria; índices em `subjectId` e `dueDate` |
| `activity_completions` | Conclusões individuais | FK para atividade/usuário; único em `(userId, activityId)` |
| `study_sessions` | Pomodoros e estudos livres | FKs opcionais para matéria/atividade; índice composto de usuário/data |
| `achievement_definitions` | Catálogo de badges | `code` como chave primária |
| `user_achievements` | Progresso e desbloqueio individual | FKs para usuário/catálogo; único em `(userId, achievementCode)` |
| `quick_notes` | Nota privada do usuário | Uma nota por usuário |
| `weekly_goals` | Meta semanal privada | Uma meta por usuário/semana |

## Integridade e exclusões

Atividades dependem de matérias e conclusões dependem de atividades; esses relacionamentos usam exclusão em cascata. Sessões de estudo preservam o histórico se uma matéria ou atividade for removida, anulando apenas a associação opcional. Dados pessoais usam o `userId` da sessão no servidor; nenhuma procedure aceita um identificador de outro usuário para escrever conclusões, estudos, notas, metas ou conquistas. A migração de dados copia usuários e registros pessoais em ordem de dependência, mas não copia sessões de login antigas.

## Papéis e credenciais

O valor `user` representa aluno e é atribuído a todo cadastro novo. O valor `admin` já existente é preservado no import; essa conta usa um segredo temporário de bootstrap para definir a primeira senha. Scrypt deriva senhas e a API só retorna `id`, `name`, `email` e `role`. O token de sessão não é guardado em claro no banco: apenas seu hash SHA-256 vai para `auth_sessions`. A migration `0003_auth_rate_limits.sql` cria o rate limiter persistente necessário a Functions serverless.
