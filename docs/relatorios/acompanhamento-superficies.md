# Superfícies de acompanhamento

Inventário de integração. Leitura resolve titular no servidor; escritas passam pelo contexto e transação com autorização/auditoria; ações pessoais não aceitam acompanhamento.

| Arquivo | Função | Categoria |
|---|---|---|
| ajustes/actions.ts | salvarPerfil | Escrita autorizada |
| ajustes/actions.ts | salvarMetas | Escrita autorizada |
| ajustes/actions.ts | decidirCadastro | Pessoal |
| comida/actions.ts | buscar | Leitura |
| comida/actions.ts | adicionar | Escrita autorizada |
| comida/actions.ts | editarRegistro | Escrita autorizada |
| comida/actions.ts | apagarRegistro | Escrita autorizada |
| comida/actions.ts | favoritar | Escrita autorizada |
| comida/actions.ts | salvarMedida | Escrita autorizada |
| comida/actions.ts | fixarMedidaIbge | Escrita autorizada |
| comida/actions.ts | apagarMedida | Escrita autorizada |
| comida/actions.ts | salvarAlimento | Escrita autorizada |
| comida/actions.ts | apagarAlimento | Escrita autorizada |
| comida/actions.ts | salvarComoRefeicao | Escrita autorizada |
| comida/actions.ts | usarRefeicaoSalva | Escrita autorizada |
| comida/actions.ts | apagarRefeicaoSalva | Escrita autorizada |
| comida/actions.ts | copiarRefeicao | Escrita autorizada |
| comida/agua.ts | adicionarAgua | Escrita autorizada |
| comida/agua.ts | adicionarAguaLivre | Escrita autorizada |
| comida/agua.ts | desfazerAgua | Escrita autorizada |
| progresso/actions.ts | salvarPesagem | Escrita autorizada |
| progresso/actions.ts | apagarPesagem | Escrita autorizada |
| progresso/actions.ts | marcarAplicacao | Pessoal |
| progresso/actions.ts | desfazerAplicacao | Pessoal |
| progresso/actions.ts | salvarDiaAplicacao | Pessoal |
| treino/actions.ts | salvarExercicio | Escrita autorizada |
| treino/actions.ts | apagarExercicio | Escrita autorizada |
| treino/actions.ts | salvarPlano | Escrita autorizada |
| treino/actions.ts | salvarTreino | Escrita autorizada |
| treino/actions.ts | apagarTreino | Escrita autorizada |
| treino/actions.ts | adicionarExercicioAoTreino | Escrita autorizada |
| treino/actions.ts | removerExercicioDoTreino | Escrita autorizada |
| treino/actions.ts | adicionarSubstitutoAoItem | Escrita autorizada |
| treino/actions.ts | removerSubstitutoDoItem | Escrita autorizada |
| treino/actions.ts | definirAgendaDoDia | Escrita autorizada |
| treino/actions.ts | trocarTreinoDoDia | Escrita autorizada |
| treino/actions.ts | salvarSerieDoDia | Escrita autorizada |
| treino/actions.ts | apagarSerieDoDia | Escrita autorizada |
| treino/actions.ts | concluirTreino | Escrita autorizada |
| treino/actions.ts | registrarFaltaDoDia | Escrita autorizada |
| treino/actions.ts | desfazerRegistroDoDia | Escrita autorizada |
| ajustes/atividade/actions.ts | diagnosticarAtividade | Pessoal |
| ajustes/atividade/actions.ts | confirmarAtividade | Escrita autorizada |
| ajustes/passos/actions.ts | Todas | Pessoal (IA/fotos/tokens/serviços externos) |
| comida/barras/actions.ts | Todas | Pessoal (IA/fotos/tokens/serviços externos) |
| comida/ia/actions.ts | Todas | Pessoal (IA/fotos/tokens/serviços externos) |
| comida/receitas/actions.ts | salvarReceita | Escrita autorizada |
| comida/receitas/actions.ts | excluirReceitaAcao | Escrita autorizada |
| comida/rotulo/actions.ts | Todas | Pessoal (IA/fotos/tokens/serviços externos) |
| progresso/fotos/actions.ts | Todas | Pessoal (IA/fotos/tokens/serviços externos) |
| progresso/meta/actions.ts | salvarPesoMeta | Escrita autorizada |
| progresso/meta/actions.ts | salvarRitmoMax | Escrita autorizada |
| progresso/meta/actions.ts | explicarOpcaoMeta | Pessoal |
| progresso/meta/actions.ts | aplicarOpcaoMeta | Escrita autorizada |
| progresso/semana/actions.ts | Todas | Pessoal (IA/fotos/tokens/serviços externos) |
| treino/ia/actions.ts | Todas | Pessoal (IA/fotos/tokens/serviços externos) |

GET /api/fotos-corpo/[id]: autorização independente e contexto da imagem. POST /api/passos: token pessoal; não usa acompanhamento. Login/cadastro/recuperação permanecem ligados à identidade real.
