# Tarefas — Dashboard do 2B

## MVP — implementado

- [x] Fundação de dados, schema/migrations Drizzle, autenticação local e autorização por papel.
- [x] CRUD de matérias/atividades; conclusões isoladas por aluno.
- [x] Dashboard com resumos, prazos, progresso e gráficos.
- [x] Pomodoro, persistência de sessões, estatísticas e conquistas.
- [x] Planner pessoal com notas, metas e exportação.
- [x] Tema escuro permanente, layout responsivo, PWA e modo offline básico.
- [x] Testes, checagem TypeScript e build do cliente para Vercel.

## Migração externa — em andamento

- [x] **Destino confirmado:** Vercel Hobby + TiDB Cloud Starter somente nas cotas/termos gratuitos; sem cobrança, cartão, upgrade, domínio pago ou GitHub.
- [x] **Autenticação própria:** e-mail/senha, scrypt, sessão persistente, bootstrap admin por código temporário, cadastro aberto configurável para alunos.
- [x] **Portabilidade Express:** `server/_core/app.ts` reutilizável, `server.ts` como entrypoint Express Vercel, CDN `public/**` e fallback SPA.
- [x] **Segurança de sessão:** cookies HTTPS, CSRF double-submit, rate limits persistidos e migration `0003_auth_rate_limits.sql`.
- [x] **Transferência preparada:** importador aplica migrations no TiDB, força TLS e porta 4000, preserva snapshot de origem e importa em transação com validações.
- [ ] **Provisionamento:** criar serviços/contas e configurar firewall/segredos nos planos gratuitos. A conexão Vercel está desativada; TiDB não tem conector nesta sessão.
- [ ] **Importação real:** aguardar acesso ao TiDB Starter e migrar dados sem alterar ou excluir a origem.
- [ ] **Preview:** executar smoke tests com banco real, revisar cota/firewall e testar login/CSRF/permissões/PWA.
- [ ] **Produção:** após revisão do proprietário, pedir aprovação separada antes de publicar `--prod` ou liberar signup público.

## Pós-MVP

- [ ] Calendário mensal/semanal interativo.
- [ ] Upload de anexos, ranking, push/e-mail e sincronização realtime.
- [ ] Recuperação de senha/verificação e-mail, após selecionar provedor apropriado.
