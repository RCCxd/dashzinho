# Requirements — Dashboard do 2B

## Visão do produto

O Dashboard do 2B organiza a rotina da turma em um app responsivo: matérias, atividades, foco Pomodoro, progresso e conquistas. A aplicação é autenticada, persistente e adequada a múltiplos dispositivos. O destino escolhido é Vercel Hobby + TiDB Cloud Starter; o app externo não depende do login, runtime API ou banco Manus para autenticar/servir o site.

## Papéis e acesso

| Papel | Regra | Capacidades |
| --- | --- | --- |
| `admin` | A conta administrativa já marcada `admin` no banco é ativada com o código inicial guardado como segredo no deploy; o código só é aceito enquanto a conta não tiver senha. | Criar, editar e excluir matérias e atividades; administrar conteúdo da turma. |
| `aluno` (`user`) | Quando o cadastro público está habilitado, qualquer pessoa pode criar uma conta com e-mail e senha; toda conta nova recebe `user` por padrão. | Visualizar matérias/atividades; concluir ou reabrir somente a própria conclusão; registrar os próprios estudos, notas e metas. |

A autorização é obrigatória no servidor. O cliente não define papel nem envia identificadores de outro usuário para mutações pessoais. O hash da senha e o identificador interno nunca são devolvidos pela API.

### Requisitos de autenticação

- O login deve usar e-mail e senha locais, sem Manus OAuth nem provedor externo de identidade.
- Quando `ALLOW_PUBLIC_SIGNUP=true`, cadastro de aluno exige nome, e-mail válido e senha com pelo menos 10 caracteres; cadastros novos recebem papel `user`.
- Em produção, `ALLOW_PUBLIC_SIGNUP` ausente ou `false` mantém o cadastro de alunos fechado durante a preparação/importação; a linha já importada com papel `admin` ainda pode ativar sua própria conta com o código inicial. Só definir `ALLOW_PUBLIC_SIGNUP=true` depois da importação e validação.
- O administrador existente deve definir uma senha no primeiro acesso com um código configurado como segredo no deploy, com pelo menos 32 caracteres aleatórios. A validação exige que o e-mail corresponda a uma linha existente com papel `admin`, e o código deixa de ser aceito depois que essa conta recebe senha.
- Senhas devem ser derivadas com scrypt; nunca guardar nem transmitir a senha em claro fora da requisição de login/cadastro.
- A sessão é um token aleatório opaco, armazenado no banco somente como SHA-256, com expiração de 30 dias. O cookie de sessão é `HttpOnly`, `Secure`, `SameSite=None`; mutações exigem token double-submit CSRF e logout revoga a sessão atual. `INSECURE_LOCAL_COOKIES=true` só tem efeito em `NODE_ENV=development` com hostname localhost; cookies públicos continuam `Secure; SameSite=None`.
- Login, cadastro e bootstrap administrativo têm limites de tentativas persistidos em `auth_rate_limits`; o login usa trabalho equivalente para e-mail inexistente. Respostas de cadastro inválido são genéricas para não revelar a existência/papel da conta. Se o banco estiver indisponível, a autenticação falha fechada.
- Recuperação automática por e-mail está fora do MVP enquanto não existir provedor de e-mail configurado; documentar esta limitação.

## Histórias e critérios do produto

### Matérias

- Como administrador, quero criar, editar e excluir matérias com nome, cor, professor, horário e descrição.
- Como usuário autenticado, quero consultar as matérias com informações de contexto e progresso.

### Atividades

- Como administrador, quero criar, editar e excluir atividades com título, descrição, matéria, tipo, prioridade, prazo, status, link e estimativa em minutos.
- Os tipos válidos são `tarefa`, `prova`, `trabalho` e `projeto`.
- As prioridades válidas são `baixa`, `media` e `alta`.
- Os status editoriais válidos são `pendente`, `em_andamento` e `concluida`.
- Como aluno, quero buscar e filtrar atividades por matéria, tipo, prioridade, prazo e estado.
- Como aluno, quero marcar e desmarcar apenas minha própria conclusão, com timestamp.

### Dashboard

- Como usuário, quero ver total de atividades, concluídas por mim, pendentes, atrasadas e percentual de progresso.
- Quero ver próximos prazos, progresso por matéria e gráficos de atividades por matéria, conclusões ao longo do tempo e horas de estudo.
- Após concluir uma atividade ou sessão, a interface deve atualizar imediatamente e revalidar os dados persistidos.

### Foco e estudos

- Como usuário, quero selecionar os presets 25/5 e 50/10 ou informar uma duração personalizada.
- Quero iniciar, pausar, retomar e resetar o foco; posso associar a sessão a matéria e atividade.
- Uma sessão finalizada registra duração, data e associações opcionais.
- Quero acompanhar horas totais, sessões por dia e dias consecutivos de estudo.
- Ao finalizar o foco, devo receber aviso visual e sonoro; a notificação do navegador exige ação explícita.
- Quero um modo foco/tela cheia para reduzir distrações.

### Conquistas

- Como usuário, quero ver badges desbloqueados e bloqueados com progresso.
- O sistema recalcula conquistas após conclusões e sessões de estudo, sem duplicar concessões.
- O catálogo inicial inclui: primeira atividade, 10 atividades, 100 atividades, 7 dias de estudo, 10 horas de Pomodoro, conclusão de uma matéria e 5 dias de estudo em uma semana.

### Produtividade e dispositivos

- Como usuário, quero registrar uma nota rápida pessoal e metas semanais de minutos/sessões.
- Quero exportar meus dados pessoais em JSON e CSV.
- O site deve permanecer sempre em tema escuro, sem botão ou preferência que permita mudar para o tema claro.
- Quero instalar o aplicativo em um celular compatível e visualizar uma tela offline mínima.
- A navegação deve usar sidebar em desktop e barra inferior em telas pequenas.

## Requisitos não funcionais

- Interface em português (Brasil), responsiva e acessível por teclado.
- Feedback para carregamento, vazio, erro, sucesso e confirmação destrutiva.
- Dados de produção em TiDB Cloud Starter (MySQL compatível), com migrations Drizzle versionadas e importação validada; banco Manus preservado durante rollback.
- Deploy Express como Vercel Function, cliente estático pelo CDN da Vercel, HTTPS, endpoint `/api/health` e TLS 1.2 no TiDB.
- Código TypeScript tipado, componentes reutilizáveis, testes de regras de domínio e limites de autenticação.
- O MVP entrega sincronização persistente e atualização otimista; websocket/realtime multissessão é pós-MVP.

## Fora do escopo do MVP

- Recuperação de senha ou verificação de endereço por e-mail até selecionar um serviço remetente.
- Calendário mensal/semanal arrastável completo.
- Ranking público de alunos.
- Upload binário de anexos.
- Push/e-mail de prazos externos.
- Canal websocket para múltiplas sessões simultâneas.
