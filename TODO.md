# Entregas do Dashboard do 2B

- [x] Interface responsiva para matérias, atividades, progresso, prazos e gráficos.
- [x] CRUD administrativo de matérias/atividades; conclusão individual por aluno.
- [x] Pomodoro persistido, estatísticas, metas, notas, exportação e conquistas calculadas no servidor.
- [x] Tema escuro permanente e PWA/offline básico.
- [x] Login local por e-mail/senha, hash scrypt, sessão opaca persistida, cookie seguro, CSRF e logout revogável.
- [x] Signup sempre cria papel `user`; bootstrap de admin usa somente a linha já marcada `admin` e um código único de 32+ caracteres.
- [x] Rate limits compartilhados em TiDB (`auth_rate_limits`) e migration aditiva `0003_auth_rate_limits.sql`.
- [x] Express extraído para `server/_core/app.ts`; `server.ts` é entrypoint compatível com a Function Express da Vercel.
- [x] Build Vercel compila Vite, prepara `public/**` para CDN e inclui `index.html` no pacote para fallback SPA.
- [x] Pool MySQL curto, TLS configurável para TiDB, `/api/health` dependente de `SELECT 1`.
- [x] Importador seguro: migrations no destino, TLS 1.2/porta 4000, snapshot somente-leitura da origem, cópia transacional e validação.
- [x] `pnpm check`, 7 testes Vitest e `pnpm build:vercel` aprovados.

## Migração externa — pendente de provisionamento

- [x] Destino decidido: Vercel Hobby + TiDB Cloud Starter, dentro das cotas gratuitas atuais; sem cartão, upgrade, billing, domínio pago ou GitHub.
- [x] Arquitetura Vercel e guia de execução documentados; deployment via CLI, sem conectar GitHub.
- [ ] Criar/acessar contas Vercel e TiDB usando somente planos gratuitos; parar se houver solicitação de pagamento/cartão.
- [ ] Criar TiDB Starter na região AWS compatível e restringir firewall; obter DSN sem compartilhar no chat.
- [ ] Configurar variáveis Vercel Preview com `DATABASE_URL`, `DATABASE_TLS=true`, `ALLOW_PUBLIC_SIGNUP=false` e bootstrap secreto temporário.
- [ ] Vincular CLI Vercel e executar `pnpm db:migrate:legacy` no Sandbox que mantém a DSN de origem Manus.
- [ ] Revisar contagens e rodar smoke tests reais no TiDB/Preview: health, TLS, sessão, CSRF, bootstrap, papéis, PWA e páginas diretas.
- [ ] Remover `ADMIN_BOOTSTRAP_CODE` após ativação do admin; manter signup fechado em Preview.
- [ ] Revisão do Preview pelo proprietário e aprovação explícita antes de `vercel deploy --prod` ou abertura pública do signup em Production.
- [ ] Preservar banco/serviço de origem para rollback; sem corte de DNS/domínio nesta etapa.

## Pós-MVP

- [ ] Calendário interativo mensal/semanal.
- [ ] Uploads de anexos com armazenamento e regras de acesso.
- [ ] Ranking com visibilidade opcional.
- [ ] Recuperação de senha e verificação de e-mail, após selecionar provedor apropriado.
- [ ] Push/e-mail e preferências de aviso.
- [ ] Canal realtime/websocket para múltiplas sessões.
