# Kalyft – Fase 9B: adaptar o treino de hoje – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 15/11/2026. Escopo: versão do treino que cabe no tempo disponível, pular ou trocar exercício, só para o dia.
Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção** (migration 0018 e deploy
aguardam aprovação do dono). Feita com a autorização do dono para seguir as fases em sequência durante a noite.

## 1. Rotas e Server Actions

| Rota / Action | Verificações no servidor |
|---|---|
| `/treino/adaptar` (página nova) | `exigirContextoDados()`; data validada (até hoje); sem plano ou sem treino no dia, volta para `/treino` |
| `salvarAdaptacao` | Sessão e contexto de acompanhamento (leitura não grava); Zod (data até hoje, minutos só 15/20/30/45/60, itens em JSON até 20 KB, até 60 itens, uuid, séries inteiras); a adaptação é **conferida contra o treino real do dia**: um ajuste por item do treino, séries de 1 até as previstas, troca só para substituto do plano ou exercício próprio do mesmo grupo, ao menos um exercício mantido; igual ao plano = remove a adaptação |
| `removerAdaptacaoAcao` | Sessão, contexto, data; apaga só a do próprio usuário |
| `/treino`, `/treino/sessao`, `/treino/calendario` (alteradas) | Aplicam a adaptação do dia; adaptação feita para outro treino (o treino do dia foi trocado) é ignorada; troca que deixou de ser válida volta ao exercício do plano |

**O plano nunca é alterado**: o teste confere que `treino_exercicios` fica igual depois de adaptar. As séries do
dia continuam sendo gravadas pelo fluxo existente (exercício do próprio usuário, conferido pelo banco).

### Banco (migration 0018)

`adaptacoes_treino`: chave (user_id, data); chave composta `(treino_id, user_id)` para `treinos` (o banco recusa
apontar para treino de outra pessoa); `CHECK` de minutos, de lista JSON com 1 a 60 itens e de data; gatilho de
auditoria do acompanhamento (editado à mão).

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 20 (estimativa de duração, cortes de séries e de exercícios, mínimo de séries, nunca tirar tudo, trocas mantidas, alternativas por grupo sem acento/maiúscula, validação de 8 entradas inválidas, aplicação com plano mudado) |
| Banco (`test`) | novos: 9 (séries da fase, gravação com troca e plano intacto, telas Treino/sessão/adaptar renderizadas com a versão do dia, recusa de 9 entradas inválidas sem alterar a gravada, igual ao plano remove, voltar ao completo só do próprio usuário, isolamento, chave composta, CHECKs, troca do treino do dia ignora adaptação antiga) |
| `tsc`, `eslint` (código do app), `next build` | sem erros |

Conferência visual: `/treino/adaptar` e `/treino` adaptado renderizados com dados do banco de teste, no tamanho
de celular, sem rolagem lateral; o seletor de troca foi movido para linha própria depois da conferência.

## 3. `npm audit`

Nenhum pacote novo. Pendência anterior mantida (`better-auth` dentro de `@neondatabase/auth` 0.5.0-beta).

## 4. Segredos e código provisório

Nenhum segredo novo; logs só com contexto e tipo de erro.

## 5. Regras não cumpridas ou parciais (riscos residuais)

1. **Duração é estimativa** (40 s por série, descanso cadastrado, 1 min entre exercícios); a tela diz isso.
2. **Ordem do plano como prioridade**: os exercícios cortados são os do fim; se o plano não estiver em ordem de
   importância, a pessoa recoloca manualmente.
3. **Troca por "mesmo grupo"** depende do campo grupo preenchido nos exercícios; sem grupo, só os substitutos.
4. O resumo semanal ainda não distingue treino adaptado (o calendário sim).

## 6. Como testar no iPhone (depois do deploy)

1. **Treino → Adaptar o treino de hoje**: escolha 20 min e confira as séries reduzidas e a estimativa.
2. Troque um exercício ("Trocar por outro…") e pule outro; toque em **Usar esta versão hoje**.
3. Confira a etiqueta "Adaptado para hoje" e comece o treino: o exercício trocado já vem escolhido.
4. **Voltar ao treino completo** em Adaptar desfaz.

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** aplicar a migration 0018 (junto com as seguintes) e fazer o deploy.
- Fases 9C, 9D e 9E em sequência (planos em `docs/superpowers/plans/2026-11-15-fases-9c-9f.md`).

> **Atualização:** publicada em produção em 15/11/2026 (migrations aplicadas antes do deploy).
