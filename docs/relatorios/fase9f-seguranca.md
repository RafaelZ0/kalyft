# Kalyft – Fase 9F: lembretes – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 15/11/2026. Escopo: lembretes escolhidos pela pessoa (refeição, água, pesagem, treino) por Web Push no app
instalado, com "não avisar se já fiz", pausa, adiar 30 min e "hoje não". Agendador: GitHub Actions a cada 15 min
(o Vercel Hobby só permite cron diário). Junto: atualização do `@neondatabase/auth` para 0.7.0-beta.

## 1. Rotas e Server Actions

| Rota / Action | Verificações no servidor |
|---|---|
| `/ajustes/lembretes` (nova) e faixa da notificação no layout | `exigirContaPropria()` (lembretes e aparelhos são pessoais; recusado no acompanhamento) |
| `criarLembreteAcao`, `atualizarLembreteAcao`, `apagarLembreteAcao` | Zod (tipo da lista, refeição obrigatória só para refeição, hora 0–23, minuto 0/15/30/45, dias como bits válidos); `where id and user_id`; **limite de 10 conferido na própria inserção**; repetido recusado pela chave única |
| `pausarTodosAcao`, `adiarLembreteAcao`, `hojeNaoAcao` | só 1/3/7 dias; adiamento calculado no servidor (agora + 30 min); só lembrete do próprio usuário |
| `salvarInscricaoAcao` | limite por usuário (20/h); endpoint **só `https://` de serviços de push conhecidos** (Apple, Google, Mozilla, Microsoft; sem porta, sem usuário, sem imitação de domínio) — impede usar o servidor para chamar endereços internos; chaves em base64url com tamanho limitado; até 5 aparelhos |
| `removerInscricaoAcao`, `conferirInscricaoAcao` | só a inscrição desta conta |
| `enviarTesteAcao` | 5 por hora; só para os aparelhos da própria conta |
| `POST /api/lembretes/enviar` (nova, fora do proxy) | só com `Authorization: Bearer CRON_SECRET`, comparado em tempo constante (hash SHA-256 + `timingSafeEqual`); segredo ausente ou com menos de 32 caracteres nunca confere; sem cookie (sem CSRF); resposta só com contagens e `no-store`; sem chaves VAPID → 503 sem detalhes |

**Consultas de sistema** (várias contas) ficam isoladas em `lib/dal/lembretes-envio.ts`, usado só pela rota do
agendador: apenas contas **aprovadas** com aparelho inscrito; leem só "já fez ou não" (refeição registrada,
pesagem, treino, água × meta).

### Envio
- **Reserva antes de enviar** (`lembretes_envios`, chave lembrete+data+minuto+adiado): duas execuções ao mesmo
  tempo enviam uma vez só; reenvio só até 60 min depois do horário.
- Textos neutros, **sem números nem dados de saúde** (a notificação passa pelo serviço de push do aparelho);
  carga cifrada pelo padrão Web Push (`web-push`).
- Inscrição apagada quando o serviço responde 404/410. Endpoint e chaves nunca vão para log (`registrarErro` só
  registra contexto e tipo do erro).
- Service worker (`/sw.js`): só `push` e `notificationclick`, sem cache; abre **apenas caminhos do próprio site**
  (recusa `//` e URLs externas); CSP própria e `no-cache`.

### Banco (migration 0023)
- `inscricoes_push`: endpoint único (aparelho que troca de conta passa para a conta nova), `CHECK` de `https://` e
  tamanhos.
- `lembretes`: `CHECK` de tipo × refeição com `is not null` explícito, minuto 0–1425 em passos de 15, dias 1–127;
  única por (usuário, tipo, refeição, minuto) com `NULLS NOT DISTINCT`.
