# Integração do cadastro guiado ao app real

16/11/2026. Protótipo v2 e direção visual aprovados; o usuário pediu os próximos passos. Plano concreto de integração preparado após inspeção do repositório. Nenhum código do app, migration ou banco foi alterado nesta entrega. A regra de `CLAUDE.md` pede apresentar o plano antes de escrever código da nova fase.

**Objetivo:** jornada segura e retomável após a liberação da conta, preservando dados existentes, identidade visual e caminhos manuais.

**Arquitetura:** servidor guarda rascunho versionado por usuário; perfil e pesagens continuam nas tabelas atuais. Rascunho não é dado aplicado. Revisão confirma escritas reais. Tutorial usa telas e navegação existentes; usuários antigos podem aceitar ou dispensar a jornada. Sem dependências novas, publicação ou migration de produção implícitas.

## Evidência local

- `lib/auth/sessao.ts`: `exigirUsuario` exige acesso aprovado e garante perfil. Não alterar aprovação ou confirmação de e-mail nesta fase.
- `lib/auth/acompanhamento.ts`: `exigirContaPropria` impede que o cadastro pessoal opere no contexto de um aluno acompanhado. Todas as Server Actions da jornada devem usá-lo e recuperar identidade no servidor.
- `lib/dal/perfil.ts`: `obterPerfil` e `atualizarPerfil`; `perfilSchema` valida campos atuais.
- `lib/dal/corpo.ts`: `salvarPesagem` faz upsert por usuário/data. Chamá-la sem revisão pode sobrescrever uma pesagem existente; a jornada precisa comparar e pedir decisão explícita antes de substituir.
- `app/(app)/ajustes/actions.ts`: padrão de sessão, validação e revalidação. Evitar invocar uma Action de outra Action como mecanismo de reutilização; reutilizar validação/DAL e conferir permissões específicas.
- `lib/db/index.ts`: Drizzle com driver Neon HTTP. Não presumir transações interativas. Finalização atômica precisa ser desenhada e verificada com os recursos reais desse driver, não implementada com várias gravações soltas.
- `lib/marca.tsx`: `Logotipo`, `IconeKalyft`. `app/(app)/barra-abas.tsx`: House, Utensils, Dumbbell, ChartNoAxesCombined e Settings2 de Lucide. A quinta aba real é Conta, não a aba Ajuda inventada pela prévia.
- `components/ui.tsx`: `Campo`, `Opcoes` e controles existentes. Reutilizar tokens de `app/globals.css`, fontes e estados. Sem wordmark redesenhado ou símbolos Unicode da prévia.
- Guias instalados lidos: `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` (autorização dentro de cada Server Action).

## Mapeamento das respostas

| Resposta da prévia | Destino e regra proposta |
|---|---|
| Nome, nascimento, sexo, altura | `perfis`: nome, dataNascimento, sexo, alturaCm. Normalizar “preencher depois” para ausência; não apagar dados existentes por pular. Revisar mudanças antes de aplicar. |
| Peso e data | `pesagens`: pesoKg e data, com `pesagemSchema`. Exigir data explícita para criar medição. Se já existir na data, comparar e pedir confirmação; preservar massa magra/cintura que não foram editadas. |
| Nível de atividade | `perfis.nivelAtividade` após revisão. Rotina/exercício atual são contexto, não gatilho para aplicar um fator silenciosamente. IA existente é opcional e precisa de consentimento. |
| Área/prioridade, objetivo | Novo estado da jornada. Objetivo não equivale a meta nutricional. Não passar ganho de massa/peso para o fluxo atual de déficit. |
| Trabalho/deslocamento, exercício atual | Novo rascunho e preferências estruturadas. Não contar disponibilidade de treino como atividade já realizada. |
| Experiência, local, equipamentos, dias e tempo | Novas preferências; plano real continua no fluxo de treino existente, com revisão própria. |
| Preferências, restrições, alergia, rotina alimentar | Preferências privadas estruturadas, com finalidade de personalização; não inferir segurança de alergênicos. Não publicar no banco de alimentos. |
| Peso-meta | Rascunho até revisão no fluxo de metas; nunca criar histórico de meta apenas por avançar no cadastro. |
| Tutorial/marcos | Estado por usuário no servidor. Marcos reais dependem de evento confirmado; concluir tutorial não prova aprendizado ou execução de treino/refeição. |

## Sequência de entregas

### 2A — base de dados e regras da jornada (primeira implementação proposta)

