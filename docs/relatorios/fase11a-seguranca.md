# Kalyft – Fase 11A (entrega 2A do plano de integração da jornada): rascunho da jornada inicial – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 16/11/2026. Escopo: base de dados e regras para salvar e retomar a jornada inicial (cadastro guiado), com
isolamento por pessoa, versão e proteção contra conflito entre abas. Plano:
`docs/superpowers/plans/2026-11-16-integracao-jornada-real.md` (seção 2A), aprovado pelo dono ("vamos continuar").
Situação: pronta e testada nos branches `dev` e `test`. **Sem tela, sem Server Action pública e sem produção.**

## 1. O que foi criado

| Parte | Verificações |
|---|---|
| `lib/jornada.ts` (regras puras) | etapas aplicáveis por caminho (alimentação, treino, ambos); antes do foco, só o foco; revisão/início só com foco e objetivo; trocar a área remove as respostas da área que saiu; "Agora não" = etapa vazia (diferente de não visitada) |
| `lib/validacao/jornada.ts` | Zod estrito por etapa (campos extras recusados); reaproveita os validadores do app (vírgula decimal, datas até hoje, limites); vazio = não informado, nunca zero; **sem texto livre além do nome** (limitação, alergia e restrição são opções fechadas); rascunho guardado validado de novo na leitura |
| `lib/dal/jornada.ts` | `server-only`, `exigirId`, tudo filtrado pelo `user_id` recebido (da sessão, na 2B); `iniciarJornada` idempotente; `salvarEtapaJornada` grava só com `where user_id = ? and revisao = esperada and estado <> 'concluida'` e incrementa a revisão na mesma instrução; respostas: `salvo`, `conflito` (com a revisão atual), `inexistente`, `encerrada`, `etapa_indisponivel`, `invalido` (erros por campo, sem ecoar o conteúdo) |
| Migration 0025 | tabela `jornadas_iniciais` (PK = `user_id`, FK para `perfis` com cascata); CHECKs de versão, revisão ≥ 0, estado, etapa, conclusão ↔ data (com `is not null` explícito), tipo e tamanho dos JSONB (rascunho ≤ 16 KB, preferências ≤ 8 KB, tutorial ≤ 2 KB com estado válido); gatilho de auditoria do acompanhamento (editado à mão). Permissões do papel do app: pelo `ALTER DEFAULT PRIVILEGES` da Fase 1 (`docs/BANCO.md`) |

**Nada é aplicado:** o rascunho não altera perfil, pesagens nem metas (teste prova). A finalização com revisão fica
para a 2B.

Diferença em relação ao contrato do plano: além de `salvo`, `conflito` e `inexistente`, há `encerrada` (jornada
concluída não aceita salvamentos), `etapa_indisponivel` e `invalido` (validação).

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 26 (caminhos, ordem, disponibilidade, aplicação das respostas, validação de cada etapa, vírgula, datas, opções, campos extras, contrato do salvamento e do rascunho guardado) — escritos antes e vistos falhando |
| Banco (`test`) | novos: 15 (sem jornada, criação idempotente, `user_id` inválido, salvar e avançar, nada aplicado no perfil/pesagens, entrada inválida/versão/`userId` extra, etapa fora do caminho, troca de área, **duas abas simultâneas: só uma avança**, revisão antiga, **isolamento A/B**, concluída, adiada, CHECKs inclusive NULL e tamanho, cascata) |
| Totais | unidade 576, banco 352, `tsc`, `eslint`, `next build` sem erros |

## 3. `npm audit`

Nenhuma dependência nova.

## 4. Segredos e código provisório

Nenhum segredo, nenhum código provisório, nenhum log com respostas.

## 5. Riscos residuais e pendências

1. Sem Server Action ainda: a 2B precisa chamar `exigirContaPropria` em cada Action e passar só o `user_id` da sessão.
2. O limite de tamanho no app (12 KB) é menor que o do banco (16 KB), porque o banco mede o texto do jsonb com
   espaços extras.
3. Estados `adiada`/`concluida` e o tutorial ainda não têm funções de escrita (2B/2C).
4. Produção: migration 0025 só com aprovação, junto da 2B (sem tela, a tabela não é usada).
