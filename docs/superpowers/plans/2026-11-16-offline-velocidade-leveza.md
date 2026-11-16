# Próximos passos — sem internet, abertura instantânea, velocidade e leveza

16/11/2026. Pedido do dono: registrar como próximos passos (ainda **não iniciado**). Antes de qualquer código, cada
fase terá plano detalhado e aprovação, como manda o `CLAUDE.md`.

## Objetivos

1. **Funcionar sem internet:** abrir o app e consultar o que já foi visto (Hoje, diário, treino do dia) mesmo sem
   conexão, e não perder um registro feito offline.
2. **Abertura instantânea:** guardar no aparelho as telas e os arquivos mais usados, para o app abrir sem esperar
   a rede.
3. **Mais velocidade:** telas mais rápidas de carregar e de responder ao toque.
4. **Mais leve e estável:** menos código e menos dados por tela, para reduzir travamentos e bugs.

## Primeiro: medir (fase O0)

Nada será otimizado no escuro. Medidas iniciais:

- tempo até a tela aparecer e até responder ao toque (Hoje, Comida, Treino, Progresso), no iPhone e no
  desenvolvimento;
- tamanho do JavaScript e do CSS enviados por tela (relatório do build do Next);
- consultas ao banco por tela (quantidade e tempo) e tempo das Server Actions mais usadas;
- erros no navegador e no servidor (logs do Vercel).

Resultado: uma lista ordenada pelo que mais pesa, que define as fases seguintes.

## Fases propostas

| Fase | Escopo | Observações |
|---|---|---|
| **O1 — Leveza** | remover código e dependências sem uso; dividir componentes grandes de cliente; enviar menos dados às telas; revisar consultas repetidas (cache por requisição) | reduz bugs e acelera tudo |
| **O2 — Velocidade** | carregar primeiro o essencial de cada tela e o resto em seguida; reduzir idas ao banco; pré-carregar as telas mais usadas | conferir as APIs atuais do Next 16 na documentação instalada antes de usar |
| **O3 — Abertura instantânea** | service worker (já existe para as notificações) guardando o "esqueleto" do app e os arquivos estáticos; telas recentes mostradas do aparelho enquanto atualizam | cuidado: nunca mostrar dados de outra conta (limpar ao sair) |
| **O4 — Sem internet** | leitura offline do que já foi carregado; fila de registros feitos offline (refeição, água, peso, série do treino) enviados quando a conexão voltar, com aviso claro de "pendente" | o mais delicado: conflitos, duplicatas e sessão expirada; cada registro offline passa pelas mesmas validações no servidor ao sincronizar |

## Cuidados (segurança e saúde)

- Dados de saúde guardados no aparelho só o necessário, apagados ao sair da conta; nada de segredos no cache.
- O servidor continua sendo a fonte da verdade: tudo o que vier da fila offline é validado de novo (sessão, Zod,
  limites), como qualquer Server Action.
- Cálculos e metas continuam vindo do servidor; offline, a tela avisa que os números podem estar desatualizados.

## A verificar antes de começar (hipóteses)

- Ferramentas do Next 16 para offline e cache (a documentação instalada cita um `useOffline` experimental e a
  biblioteca Serwist para service worker): conferir versão, estabilidade e compatibilidade com a CSP do app.
- Limites do iPhone para armazenamento de web apps instalados.
