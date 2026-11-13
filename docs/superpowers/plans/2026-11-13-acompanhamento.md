# Acompanhamento de alunos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Executar na conversa atual, sem delegação automática.

**Goal:** Permitir acompanhamento administrativo, edição temporária concedida pelo aluno e acesso independente às fotos.

**Architecture:** Manter a identidade real do Neon Auth e resolver separadamente o titular dos dados. Contexto opaco no servidor, autorização por operação, revisão explícita de cada ponto de escrita e auditoria na mesma transação da mutação.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, Tailwind 4, Zod, Drizzle, Neon HTTP e Vitest já instalados.

## Global Constraints

- Interface pt-BR, mobile-first; fuso America/Sao_Paulo.
- Sem novas dependências ou serviços pagos.
- Não substituir globalmente userId em exigirUsuario().
- Orientações pelo WhatsApp; sem chat ou mensagens no app nesta fase.
- Edição sempre com prazo escolhido pelo aluno; fotos com autorização independente.
- IA, aplicação semanal, tokens, aceites e segurança da conta permanecem pessoais nesta versão.
- Fotos em acompanhamento são somente leitura; upload/exclusão ficam com o dono.
- Migrations somente nos ambientes corretos; não executar migrations no build.
- Este plano prepara a implementação; não autoriza sozinho deploy, mudanças de produção ou ampliação do escopo aprovado.

Referência: ../specs/2026-11-13-acompanhamento-design.md.

## 1. Preparação e inventário de superfícies

**Arquivos:** AGENTS.md, CLAUDE.md, docs/SEGURANCA.md; criar docs/relatorios/acompanhamento-superficies.md.

- [ ] Conferir git status, branch, commits remotos e migration 0015 antes de criar a branch codex/acompanhamento-alunos. Preservar .claude/launch.json e docs/CONTINUIDADE-CODEX.md.
- [ ] Ler os guias instalados: node_modules/next/dist/docs/01-app/02-guides/authentication.md, 02-guides/server-actions.md e 03-api-reference/04-functions/cookies.md. Consultar também o guia local de cache/revalidação ao integrar a troca de contexto.
- [ ] Conferir tipos/fontes do SDK Neon Auth para obter um vínculo estável com a sessão validada; nunca copiar token para logs/documentos. Conferir db.batch e falhas transacionais no driver instalado.
- [ ] Enumerar todos os endpoints e callbacks com o comando abaixo. Registrar cada função como leitura, escrita, chamada externa ou pessoal, com seu teste correspondente. Incluir app/(app)/comida/agua.ts e app/acoes.ts, não só arquivos chamados actions.ts.

```powershell
rg -n 'use server|export async function|exigirUsuario|obterSessao|db\.' app lib/dal lib/ia
```

- [ ] Rodar npm test, npm run lint e npm run typecheck; registrar a linha de base. Não chamar Gemini nem gravar dados reais.
- [ ] Commitar o inventário com mensagem: docs: mapeia superfícies do acompanhamento.

**Entrega:** mapa que distingue autorização de identidade, leitura do titular e efeitos colaterais. Nenhum endpoint de saúde pode ficar sem classificação.

## 2. Política pura e contratos

**Criar:** lib/acompanhamento/regras.ts, lib/validacao/acompanhamento.ts, tests/acompanhamento.test.ts.

**Contratos propostos:**

```ts
type TipoAutorizacao = "edicao" | "fotos";
type Concessao = {
  estado: "pendente" | "aceita" | "recusada" | "revogada";
  expiraEm: Date | null;
};
type ContextoDados = {
  atorId: string;
  titularId: string;
  contextoId: string; // "proprio" ou id opaco validado
  modo: "proprio" | "acompanhamento";
  podeEditar: boolean;
  podeVerFotos: boolean;
  edicaoAte: Date | null;
};
function concessaoAtiva(tipo: TipoAutorizacao, concessao: Concessao | null, agora: Date): boolean;
function contextoConfere(renderizado: string, atual: string): boolean;
```

- [ ] Escrever primeiro testes de regra, incluindo estes casos concretos:

```ts
it("encerra edição exatamente no prazo", () => {
  const fim = new Date("2026-11-14T15:00:00Z");
  expect(concessaoAtiva("edicao", { estado: "aceita", expiraEm: fim }, fim)).toBe(false);
});
it("não confunde formulário de outra conta", () => {
  expect(contextoConfere("proprio", "ctx-aluno")).toBe(false);
  expect(contextoConfere("ctx-a", "ctx-b")).toBe(false);
});
it("edição não pode ser ilimitada", () => {
  expect(concessaoAtiva("edicao", { estado: "aceita", expiraEm: null }, new Date())).toBe(false);
});
```