- `lembretes_envios`: chave composta para `lembretes (id, user_id)`; limpeza automática após 30 dias.
- Gatilhos de auditoria do acompanhamento nas três (editados à mão).

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 13 (horário de São Paulo, bit do dia, minuto válido, textos, vencimento com tolerância, virada da meia-noite, dias/ativo/pausas, adiado, "já fiz", textos sem números, caminho interno, pausa, **endpoint de push**: 4 aceitos e 11 recusados, incluindo IP interno e imitação de domínio) |
| Banco (`test`) | novos: 17 (criar/editar/apagar/validação, isolamento entre contas, limite de 10, pausar/retomar, CHECKs inclusive NULL, tela, inscrição válida/inválida, troca de conta, limite de aparelhos, envio só para conta aprovada, sem repetir, execuções simultâneas, "já fiz" com pesagem, água × meta, pausa do lembrete, pausa 9A, adiado, inscrição expirada, rota 401/503) |
| `tsc`, `eslint` (código do app), `next build` | sem erros |

## 3. `npm audit` (produção)

- **Antes:** 1 crítico e 3 altos (better-auth < 1.7.7: sessão de outra pessoa via estado OAuth e OAuth Proxy;
  zod < 4.6.6 dentro do pacote do Neon).
- **Depois:** `@neondatabase/auth` 0.7.0-beta + `overrides` fixando `better-auth`/`@better-auth/*` 1.7.25,
  `better-call` 1.4.5 para o plugin OAuth e `zod` igual ao do app. Restam **7 baixos e 4 moderados**: drizzle-kit/esbuild (só desenvolvimento)
  e e-mails da interface de login do Neon que o app não usa. O `npm ls` aponta diferença de versão só de
  dependência opcional (`better-call`) dentro da interface do Neon, que o app não importa.
- **Pacote novo:** `web-push` 3.6.7 (MPL-2.0, mantido pela Mozilla, estável desde 01/2024) e `@types/web-push`
  (dev). A 4.0.0 saiu em 06/11/2026; fica para depois.

## 4. Segredos e código provisório

- Novas variáveis: `VAPID_PUBLIC_KEY` (pública por natureza, entregue ao navegador pela página), `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (URL do site, sem e-mail pessoal), `CRON_SECRET` (32 bytes aleatórios). Pares diferentes em dev
  e produção, gerados com gerador criptográfico, **nunca impressos**.
- GitHub: segredos `CRON_SECRET` e `LEMBRETES_URL` cadastrados pelo `gh`, sem exibir o valor. O workflow tem
  `permissions: {}` e não imprime o segredo.
- Nada de segredo commitado (`.env*` no `.gitignore`).

## 5. Riscos residuais

1. **Atraso do GitHub:** execuções agendadas podem atrasar; envio aceito até 60 min. Em repositório público, o
   GitHub desliga agendamentos após 60 dias sem atividade (avisa por e-mail; basta reativar).
2. **Botões dentro da notificação** não são usados (não garantidos no iPhone); adiar/"hoje não" ficam na faixa da
   tela aberta pela notificação.
3. **Aparelho compartilhado:** a inscrição pertence à última conta que ativou naquele aparelho.
4. `@neondatabase/auth` segue em beta; os `overrides` devem ser revistos quando sair uma versão do Neon com
   better-auth ≥ 1.7.7.
5. Ainda não testado em iPhone real (Web Push exige o app instalado e iOS 16.4+).

## 6. Como testar no iPhone (depois do deploy)

1. Abra o Kalyft **pelo ícone da tela de início** → Conta → **Lembretes** → **Ativar notificações neste
   aparelho** → Permitir.
2. **Enviar teste**: deve chegar em segundos.
3. **Novo lembrete** para daqui a 15–30 min (ex.: Água) → aguarde; toque na notificação: abre o app com a faixa
   "Lembrar em 30 min / Hoje não".
4. Registre a água até a meta e confira que o próximo lembrete de água não toca.

## 7. Pendências

- Cadastrar as variáveis no Vercel (Production) antes do deploy; migration 0023 em produção antes do push.
- Primeira execução manual do workflow "Lembretes" no GitHub para conferir a resposta da rota.
