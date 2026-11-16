# Kalyft – Fase 11C (entrega 2C do plano de integração da jornada): passeio pelo app nas telas reais – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 17/11/2026. Escopo: passeio opcional pelas telas reais (Hoje, Comida e/ou Treino conforme a área escolhida,
Progresso, Conta), com destaque de um elemento por vez, voltar/próximo/pular, pausa ao navegar por conta própria e
estado guardado no servidor. Plano: `docs/superpowers/plans/2026-11-16-integracao-jornada-real.md` (seção 2C),
aprovado pelo dono ("continue"). Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em
produção** (só deploy; nenhuma migration nova — usa a coluna `tutorial` criada na 0025).

## 1. Rotas e Server Actions

`app/(app)/tutorial-actions.ts`, todas com `exigirContaPropria()` (recusado no acompanhamento de aluno; teste com
contexto real).

| Action | Verificações no servidor |
|---|---|
| `iniciarTutorialAcao` | sessão; roteiro calculado no servidor pela área da jornada; leva ao primeiro passo |
| `irParaPassoAcao` | sessão; `passo` validado com Zod **e** precisa estar no roteiro da pessoa (quem escolheu só alimentação não vai ao passo de treino) |
| `pularTutorialAcao`, `concluirTutorialAcao` | sessão; grava o estado; nenhum prêmio ou registro |

Estado validado (`tutorialSchema`: estado da lista, passo só quando "em andamento", sem campos extras) e também pelo
CHECK do banco. Estado inesperado vira "não iniciado" sem quebrar a tela. Quem nunca fez a jornada ganha uma linha
"adiada" só para guardar o passeio; o rascunho não é tocado.

## 2. Interface

- O passeio só é montado no layout para a conta própria e com estado "em andamento" (uma leitura por chave
  primária).
- Alvos por atributo estável `data-tour` (sem procurar por texto ou posição): `hoje-refeicoes`,
  `comida-adicionar`, `treino`, `progresso-peso`, `conta-passeio`.
- Destaque sem receber cliques (`pointer-events: none`): não impede ações normais. O cartão vai para o topo quando
  o alvo está embaixo; **conferido no navegador: alvo e cartão não se sobrepõem**, e o foco vai para o título do
  passo.
- Alvo inexistente: espera até 2,5 s, explica e permite seguir, sem prender o foco.
- Posições aplicadas pelo JavaScript depois de montar (CSSOM), compatível com a CSP; nenhum atributo `style` no HTML
  do servidor.
- Rolagem suave só sem "reduzir movimento". Voltar, próximo/concluir e pular sempre visíveis; Conta é a quinta aba
  (sem aba de Ajuda inventada).

## 3. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 5 (roteiro por área, rotas reais, vizinhos, estado guardado, estado inválido) |
| Banco (`test`) | novos: 8 (iniciar sem jornada, ir para passo e passo inválido, roteiro só alimentação, pular/concluir/estado inválido, isolamento A/B, marcações nas telas, convite no fim do cadastro, recusa no acompanhamento) |
| Totais | unidade 587, banco 383, `tsc`, `eslint`, `next build` sem erros. Na primeira rodada completa do banco, `energia` e `relatorio` (não alterados) falharam por instabilidade; isolados passaram (28/28) e a segunda rodada completa passou inteira |

Conferência no navegador (servidor de desenvolvimento, página temporária com o componente real, removida depois):
cartão, destaque, foco e não sobreposição no tamanho de celular.

## 4. `npm audit`

Nenhuma dependência nova.

## 5. Segredos e código provisório

Nenhum segredo. A página temporária de conferência e a exceção no proxy foram removidas antes do commit.

## 6. Riscos residuais

1. A tela Conta não pôde ser montada no teste de banco (importa o módulo de login do Neon); o alvo
   `conta-passeio` foi conferido no código.
2. Abrir o passeio pela Conta sem ter feito o cadastro esconde o convite do cadastro no Hoje (a jornada fica
   "adiada"); o cadastro continua em Conta → "Seu começo".
3. O Kalu global (ajuda em qualquer tela) é outra etapa; o passeio não promete essa ajuda.
4. Ainda não testado em iPhone real.

## 7. Publicação

Só push (sem migration), aprovado pelo dono ("continue").