Entrega autônoma: salvar/ler rascunho com isolamento, versão e conflitos. Sem nova tela pública, alterações do perfil ou aplicação de metas/pesagens.

**Arquivos propostos:**

- Criar `lib/jornada.ts`: tipos e regras puras de passos aplicáveis, campos opcionais e transições.
- Criar `lib/validacao/jornada.ts`: esquemas de entrada e saída com limites, enums e rejeição de campos extras. Reutilizar validadores de números/datas existentes.
- Criar `lib/dal/jornada.ts`: `obterJornada(userId)`, `iniciarJornada(userId)` e `salvarEtapaJornada(userId, entrada)`, conforme contratos abaixo. Importar `server-only`, validar identificador e filtrar por usuário em todas as operações.
- Alterar `lib/db/schema.ts`: tabela `jornadas_iniciais` proposta abaixo; não adicionar campos soltos a `perfis` para cada resposta da prévia.
- Gerar próxima migration em `drizzle/` e metadados pelo fluxo existente. Conferir o número disponível no momento; outra frente pode gerar migrations. Incluir permissões do papel da aplicação. Não executar em produção nesta entrega.
- Criar `tests/jornada.test.ts`, `tests/validacao-jornada.test.ts`, `tests/banco/jornada.test.ts`.

**Tabela proposta `jornadas_iniciais`:**

| Campo | Contrato |
|---|---|
| user_id | UUID, PK e FK de `perfis.userId`, exclusão em cascata. Uma jornada por pessoa. |
| versao | Inteiro, versão do contrato de produção (não a versão do protótipo). |
| revisao | Inteiro >= 0 para controle otimista de duas abas; começa em 0. |
| estado | `em_andamento`, `adiada` ou `concluida`, com CHECK. |
| etapa | Enum textual validado dos passos da jornada, com CHECK. |
| rascunho | JSONB com esquema estrito; contém respostas ainda não aplicadas. Tamanho máximo proposto de 16 KB em UTF-8. Não aceitar texto livre clínico ou objetos arbitrários. |
| preferencias | JSONB com esquema próprio; recebe somente preferências confirmadas, sem duplicar perfil/pesagem após finalização. |
| tutorial | JSONB versionado: estado `nao_iniciado`, `em_andamento`, `pulado` ou `concluido` e passo permitido. Pular não perde marcos. |
| criado_em/atualizado_em/concluido_em | Timestamps com fuso; conclusão nullable e definida pelo servidor. |

**Contrato proposto de salvamento:** entrada `{ versao, revisaoEsperada, etapa, respostas }`. Identidade vem da sessão nas Actions futuras, nunca do formulário. Retorno discriminado: `{ status: 'salvo', revisao }`, `{ status: 'conflito', revisao }` ou `{ status: 'inexistente' }`. Erros de validação são erros por campo, sem ecoar payload em logs.

**Passos de execução e aceitação:**

1. Escrever testes de caminhos alimentação/treino/ambos, opcionais, datas e vírgula antes do modelo. Comprová-los falhando pela ausência da implementação e depois passando.
2. Implementar tipos, transições e validação. Dado omitido significa não informado, nunca zero, “sedentário” ou confirmação falsa.
3. Gerar/revisar migration no ambiente de desenvolvimento/teste; verificar constraints, FK e permissões. Não apagar tabelas existentes nem renumerar migrations de outra frente.
4. Implementar DAL. Criação idempotente com conflito de PK tratado; atualização usa `where user_id = sessão and revisao = esperada`, incrementando revisão na mesma instrução. Não sobrescrever versão mais nova silenciosamente.
5. Testar usuários A/B, consulta e atualização isoladas, ausência de linha, duas abas com mesma revisão (apenas uma avança), repetição da criação, payload inválido e cascata ao remover perfil fictício do teste.
6. Rodar testes unitários, testes de banco apenas no branch de teste autorizado, lint e typecheck. Se banco de teste não estiver disponível, reportar explicitamente a falta de evidência e não afirmar isolamento testado.

Comandos de validação propostos:

```text
npx vitest run tests/jornada.test.ts tests/validacao-jornada.test.ts
npm run test:banco
npm run lint
npm run typecheck
```

Não introduzir Server Action pública nesta 2A. Contratos e DAL serão consumidos pela 2B, que verificará sessão e aprovação em cada chamada. Ainda não executar finalização que escreva perfil e pesagem.

### 2B — cadastro real e primeira ação

