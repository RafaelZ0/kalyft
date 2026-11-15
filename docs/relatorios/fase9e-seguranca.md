# Kalyft – Fase 9E: planejamento da semana e lista de compras – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 15/11/2026. Escopo: planejar receitas, refeições salvas e alimentos por dia/refeição; "Comi isso" para
registrar; lista de compras somada dos ingredientes com marcação e itens avulsos; repetir a semana passada.
Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção** (migration 0022 e deploy
aguardam aprovação do dono).

## 1. Rotas e Server Actions

Todas as páginas usam `exigirContextoDados()`; todas as escritas passam por `executarAcaoAcompanhada()`.

| Rota / Action | Verificações no servidor |
|---|---|
| `/comida/planejar`, `/comida/planejar/adicionar`, `/comida/planejar/compras` (novas); `/comida` (bloco "Planejado") | semana normalizada para segunda-feira e limitada a 8 semanas para trás e 4 para frente; dados só do `user_id` do contexto |
| `planejarItem` | Zod (refeição, tipo da lista, uuid, quantidade: porções 0,5–10 ou gramas 1–5.000), data dentro da janela; **limite de 4 itens por refeição/dia aplicado na própria inserção**; receita, refeição salva e alimento do usuário protegidos por **chave composta** (de outra pessoa o banco recusa) |
| `comiIsso` | Só item do próprio usuário, só no dia planejado ou depois; **nutrientes recalculados do banco** (receita: porções × peso final ÷ rendimento, pelo alimento gerado da receita; refeição salva: cada item × vezes; alimento: gramas); a marcação "consumido" é condicional (só se ainda não estava), o que **impede registrar duas vezes**; se a gravação falhar, a marcação é desfeita |
| `removerPlanejadoAcao`, `repetirSemanaAcao` | uuid / semana calculada no servidor; repetir só copia para semana vazia e dentro da janela |
| `alternarCompradoAcao`, `adicionarAvulsoAcao`, `alternarAvulsoAcao`, `removerAvulsoAcao` | chave do item validada por expressão (`base|usuario:` + uuid); texto avulso limpo, 1 a 80 caracteres, até 40 por semana (na própria inserção); só itens do próprio usuário |

**Planejado nunca conta como consumido** sem o toque em "Comi isso"; o diário mostra o bloco "Planejado" à parte,
com o aviso.

### Banco (migration 0022)

- `refeicoes_planejadas`: chaves compostas para `receitas`, `refeicoes_salvas` e `alimentos_usuario`; FK para
  `alimentos_base`; `CHECK` de coerência por tipo (com `is not null` explícito, aprendido na 9C) e de faixa da
  quantidade; refeição e data.
- `compras_itens`: `CHECK` de segunda-feira, de chave **ou** texto (com formato da chave e tamanho do texto);
  índice único por (usuário, semana, chave).
- Gatilhos de auditoria do acompanhamento nas duas (editados à mão).

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 9 (proporção da receita, vezes da refeição salva, gramas por porção, soma da lista por alimento, separação base × usuário, ordenação por grupo, arredondamento de compra, semana, janela de semanas e datas) |
| Banco (`test`) | novos: 16 (planejar 3 tipos sem tocar no diário, limite de 4, 6 entradas recusadas incluindo alimento de outra pessoa, "Comi isso" com cálculo e sem duplicar, refeição salva e alimento, futuro e outra pessoa recusados, soma real da lista, marcação/avulsos/isolamento, CHECKs, telas da semana/diário/compras, repetir semana só para semana vazia) |
| `tsc`, `eslint` (código do app), `next build` | sem erros |

Conferência visual da semana e da lista de compras no tamanho de celular, sem rolagem lateral.

## 3. `npm audit`

Nenhum pacote novo.

## 4. Segredos e código provisório

Nenhum segredo novo.

## 5. Regras não cumpridas ou parciais (riscos residuais)

1. **Lista de compras em gramas** do alimento como está na tabela (ex.: arroz *cozido*); não converte para o
   produto cru nem para embalagens. O texto da tela diz que é a soma do planejado.
2. **Receita sem alimento gerado** (apagado em Meus alimentos) não pode ser registrada pelo "Comi isso" até a
   receita ser salva de novo; a tela avisa.
3. **Duas abas** tocando "Comi isso" ao mesmo tempo: a marcação condicional garante um só registro.
4. Limites (4 por refeição, janela de semanas, 40 avulsos) são escolha minha, revisáveis.

## 6. Como testar no iPhone (depois do deploy)

1. **Comida → Planejar a semana**: em um dia, **Planejar** → escolha uma receita (porções com − e +), uma refeição
   salva ou um alimento (busca + gramas).
2. Abra **Lista de compras**: marque itens como comprados e adicione um avulso.
3. No dia, em **Comida**, veja o bloco **Planejado** e toque em **Comi isso**: o item entra no diário com os
   valores da tabela e fica "Comido" no planejamento.
4. Na semana seguinte vazia, **Repetir a semana passada**.

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** migrations 0017 a 0022 e deploy (migrations antes do push).
- **9F (lembretes)** fica só no plano até o dono decidir as dependências externas.
