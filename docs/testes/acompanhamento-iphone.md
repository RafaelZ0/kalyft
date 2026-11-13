# Roteiro de acompanhamento no iPhone

Executar em dev/preview com duas contas sintéticas e banco migrado.

1. Administrador: Ajustes → Alunos, procurar aluno aprovado e acompanhar. Conferir nome e modo na faixa em Hoje, Comida, Treino, Progresso e Ajustes.
2. Tentar alterar água, alimento, pesagem, metas e séries sem permissão: nada pode ser gravado. Conferir também chamada direta das Actions nos testes.
3. Pedir edição; entrar como aluno, conferir pedido, escolher data/hora livre e aceitar. Administrador atualiza e salva uma alteração. Aluno confere autor e operação no histórico.
4. Aluno revoga; administrador tenta salvar formulário já aberto. Repetir com prazo vencido.
5. Abrir aluno A em uma aba e trocar para B em outra. Salvar o formulário antigo deve ser bloqueado. Retornar à conta própria e conferir seus dados.
6. Fotos continuam bloqueadas mesmo com edição. Aceitar pedido separado de fotos; conferir lista e comparação. Revogar e verificar que novos GETs não entregam bytes. Administrador não envia nem exclui fotos.
7. Sem sessão, abrir URL dos bytes deve retornar 401. Id de outro titular e contexto antigo devem retornar 404.
8. Conferir área segura, faixa fixa, barra inferior, alvos de toque e foco dos campos de prazo. Sair e entrar com outra identidade não deve reaproveitar contexto.
9. IA, aplicação semanal, tokens e permissões não podem ser usados em nome do aluno. Orientações continuam pelo WhatsApp.
