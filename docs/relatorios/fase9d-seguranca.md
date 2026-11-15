# Kalyft – Fase 9D: "O que posso fazer com o que tenho?" – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 15/11/2026. Escopo: sugestões de refeição pela IA a partir de ingredientes, tempo, refeição e preferências,
com revisão antes de registrar ou salvar como receita. Situação: pronta e testada nos branches `dev` e `test`;
**ainda não está em produção** (migration 0021 e deploy aguardam aprovação do dono).

## 1. Rotas e Server Actions

| Rota / Action | Verificações no servidor |
|---|---|
| `/comida/sugestoes` (página nova) | `exigirContaPropria()` (IA é pessoal; indisponível no acompanhamento); aceite da IA; mostra antes do envio **exatamente o que vai para o Google** |
| `sugerirRefeicoes` | Sessão (conta própria), aceite da IA, `IA_SOMENTE_ADMIN`; Zod (tempo só 10/20/30/45, refeição da lista, preferências só da lista fixa, até 5); ingredientes limpos (sem `<>`, controles, quebras) e cortados em 300 caracteres, observação em 120; **o quanto falta da meta é calculado no servidor** e só vai se a pessoa marcar; limite diário atômico (10, tipo `sugestao`); falha do provedor devolve a cota; resposta vazia/ilegível conta como uso |
| Registrar / Salvar como receita | Reaproveitam `salvarRefeicaoIa` e `salvarReceita`, que **buscam cada alimento de novo no banco e recalculam os nutrientes**; nada é gravado pela sugestão em si |

**A IA não define nutrientes.** Cada ingrediente sugerido é casado com o banco (TACO ou do próprio usuário) pelo
mesmo mecanismo da Fase 5; ingrediente sem correspondência confiável aparece marcado e fica fora da soma até a
pessoa escolher um alimento. A resposta da IA é sanitizada: até 3 opções, 10 ingredientes, 6 passos, 3 trocas,
textos sem marcação nem quebras, gramas de 1 a 1.000, tempo de 1 a 240 min.

**Instrução à IA:** só ingredientes informados mais básicos de despensa; nunca jejum, dieta restritiva, pular
refeição ou comer muito pouco; sem conselho de saúde, sem promessa de peso, sem calcular calorias; entrada
delimitada e tratada como dado (injeção ignorada).

### Banco (migration 0021)

Só o novo tipo `sugestao` no `CHECK` de `uso_ia`.

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 8 (prévia exata do envio, limpeza e limites da entrada, preferências desconhecidas e meta zerada fora do envio, regras da instrução, sanitização de opções, ingredientes e textos com marcação, formato inválido) |
| Banco (`test`) | novos: 11 (envio só do pedido e casamento com a TACO sem gravar nada, meta calculada no servidor só quando marcada, injeção delimitada, 4 entradas recusadas sem chamar a IA nem gastar cota, falha devolve a cota e resposta inútil conta, sem aceite não chama, limite diário, página com a prévia) |
| `tsc`, `eslint` (código do app), `next build` | sem erros |

Conferência visual da tela de pedido no tamanho de celular, sem rolagem lateral. As telas de resultado reaproveitam
os componentes já testados da revisão da Fase 5 e do editor de receitas da Fase 7B.

## 3. `npm audit`

Nenhum pacote novo.

## 4. Segredos e código provisório

Nenhum segredo novo. Logs da IA só com contexto e tipo do erro, sem o texto do pedido.

## 5. Regras não cumpridas ou parciais (riscos residuais)

1. **Plano gratuito do Gemini**: o pedido pode ser lido por revisores e usado para melhorar produtos; a tela avisa
   e mostra o que vai. Não serve para uso comercial sem o plano pago.
2. **Qualidade das sugestões** depende da IA; o app limita formato e quantidade, mas não avalia o valor culinário.
   As calorias mostradas são estimativa pela tabela e exigem conferência.
3. **Restrições alimentares** são preferências marcadas, não garantia: o aviso pede conferência (alergias graves
   não devem depender da sugestão).

## 6. Como testar no iPhone (depois do deploy)

1. **Comida → Adicionar → O que posso fazer com o que tenho?** Escreva alguns ingredientes, escolha o tempo e
   confira a seção "O que será enviado ao Google".
2. Toque em **Sugerir refeições**; abra uma opção: veja ingredientes com o alimento da tabela, passos e trocas.
3. **Registrar**: confira e ajuste cada item (− e +) antes de salvar. **Salvar como receita**: o editor abre
   preenchido, sem salvar até você confirmar.

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** migrations 0017 a 0021 e deploy.
- Fase 9E (planejamento da semana e lista de compras).