- [ ] Executar npx vitest run tests/acompanhamento.test.ts e confirmar falhas pelas funções ausentes.
- [ ] Implementar regras: estado aceita, tipo correto e expiraEm > agora para edição; fotos aceitas podem não ter expiração. Zod valida UUID, tipo, decisão e data/hora final; conversão explícita de São Paulo, sem depender do fuso do navegador/host.
- [ ] Cobrir concessão revogada/recusada/pendente, prazo passado, data impossível, foto sem concessão e marcador de contexto ausente; executar novamente e obter aprovação de todos os casos.
- [ ] Commit: feat: define regras do acompanhamento e autorizações.

## 3. Banco, autorização e auditoria transacional

**Modificar:** lib/db/schema.ts.
**Criar:** migration seguinte a 0015 em drizzle e metadados via gerador; lib/dal/acompanhamento.ts, lib/dal/acompanhamento-escrita.ts, tests/banco/acompanhamento.test.ts.

**Interfaces da DAL:**

```ts
// admin é Administrador obtido exclusivamente da sessão real.
listarAlunos(admin: Administrador, busca: string, pagina: number): Promise<AlunoResumo[]>;
solicitarAutorizacao(admin: Administrador, alunoId: string, tipo: TipoAutorizacao): Promise<string>;
decidirAutorizacao(alunoId: string, pedidoId: string, decisao: "aceitar" | "recusar", expiraEm: Date | null): Promise<boolean>;
revogarAutorizacao(alunoId: string, pedidoId: string): Promise<boolean>;
listarAutorizacoes(alunoId: string): Promise<AutorizacaoResumo[]>;
listarHistorico(alunoId: string, pagina: number): Promise<EventoResumo[]>;
```

AlunoResumo contém userId/nome/email para a lista administrativa. AutorizacaoResumo contém id, administradorId/nome, tipo, estado e horários. EventoResumo contém autor/nome, operação, recurso/recursoId e horário, sem valores de saúde.

- [ ] Criar testes de banco com três usuários e dois administradores: aluno errado decide pedido → false; aceite por A não beneficia B; pendências duplicadas → mesmo pedido; prazo inválido recusado pelo CHECK; exclusão de perfil respeita FKs.
- [ ] Rodar pelo runner de banco existente no branch test e verificar falha antes da migration. Conferir o alvo sem imprimir connection strings.
- [ ] Criar as três tabelas da especificação; índices por ator/titular, pendência única parcial, CHECK de tipo/estado, pares diferentes, edição aceita com prazo. Usar timestamps com timezone e relógio do banco.
- [ ] Implementar decisão/revogação somente por alunoId derivado da sessão. Limite de 10 pedidos/dia/par/tipo via contador existente. Resolver concorrência com trava por par/tipo compartilhada entre decisão, revogação e escrita.
- [ ] Definir primitiva interna para mutações administrativas: db.batch([trava, verificação que lança erro se inválida, mutações filtradas pelo titular, auditoria]). Se usar função SQL de verificação, deve ser SECURITY INVOKER, search_path fixo, entrada tipada e sem SQL dinâmico. Não usar 1/0 ou erro artificial no lugar de autorização explícita. Reutilizar a mesma instância do banco; DAL de escrita não pode executar fora do batch.
- [ ] Adaptar DALs de negócio apenas nas operações administrativas: construir statements para o batch; IDs novos gerados antes do batch permitem evento relacionado. Não envelopar promises de writes já executados. Falha do evento precisa reverter a alteração real.
- [ ] Testar concorrência aceite/revogação/escrita e auditoria com falha; confirmar que a operação que obtém a trava depois da revogação falha. Rodar npm run test:banco e commit: feat: persiste permissões e auditoria de acompanhamento.

## 4. Contexto seguro, identidade e navegação

**Criar:** lib/auth/acompanhamento.ts, app/(app)/ajustes/alunos/actions.ts, tests/acompanhamento-contexto.test.ts.
**Modificar:** lib/auth/sessao.ts (expor identidade de sessão validada sem token), app/acoes.ts (limpar contexto ao sair).

**Interfaces:**

```ts
exigirContextoDados(): Promise<ContextoDados>;
exigirContextoEscrita(contextoRenderizado: string): Promise<ContextoDados>;
exigirContaPropria(): Promise<ContextoDados>;
iniciarAcompanhamento(form: FormData): Promise<void>;
encerrarAcompanhamento(): Promise<void>;
```

