# Kalyft – Fase 9C: resumo semanal com próximo passo – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 15/11/2026. Escopo: leituras do resumo ("o que dá para dizer" e "o que ainda não dá para concluir"), escolha
de um passo pequeno por semana e medição do cumprimento. Situação: pronta e testada nos branches `dev` e `test`;
**ainda não está em produção** (migrations 0019 e 0020 e deploy aguardam aprovação do dono).

## 1. Rotas e Server Actions

| Rota / Action | Verificações no servidor |
|---|---|
| `/progresso/semana` (alterada) | `exigirContextoDados()`; contagens da semana calculadas no servidor só para o `user_id` do contexto |
| `escolherPassoSemana` | Sessão e contexto de acompanhamento; **a semana é calculada no servidor** (só "atual" ou "próxima"; o cliente não manda datas); sugestão aceita só tipos da lista com alvo inteiro de 1 a 7 e refeição apenas no tipo "refeição"; passo livre de 3 a 120 caracteres, limpo de controles |
| `removerPassoSemanaAcao` | Sessão, contexto; apaga só o do próprio usuário |

As frases e sugestões são **regras fixas sobre os números do relatório**, sem IA. As sugestões nunca propõem comer
menos, cortar ou perder peso (teste dedicado). A medição usa dados registrados (dias com registro, refeições,
pesagens, treinos feitos, dias com proteína/água na meta); sem meta, proteína e água não são medidas.

### Banco (migrations 0019 e 0020)

`passos_semana`: chave (user_id, início); `CHECK` de segunda-feira, de tipo, de coerência (livre = texto sem
alvo; mensurável = alvo 1–7 sem texto) e de refeição só no tipo "refeição"; gatilho de auditoria do acompanhamento.
**Defeito encontrado e corrigido nos testes:** a primeira versão dos `CHECK` aceitava valores nulos (no Postgres, um
CHECK que resulta em NULL passa). A 0020 refaz as duas restrições com `is not null` explícito; o teste cobre cada
caso. As duas migrations vão juntas para produção.

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 12 (leituras com e sem dados, aviso de peso × consumo sem acusar, lacunas, sugestões por lacuna e alvo ≤ 7, sem proteína/água sem meta, passo de manutenção, nenhuma sugestão de restrição, medição, frases sem cobrança) |
| Banco (`test`) | novos: 12 (contagens reais e isolamento, escolha sugerida/livre/refeição, 6 entradas recusadas sem alterar o gravado, remoção só do próprio, tela renderizada com andamento, CHECKs) |
| `tsc`, `eslint` (código do app), `next build` | sem erros |

Conferência visual no tamanho de celular, sem rolagem lateral. Ajuste feito depois da conferência: no domingo, a
semana ainda não terminou (frase "até agora" em vez de "bom avanço").

## 3. `npm audit`

Nenhum pacote novo.

## 4. Segredos e código provisório

Nenhum segredo novo. O texto do passo livre não vai para logs nem para a IA.

## 5. Regras não cumpridas ou parciais (riscos residuais)

1. **Passo livre não é medido** (só lembrado), por ser texto aberto.
2. **Leituras são regras simples**; o texto opcional da IA (Fase 7A) continua separado e com as mesmas proteções.
3. Os alvos sugeridos são escolha minha (um pouco acima do que a pessoa fez, até 7), revisáveis.

## 6. Como testar no iPhone (depois do deploy)

1. **Progresso → Resumo da semana**: veja "O que dá para dizer" e "O que ainda não dá para concluir".
2. Escolha um passo para esta semana (ou escreva o seu) e acompanhe "X de N até agora".
3. Na semana seguinte, abra a semana anterior e veja o resultado; escolha o próximo passo.

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** migrations 0017 a 0020 e deploy.
- Fases 9D e 9E em sequência.
