# Acompanhamento de alunos — desenho aprovado

Data: 13/11/2026. Escopo funcional aprovado na conversa; este documento e o plano detalham sua execução. Nenhuma funcionalidade foi implementada nesta etapa.

## Objetivo e decisões do usuário

O administrador entra em Ajustes → Alunos → Acompanhar e navega pelas telas do aluno aprovado. Continua autenticado como administrador e retorna aos próprios dados com um botão sempre disponível. Nesta versão, não há aceite inicial para visualizar os dados gerais. Convites e consentimento inicial ficam para outra fase.

O padrão é leitura. Para alterar os dados, o administrador solicita autorização e o aluno escolhe o período de liberação. O aluno pode revogar antes do fim. Fotos corporais precisam de autorização separada. Orientações serão dadas pelo WhatsApp; não haverá chat, mensagens, integração com WhatsApp ou notificações push nesta entrega.

## Experiência

- Ajustes do administrador ganha Alunos, com busca por nome/e-mail, paginação de 20 itens e apenas contas aprovadas diferentes da própria conta. Não listar outros administradores como alunos.
- Acompanhar abre Hoje com os dados do aluno. Hoje, Comida, Treino, Progresso e os ajustes de perfil/metas acompanham o mesmo aluno.
- Faixa fixa respeitando área segura: “Acompanhando: [nome]”, estado “Somente leitura” ou “Edição autorizada até [data e hora]” e “Voltar para minha conta”. O retorno leva a /hoje e limpa o contexto.
- Solicitar edição e Solicitar acesso às fotos são ações distintas. Uma solicitação pendente por administrador, aluno e tipo; cliques repetidos não duplicam pedidos.
- O aluno encontra solicitações em Ajustes → Acompanhamento, com indicador de pendências também em Hoje. Vê quem solicitou e o escopo, aceita ou recusa. Sem envio de e-mail ou comunicação externa.
- Para edição, o aluno informa data e horário finais livres, futuros, em America/Sao_Paulo; podem existir atalhos de duração, mas não são as únicas escolhas. O servidor calcula a expiração e rejeita datas inválidas/passadas. Não oferecer edição sem prazo.
- Detalhe de implementação proposto para fotos: permissão de visualização até revogação, exibida claramente no aceite. Independente do prazo de edição. O aluno pode revogar em Ajustes → Acompanhamento.
- A tela do aluno informa que administradores podem acompanhar seus dados gerais nesta versão. Fotos permanecem bloqueadas até autorização específica.
- O histórico mostra autor, operação, recurso e horário de alterações administrativas. Não copia valores de saúde, fotos, senhas ou tokens para o histórico.

## Matriz de acesso

| Recurso | Leitura administrativa | Com edição temporária |
|---|---|---|
| Alimentação, receitas, alimentos pessoais, refeições salvas, água | Sim | Criar, corrigir e excluir pelos fluxos existentes |
| Treinos, exercícios pessoais, agenda, séries e faltas | Sim | Criar, corrigir e excluir pelos fluxos existentes |
| Perfil de acompanhamento, metas, pesagens e evolução | Sim | Ajustar pelos fluxos existentes, preservando validações e snapshots |
| Passos recebidos | Sim | Não gerar/revogar tokens nem alterar a API de passos |
| Fotos corporais, miniaturas, notas e comparação | Só com autorização de fotos | Permissão de edição não concede acesso; upload/exclusão continuam exclusivos do dono nesta versão |
| Registro/lembrete de aplicação semanal | Não entra no acompanhamento inicial | Exclusivo do dono; escopo inicial é treino/nutrição/evolução |
| Conta, senha, permissões, aceites de IA e administração | Não | Exclusivos do ator autenticado; ocultos no contexto do aluno |

Chamadas à IA que enviam dados do aluno não ficam habilitadas nesta primeira versão de acompanhamento. Os fluxos pessoais de IA continuam como estão; o administrador orienta e edita manualmente quando autorizado. Isso evita assumir o aceite de terceiros ou consumir sua cota durante uma consulta.

Esses limites de implementação (fotos somente leitura, aplicação semanal pessoal e IA pessoal) devem ser apresentados com o plano antes de começar o código.

## Arquitetura

Preservar exigirUsuario()/exigirAdmin() como identidade real, sem substituir globalmente userId. Criar um resolvedor separado para o contexto de acompanhamento, com atorId, titularId, modo, contextoId e permissões. Consultas continuam filtradas por titularId na DAL, resolvido e autorizado no servidor. A exceção administrativa às regras atuais de SEGURANCA.md será documentada e testada.

Um cookie HttpOnly, Secure em produção, SameSite=Lax, path=/ guarda apenas um identificador aleatório de contexto. A linha correspondente no banco pertence ao administrador e à sessão real atual, tem aluno, expiração e revogação. O contexto expira em até 12 horas e não sobrevive ao logout, troca de identidade ou invalidação da sessão. Não guardar o token de sessão do Neon em tabelas ou logs; usar vínculo não reversível à sessão validada, após conferir a interface instalada do SDK.