Após a base, criar `app/(app)/comecar/page.tsx`, `actions.ts` e componentes de formulário por capítulo na mesma pasta; criar componente comum de Kalu com fallback e movimentos aprovados, sem copiar iframes da prévia como arquitetura final. Converter a lógica de animação existente preservando desenho/piscadas; validar custo e transparência antes de integrar todas as poses.

`page.tsx` lê estado e dados próprios no servidor. Actions propostas: salvar etapa, adiar e confirmar revisão; cada uma chama `exigirContaPropria`, valida Zod e só então DAL. Após erro não avançar nem celebrar. Ao salvar etapa, informar sucesso/erro; fechar a página retoma a última etapa realmente salva. Não enviar requisição por tecla nem persistir dados sensíveis em armazenamento local.

Oferecer convite em Hoje e opção de retomar em Conta, sem bloquear usuário antigo ou redirecionar toda a aplicação. Não alterar login/aprovação. Comparar dados existentes na revisão e permitir escolher o que atualizar. Finalização precisa conferir versão do rascunho e mudanças concorrentes no perfil/pesagem; aplicar tudo atomicamente ou não concluir. A estratégia SQL/driver deve ser especificada antes dessa implementação. Não apagar métricas de composição corporal por campos ausentes no formulário.

Peso/objetivo e preferências coletados não autorizam geração automática de planos. Meta/plano devem usar os fluxos atuais de confirmação. Para objetivo de ganho de massa/peso, indicar configuração manual/orientada enquanto a adaptação própria estiver pendente; não abrir sugestão de emagrecimento.

Testar autorização de Actions, contexto de acompanhamento bloqueado, usuário sem aprovação, retomada, dados antigos, erro de salvamento e submissão repetida. Validar iPhone, 320/390/430 px, temas, foco, teclado e movimento reduzido. Usar `Logotipo`, Lucide e `Campo`/`Opcoes` existentes. Trilha conecta somente os espaços entre círculos, conforme ajuste aprovado.

### 2C — tutorial nas telas reais

Criar controlador compartilhado `components/tutorial-inicial.tsx` e regras em `lib/tutorial-inicial.ts`; integrar no layout apenas para conta própria e quando o tutorial for solicitado. Adicionar alvos estáveis `data-tour` aos elementos escolhidos das páginas reais, sem localizar por texto ou posição CSS.

Roteiro permitido: `/hoje`, `/comida` e/ou `/treino`, `/progresso`, `/ajustes`. Reutilizar `BarraAbas`; não criar sexta aba nem trocar Conta por Ajuda. Kalu global permanece etapa separada; o tutorial pode indicar a ajuda que efetivamente existir na versão entregue.

Sempre oferecer voltar, avançar e pular, sem impedir ações normais. Se alvo não existir, mostrar explicação útil sem prender foco em elemento ausente. Aguardar alvo/carregamento com limite e tratar navegação manual como saída do passo, com retomada acessível em Conta. Preservar preferência de movimento reduzido e não cobrir o controle destacado. Persistir pular/concluir; nenhuma recompensa depende de assistir.

## Fora deste escopo imediato

IA global, enriquecimento compartilhado de alimentos, cálculo de metas para ganho, registro esportivo/gasto por modalidade e redesign geral de Progresso continuam nos próximos passos. Este plano não reimplementa essas frentes. A opção de objetivo no cadastro é coleta de intenção, não entrega das regras de ganho de massa.

## Revisão antes de publicar

Seguir `docs/SEGURANCA.md`, incluindo relatório por endpoint, isolamento, `npm audit`, busca por segredos e limitações. Não imprimir variáveis ou payloads de saúde. Deployment/migration de produção exigem etapa própria, depois de código e testes revisáveis. Nenhum desses checks foi executado como prova de código novo nesta entrega documental.

## Situação

- [x] Inspecionar fontes e campos existentes.
- [x] Mapear respostas e riscos de sobrescrita.
- [x] Definir arquivos, tabela, contratos e aceitação da 2A.
- [x] Separar 2B e 2C para execução posterior.
- [x] Implementar 2A após aprovação do plano, conforme regra local. (16/11/2026, Claude Code: migration 0025, `lib/jornada.ts`, `lib/validacao/jornada.ts`, `lib/dal/jornada.ts`, testes; relatório `docs/relatorios/fase11a-seguranca.md`. Só dev/test.)
- [x] 2B — cadastro real e primeira ação (16/11/2026, Claude Code: `/comecar`, revisão com finalização atômica, convite no Hoje, acesso em Conta; Kalu em poses estáticas; relatório `docs/relatorios/fase11b-seguranca.md`. Só dev/test.)
- [ ] 2C — tutorial nas telas reais.