- [ ] Escrever testes com sessão comum, administrador removido, aluno recusado, cookie adulterado, contexto de outra sessão, expiração de 12h e cookie inválido em uma escrita.
- [ ] Rodar npx vitest run tests/acompanhamento-contexto.test.ts; verificar falha.
- [ ] Implementar contexto aleatório vinculado à sessão e ator no banco. Cookie só carrega id; usar await cookies(), HttpOnly, SameSite=Lax, path=/ e Secure em produção. Ler em páginas; alterar cookie apenas nas Actions.
- [ ] Na entrada, conferir admin real, alvo aprovado e diferente de admins; criar contexto e redirecionar a /hoje. Na saída, invalidar contexto, apagar cookie e redirecionar a /hoje. Revalidar layout e descartar estados da conta anterior.
- [ ] Manter exigirUsuario/exigirAdmin pessoais. Resolvedor de dados usa a nova DAL. Não retornar autoridade administrativa como se fosse do aluno.
- [ ] Testar marcador proprio→aluno, aluno A→B, aluno→proprio e logout/login de outro usuário. Novo contexto nunca reutiliza o identificador anterior. Executar testes e commit: feat: separa identidade e conta acompanhada.

## 5. Telas de alunos, autorizações e faixa permanente

**Criar:** app/(app)/ajustes/alunos/page.tsx; app/(app)/ajustes/acompanhamento/{page.tsx,actions.ts,formularios.tsx}; app/(app)/faixa-acompanhamento.tsx; components/contexto-dados.tsx.
**Modificar:** app/(app)/layout.tsx, app/(app)/ajustes/page.tsx, app/(app)/hoje/page.tsx, app/(app)/barra-abas.tsx.

- [ ] Adicionar testes de Actions: aluno comum não lista, admin não aceita seu próprio pedido para terceiro, pedido alheio não revoga, prazo do aceite é escolhido pelo aluno e validado no servidor.
- [ ] Criar lista paginada com nome/e-mail e Acompanhar; não mostrar dados de saúde na listagem. Criar solicitações separadas para edição/fotos e estados pendente/aceita/recusada/revogada/expirada.
- [ ] Implementar formulário de prazo livre com data e hora, resumo do prazo antes do aceite, aceitar/recusar/revogar. Fotos usam aceite separado que explica validade até revogação. Lista de histórico paginada em 20 itens.
- [ ] Montar faixa sticky acima do conteúdo, com nome, modo, término da edição e Voltar para minha conta. Indicador em Hoje para o aluno abrir pedidos em Ajustes. Não inserir modal que aceite automaticamente.
- [ ] Provider recebe apenas permissões de exibição/contextoId; chavear estado pelo contexto. Incluir marcador nos formulários de ambos os modos. Ao expirar prazo ou voltar à aba, atualizar a tela; a checagem do servidor continua obrigatória.
- [ ] Testar no navegador: entrar/voltar, lista vazia, aluno sem nome, pedido pendente repetido, recusa, prazo customizado e revogação. Não usar contas reais para aceitar permissões de teste.
- [ ] Executar testes, lint/typecheck e commit: feat: adiciona interface de acompanhamento e permissões.

## 6. Integrar leitura e edição nos módulos existentes

**Modificar páginas e componentes de:** app/(app)/hoje, comida, treino, progresso e ajustes (perfil/metas).
**Modificar Actions:** app/(app)/comida/actions.ts, comida/agua.ts, comida/receitas/actions.ts, treino/actions.ts, progresso/actions.ts, progresso/meta/actions.ts, ajustes/actions.ts, ajustes/atividade/actions.ts.
**Revisar e bloquear acompanhamento nas Actions de IA:** comida/ia, comida/rotulo, treino/ia, progresso/semana e geração de explicações/diagnósticos. Revisar comida/barras/actions.ts, pois consultas podem materializar alimentos privados.
**Modificar DALs de escrita:** alimentos, registros, medidas, refeicoes-salvas, receitas, agua, treino, corpo, metas, perfil e qualquer módulo com efeito apontado no inventário.
**Testar:** tests/banco/acompanhamento-escritas.test.ts e suites existentes de cada módulo.

