# Kalyft – Fase 11B (entrega 2B do plano de integração da jornada): cadastro guiado real – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 16/11/2026. Escopo: tela `/comecar` com o cadastro guiado em etapas (Kalu, trilha, voltar, "Agora não",
continuar depois), revisão com escolha do que aplicar e finalização atômica no perfil e nas pesagens; convite no
Hoje e acesso em Conta. Plano: `docs/superpowers/plans/2026-11-16-integracao-jornada-real.md` (seção 2B), aprovado
pelo dono ("continue"). Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção**
(migration 0025 e deploy aguardam aprovação).

## 1. Rotas e Server Actions

Todas em `app/(app)/comecar/actions.ts`, todas com `exigirContaPropria()` (no acompanhamento de aluno redireciona
para `/hoje?acompanhamento=pessoal`; teste com contexto real de acompanhamento).

| Rota / Action | Verificações no servidor |
|---|---|
| `/comecar` | sessão (conta própria); só a jornada do `user_id` da sessão; etapa pedida pela URL só se estiver no caminho **e** já alcançada (não dá para pular etapas pela URL) |
| `iniciarJornadaAcao`, `adiarJornadaAcao` | sessão; criação idempotente; adiar não mexe no rascunho |
| `salvarEtapaAcao` | sessão; `etapa`/`revisao` com Zod; só os campos conhecidos da etapa são lidos do formulário; validação estrita por etapa; grava só com a revisão esperada (aba antiga → "conflito", nada sobrescrito); "Agora não" só nas etapas puláveis |
| `finalizarJornadaAcao` | sessão; Zod; **os valores aplicados vêm do rascunho guardado no servidor**, o formulário só diz quais campos trocar e o que fazer com a pesagem; os valores "atuais" que a tela mostrou são conferidos de novo |
| `/hoje` (convite) | só na conta própria; some ao adiar ou concluir |

## 2. Finalização atômica (sem transações interativas no driver HTTP)

Uma única instrução SQL com CTEs que modificam dados: a jornada só passa a "concluída" se (a) a revisão for a
esperada, (b) os campos do perfil ainda tiverem os valores que a tela mostrou (`is not distinct from`) e (c) a
pesagem na data estiver como a tela mostrou. Perfil e pesagem só são alterados **a partir** da linha da jornada
atualizada. Ou tudo, ou nada (testado: perfil ou pesagem alterados em "outra aba" → nada aplicado).

Regras: campo não informado nunca apaga; valor diferente do atual começa desmarcado; sexo "informar depois" não
altera; pesagem só com peso **e** data; pesagem existente exige escolher manter ou trocar (trocar preserva massa
magra e cintura, e é bloqueado se a massa magra for maior que o novo peso). Metas e plano de treino **não** são
criados; o peso de referência fica só como preferência.

## 3. Interface

- Kalu em WebP estático (320/640 px, cerca de 22–55 KB, alpha preservado, sem fundo); fala em texto real; imagem
  decorativa (`alt=""`); entrada suave só sem "reduzir movimento". Animações (cerca de 2,5 MB cada) ficaram de fora
  por custo.
- `/kalu/*` fora do proxy (arquivos públicos estáticos, sem dados).
- Campos numéricos sem setinhas (teclado decimal/numérico), alvos de toque ≥ 44 px, erros por campo.
- Nenhum dado da jornada em `localStorage`, cookies ou logs.

## 4. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 6 (plano de aplicação: só informado, iguais ignorados, diferentes desmarcados, sexo "depois", pesagem sem data/nova/igual/existente, massa magra; preferências sem duplicar perfil) |
| Banco (`test`) | novos: 23 — finalização (12: aplica só o marcado, nunca apaga, pesagem nova/desmarcada/sem data/manter/trocar preservando massa magra, **perfil alterado em outra aba**, **pesagem criada em outra aba**, revisão antiga, campo fora do plano, entrada inválida, incompleta, isolamento A/B, adiar/retomar) e telas/Actions (11: convite, adiar, percurso completo, erros por campo, voltar com valores, sem pular pela URL, "Agora não", **aba antiga com conflito**, revisão, conclusão, concluída imutável, **recusa no acompanhamento com contexto real**) |
| Totais | unidade 582, banco 375, `tsc`, `eslint`, `next build` sem erros. Na primeira rodada completa do banco, 3 testes de lembretes (9F, não alterados) falharam por tempo/rede; isolados passaram (17/17) e a segunda rodada completa passou inteira |

Conferência visual no tamanho do iPhone (modo escuro): foco, revisão, conclusão e convite no Hoje.

## 5. `npm audit`

Nenhuma dependência nova.

## 6. Segredos e código provisório

Nenhum segredo novo; nenhum código provisório; respostas nunca vão para log (`registrarErro` só registra contexto).

## 7. Riscos residuais e pendências

1. Kalu sem animação (decisão de custo); as poses vêm de `design/kalu/preparacao/limpos`, com a observação do Codex
   de que a limpeza de bordas ainda não está certificada.
2. Tutorial nas telas reais (2C) ainda não existe; a conclusão não promete o passeio.
3. Reabrir uma jornada concluída para refazer ainda não existe (rever as escolhas é só leitura em `/comecar`).
4. Ainda não testado em iPhone real (320/390/430 px, temas claro/escuro, teclado e leitor de tela).

## 8. Como testar no iPhone (depois do deploy)

Hoje → "Monte seu começo com o Kalu" → percorra as etapas (teste "Agora não" e "Voltar"), feche o app no meio e
reabra: continua de onde parou. Na revisão, confira o que vai para a conta, confirme e veja o primeiro marco.

## 9. Publicação (precisa de aprovação)

1. `npm run db:migrar:producao` (migration 0025).
2. Push.
