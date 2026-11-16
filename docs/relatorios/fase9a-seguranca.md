# Kalyft – Fase 9A: minha rotina e retomar de hoje – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 14/11/2026. Escopo: **Minha rotina** (alimentos habituais no Hoje, registro em um toque) e **Retomar de hoje** (cartão após dias sem atividade e marcação de pausa no calendário). Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção** (migration 0017 e deploy aguardam aprovação).

## 1. Rotas e Server Actions

Nenhum Route Handler novo. Toda leitura usa `exigirContextoDados()` e toda escrita passa por `executarAcaoAcompanhada()` (sessão válida, aprovação, contexto conferido; em modo leitura do acompanhamento nada é gravado).

| Action | Verificações no servidor |
|---|---|
| `registrarDaRotina` | Zod (tipo `base`/`usuario`, uuid, refeição da lista, gramas de 1 a 5.000); **data = hoje no servidor** (o cliente não escolhe o dia); alimento buscado de novo no banco (TACO ou do próprio usuário) e **nutrientes recalculados na hora** (snapshot), nunca vindos do histórico; limite de 10.000 kcal por item |
| `ocultarDaRotinaAcao` | Zod; alimento do usuário protegido pela chave composta `(id, user_id)` (alimento de outra pessoa é recusado pelo banco); repetir não duplica (índice único) |
| `reexibirNaRotinaAcao` | uuid; `DELETE … WHERE id AND user_id` |
| `marcarPausaAcao` | **Sem datas vindas do cliente**: o período é recalculado no servidor a partir da última atividade; limitado a 90 dias; sem pausa detectada, nada é gravado; repetir só ajusta o fim |

Páginas alteradas: `/hoje` (cartões "Sua rotina" e "Vamos retomar"; `?rotina=` só aceita as cinco refeições), `/treino/calendario` (estado "pausa"), `/comida/meus-alimentos` (itens escondidos da rotina).

### Banco (migration 0017)

- `rotina_ocultos`: dono com FK `ON DELETE CASCADE`; chave composta para `alimentos_usuario`; `CHECK` de exatamente um alimento e de refeição válida; índices únicos por usuário/refeição/alimento.
- `pausas`: dono com FK; `CHECK` de fim ≥ início, período < 90 dias e data ≥ 2000; único por (usuário, início).
- **Gatilho de auditoria do acompanhamento** nas duas tabelas (editado à mão na migration, como na 0016): escrita de administrador só com edição autorizada e sempre registrada no histórico.

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 22 (horário → refeição, hora de São Paulo, hábito por dias distintos, mediana, ocultos por refeição, limite, nome mais recente, − e +, pausa, limite de 90 dias, calendário com pausa) |
| Banco (`test`) | novos: 11 (hábito e isolamento, **recálculo do snapshot**, recusa de alimento de outra pessoa/porção/refeição inválidas sem gravar, ocultar/reexibir e isolamento, CHECKs, cascata ao apagar alimento, última atividade, cartão de retomar renderizado com dados reais, pausa recalculada no servidor ignorando datas enviadas, CHECKs da pausa, auditoria e recusa no acompanhamento) |
| `tsc`, `eslint`, `next build` | sem erros |

Conferência visual: Hoje renderizado com dados do banco de teste e o CSS do app, no tamanho de celular, sem rolagem lateral e com alvos de toque ≥ 44 px.

## 3. `npm audit`

Nenhum pacote novo. Pendência anterior mantida: `better-auth` dentro de `@neondatabase/auth` 0.5.0-beta (falhas de OAuth/link mágico, recursos não usados pelo app); atualização para 0.7.0-beta fica em etapa própria.

## 4. Segredos e código provisório

Nenhum segredo novo. Nenhum dado de saúde em log; erros registram só contexto e tipo.

## 5. Regras não cumpridas ou parciais (riscos residuais)

1. **Hábito é estatística simples** (3 dias em 30, mediana da porção): pode sugerir algo que a pessoa não quer mais; mitigado com "Não mostrar" e com o registro exigindo o toque.
2. **Refeição pelo horário** usa faixas fixas; quem tem horários diferentes troca pelo chip.
3. **Pausa só no calendário de treino**: o resumo semanal e os gráficos não tratam a pausa de forma diferente (continuam mostrando "sem dados" nesses dias, sem cobrança).

## 6. Como testar no iPhone (depois do deploy)

1. **Hoje → Sua rotina**: confira se aparecem os alimentos que você registra sempre naquela refeição; ajuste com − e + e toque em Registrar. O item some e aparece em Refeições do dia.
2. Toque em "Não mostrar" e confira em Comida → Meus alimentos → "Escondidos da rotina" → "Mostrar de novo".
3. **Retomar**: depois de 3 dias sem registrar nada, o Hoje mostra "Vamos retomar". Marque a pausa e confira o calendário de treino (dias em cinza, "Pausa").

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** aplicar a migration 0017 e fazer o deploy (migration antes do push).
- Próximas fases aprovadas: 9B (adaptar o treino de hoje), 9C, 9D, 9E, 9F. Primeiro uso guiado fica com o Codex.

> **Atualização:** publicada em produção em 14/11/2026 (migrations aplicadas antes do deploy).