Toda leitura revalida a identidade, o papel administrativo atual, a aprovação do aluno e o contexto. Cookie ausente significa conta própria. Cookie presente inválido não pode virar silenciosamente uma gravação na conta própria: recusar a operação e pedir retorno/recarregamento.

Todos os formulários e callbacks de alteração recebem o contextoId renderizado, inclusive os formulários da conta própria (marcador proprio). O servidor compara com o contexto atual antes de gravar. Isso evita que uma aba aberta para A grave em B depois de trocar de aluno em outra aba. O identificador não concede autoridade e nunca substitui a sessão. Cada recurso também é filtrado pelo titular autorizado.

Na leitura, atualizar telas ao recuperar foco e ao expirar permissões; descartar formulários e estados ao trocar de contexto. Essa atualização é conforto: a segurança permanece no servidor. Não usar cache compartilhado para dados ou permissões do acompanhamento.

## Persistência

Adicionar migration versionada após 0015, conferindo a numeração na execução:

1. acompanhamento_contextos: id aleatório, administrador_id, aluno_id, vínculo de sessão, criado_em, expira_em, encerrado_em.
2. acompanhamento_autorizacoes: id, administrador_id, aluno_id, tipo (edicao/fotos), estado (pendente/aceita/recusada/revogada), solicitado_em, decidido_em, expira_em, revogado_em. Edição aceita exige expiração. Expiração é derivada do relógio do banco, sem cron. Índice único parcial impede pedidos pendentes duplicados. Novo aceite encerra concessões anteriores do mesmo par/tipo.
3. acompanhamento_eventos: id, ator_id, aluno_id, autorização/contexto relacionados, operação, recurso, recurso_id e criado_em. Dados mínimos de auditoria; sem payloads de saúde. Histórico visível apenas ao aluno titular e a administradores autorizados.

Foreign keys, CHECKs, índices por titular/administrador e permissões mínimas. Sem novas dependências ou serviços pagos.

## Escritas e revogação

A autorização é verificada na operação efetiva, não apenas ao renderizar. Toda mutação administrativa deve agrupar verificação, alteração e auditoria na mesma transação. Usar as capacidades reais do driver Neon HTTP instalado (o projeto já usa db.batch), sem pressupor suporte a callbacks interativos de transação.

A verificação transacional usa o relógio do banco e trava compatível com aceite/revogação, evitando uma janela entre conferir e gravar. Se revogação concluir primeiro, a escrita falha. Uma operação já autorizada e serializada antes da revogação pode terminar; não prometer desfazer uma transação concluída. Falha de auditoria reverte a alteração. Exclusões registram o identificador do recurso antes de desaparecer; não armazenar conteúdo sensível no evento.

Somente o aluno autenticado pode aceitar, recusar ou revogar seus pedidos. Administrador não pode aceitar em nome do aluno. Pedidos são destinados a um administrador específico: consentimento para um não vale para outro. Limitar solicitações a 10 por dia por administrador/aluno/tipo com o mecanismo existente, além da unicidade de pendências.

Fotos: revalidar autorização em listagem, comparação e em cada GET dos bytes. Responder 404 para foto inacessível e 401 sem sessão; private/no-store. Revogar impede novas leituras, mas não apaga imagens que alguém já tenha visto ou salvo. Não oferecer links públicos.

## Erros e regressões

- Sem edição: “Você está apenas acompanhando. Solicite autorização para alterar.”
- Prazo vencido/revogado: “A autorização de edição terminou. Nenhuma alteração foi salva.”
- Contexto diferente: “A conta acompanhada mudou. Atualize a página antes de continuar.”
- Sem fotos: “O aluno ainda não autorizou o acesso às fotos.” Não revelar quantidade ou metadados.
- Aluno recusado, administrador removido ou sessão inválida: bloquear contexto e novas operações imediatamente na próxima requisição.
- Dono continua usando normalmente a conta, sem precisar de autorização própria. Tokens de passos nunca herdam acompanhamento.

## Critérios de aceitação

1. Administrador entra por Ajustes, vê dados do aluno e retorna aos próprios dados em qualquer tela.
2. Usuário comum não lista nem acessa outros alunos, mesmo com ids/cookies adulterados.
3. Leitura não permite mutações por chamada direta de Server Actions, inclusive água, favoritos, séries e consultas com efeitos colaterais.
4. Aluno escolhe prazo; aceite libera somente o administrador solicitado; recusa, expiração e revogação bloqueiam escritas.
5. Fotos exigem concessão independente e nunca vazam por GET direto, miniaturas ou comparação.
6. Escritas administrativas auditadas atomicamente; sem dados sensíveis nos logs.
7. Duas abas, troca A→B, retorno à conta própria, expiração e formulários antigos não misturam dados.
8. Testes unitários, integração/isolamento, lint, typecheck, build e validação manual no iPhone antes de produção.

## Fora do escopo

Chat, integração com WhatsApp, push, convites/vínculo por professor, cobrança, novas regras nutricionais, edição de segurança da conta, compartilhamento público de fotos e novo provedor de IA.