- [ ] Escrever testes representativos com valores conhecidos: tentar adicionar 200 ml sem permissão mantém total e eventos; com permissão aumenta em 200 e cria um evento; revogação bloqueia próximo aumento; contexto trocado não altera nenhum dos dois alunos.
- [ ] Rodar casos novos antes de adaptar as funções; verificar falha real de acesso negado ou implementação ausente.
- [ ] Migrar leituras para exigirContextoDados e continuar passando titularId para DAL. Buscar perfil/metas/energia do mesmo titular. Remover criação automática de dados do aluno em leituras administrativas.
- [ ] Adaptar cada Action de alteração para exigirContextoEscrita, validar entrada, filtrar recurso por titular e usar batch transacional da tarefa 3. Conta própria mantém validações anteriores. Não confiar somente em botões desabilitados.
- [ ] Atualizar formulários, useActionState e callbacks programáticos (séries/cronômetro inclusive) para enviar contexto renderizado. Enquanto somente leitura, mostrar dados sem controles de gravação.
- [ ] Bloquear aceites de IA, chamadas externas com dados do aluno, aplicação semanal e tokens com exigirContaPropria. Endpoint Bearer /api/passos mantém associação ao dono da chave e ignora cookie administrativo.
- [ ] Conferir todas as linhas do inventário. Exercitar diretamente cada Action gravadora sem permissão; bloquear também favoritas, medidas, consumo de cotas e materializações por código de barras.
- [ ] Testar escrita autorizada, ids de terceiro, autorização para outro admin, expiração, falha de auditoria e formulários antigos em cada família. Rodar npm test, npm run test:banco, lint e typecheck. Commit por módulo: feat: integra acompanhamento em alimentação/treino/progresso.

## 7. Fotos privadas com autorização independente

**Modificar:** app/(app)/progresso/fotos/page.tsx, app/(app)/progresso/fotos/actions.ts, app/api/fotos-corpo/[id]/route.ts, lib/dal/fotos-corpo.ts, tests/banco/fotos-corpo.test.ts.

- [ ] Adicionar casos: admin só com edição recebe 404 nos bytes; fotos aceitas permitem leitura do aluno correto; terceiro permanece 404; revogação bloqueia listagem/comparação/GET; upload/exclusão administrativos permanecem negados.
- [ ] Executar suite e confirmar falha dos novos casos.
- [ ] Resolver ator/titular e checar concessão de fotos antes de buscar resumos, contagens, notas ou bytes. Manter 401 sem sessão, 404 inacessível, private/no-store, nosniff e same-origin.
- [ ] Vincular URLs de imagem ao contexto renderizado (parâmetro de contexto validado no servidor) para que uma imagem antiga não reutilize novo contexto. Dono usa marcador proprio; não é autorização por URL.
- [ ] Exibir Solicitar acesso às fotos quando bloqueado, sem consultar imagens. Manter upload/exclusão com exigirContaPropria. Retirar fotos do DOM quando o app detectar revogação/expiração/contexto inválido; sem prometer apagar cópias já vistas.
- [ ] Rodar testes de fotos, isolamento e lint/typecheck; commit: feat: protege fotos com autorização independente.

## 8. Verificação completa e entrega

**Atualizar:** docs/SPEC.md, docs/SEGURANCA.md, docs/BANCO.md.
**Criar:** docs/relatorios/acompanhamento-seguranca.md, docs/testes/acompanhamento-iphone.md.

- [ ] Documentar exceção administrativa à regra user_id da sessão: titular resolvido no servidor, ator preservado, concessão por operação. Atualizar mapa com todas as Actions/endpoints e respectivos testes.
- [ ] Rodar npm test, npm run test:banco, npm run lint, npm run typecheck, npm run build e npm audit. Registrar saída real e diferenciar indisponibilidade de rede de aprovação. Não corrigir dependências indiscriminadamente com audit fix.
- [ ] Validar com duas contas sintéticas e duas abas: entrada via Ajustes, todas as abas com mesmo aluno, retorno, autorização com prazo livre, rejeição, revogação, vencimento, fotos independentes e histórico.
- [ ] No iPhone, verificar faixa sem cobrir formulário/abas, alvos de toque, volta ao app, campos de prazo e formulário aberto durante troca de contexto. Testar acesso direto aos bytes sem sessão.
- [ ] Revisar diff e ausência de segredos; registrar limitações e resultados em relatório. Commit: docs: registra validação do acompanhamento.
- [ ] Antes de publicar: conferir schema/migration 0015 e nova migration, aplicar primeiro em dev/test, validar preview e somente então preparar produção conforme autorização da sessão. Não fazer push de código parcialmente protegido para main.

## Revisão do plano

Cada requisito tem cobertura: entrada/retorno (4–5), leitura geral (6), prazo escolhido e revogação (2–3–5–6), fotos separadas (7), ator e auditoria (3–6), isolamento entre alunos e abas (4–6–8). Chat e orientações internas foram excluídos. Não há código funcional nesta entrega de planejamento.
