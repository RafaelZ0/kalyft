# Kalyft – Fase 8: fotos de progresso do corpo – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 23/10/2026. Escopo: fotos de progresso (SPEC 3.8), guardadas no próprio banco. Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção** (a migration 0015 e o deploy aguardam aprovação).

## 1. Rotas e Server Actions

| Rota / Action | O que faz | Autorização |
|---|---|---|
| `GET /api/fotos-corpo/[id]` (Route Handler novo) | Entrega o JPEG | Sem sessão: 401. `id` validado como uuid. A busca é por `(id, user_id)` da sessão: foto de outra pessoa, inexistente ou id inválido dão o mesmo 404. Cabeçalhos: `image/jpeg`, `Cache-Control: private, no-store`, `nosniff`, `Cross-Origin-Resource-Policy: same-origin` |
| `/progresso/fotos` (página) | Lista, comparação (até 2 ids na URL), envio e exclusão | `exigirUsuario()`; os ids da comparação passam por filtro de uuid e só valem se forem do usuário |
| `enviarFotoCorpo` (Action) | Grava a foto | Sessão; Zod (data ISO ≥ 2000-01-01 e **não futura**, posição `frente/lado/costas`, nota limpa e cortada em 200); arquivo conferido **pelos bytes** (estrutura JPEG íntegra: começo, segmentos, quadro e fim); metadados (APP1–APP15 e comentários) **removidos de novo no servidor**; tamanho (1 KB a 500 KB) e dimensões (200 a 4000 px) |
| `excluirFotoCorpoAcao` (Action) | Apaga | Sessão; uuid; `DELETE … WHERE id AND user_id` |

Nada disso chama a IA. Nenhum dado da foto vai a serviço externo.

### Banco (migration 0015)

Tabela `fotos_corpo`: `user_id` com FK para `perfis` (`ON DELETE CASCADE`: apagar a conta apaga as fotos), chave `(id, user_id)`, `CHECK`s de posição, data, nota (≤ 200) e tamanho (1 KB a 500 KB **e igual ao tamanho real dos bytes**). O limite de 60 fotos é aplicado **na inserção, no banco**: uma transação pega uma trava por usuário (`pg_advisory_xact_lock`) e só insere se a contagem for menor que 60. Papel `fuelift_app` com os privilégios padrão das tabelas do usuário.

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unitários | **379 passam** (novos: 14 – limpeza de EXIF/GPS/XMP/ICC/comentário, recusa de PNG, PDF, texto, truncado, sem quadro, segmento maior que o arquivo, tamanhos e dimensões) |
| Banco, branch `test` | **240 passam** (novos: 10) |
| `tsc`, `eslint`, `next build` | Sem erros nem avisos |

Os testes de banco cobrem: bytes gravados **sem** "Exif", "GPSLatitude" ou nome de aparelho; PNG/texto/data futura/posição inválida/data antiga/sem arquivo recusados; isolamento (listar, baixar, comparar e apagar foto de outra pessoa não funcionam); rota com 200 e cabeçalhos corretos para o dono, 404 para outro usuário, uuid inexistente e ids maliciosos (`../../etc/passwd`, `1 or 1=1`), 401 sem sessão; `CHECK`s do banco (dono inexistente, posição, data, nota, tamanho que não bate); **61ª foto recusada**; **8 envios simultâneos com 57 fotos gravam exatamente 3**; o limite de uma pessoa não afeta a outra; exclusão só da própria foto; apagar o perfil apaga as fotos.

## 3. `npm audit`

Nenhum pacote novo. Igual às fases anteriores (4 moderadas, 5 altas; 4 moderadas e 0 altas sem as dependências de desenvolvimento).

## 4. Segredos e código provisório

Nada de segredo novo, nenhuma chave nova, nenhum serviço novo. Nenhuma URL pública nem assinada.

## 5. Regras não cumpridas ou parciais (riscos residuais)

1. **A foto fica no banco sem criptografia própria da aplicação.** Quem tiver acesso administrativo ao banco (a conta do Neon) vê os bytes. A proteção é a mesma dos demais dados: isolamento por `user_id`, papel sem privilégio de dono, conexão criptografada e backup do Neon. Se quiser mais, o próximo passo seria criptografar no servidor com uma chave só do Vercel (as fotos ficariam ilegíveis mesmo com acesso ao banco), ao custo de complexidade e de perder a chave = perder as fotos. Não foi feito.
2. **Os metadados são removidos no aparelho e de novo no servidor**, mas o servidor só garante a remoção de segmentos de metadados do JPEG; não analisa o conteúdo da imagem (rosto, fundo, objetos). A tela avisa que a foto é pessoal.
3. **Backup:** as fotos entram no backup do Neon, e a exclusão não apaga o que já estiver em backups antigos até eles expirarem.
4. **Consumo:** 60 fotos × até ~400 KB ≈ 15–25 MB por pessoa; vale vigiar o tamanho do banco (plano gratuito do Neon) se houver muitos usuários. O limite por pessoa é a constante `LIMITES_FOTO_CORPO.maximo`.
5. A rota não tem limite de requisições por IP; exige sessão e a imagem é pequena, mas um usuário logado poderia baixar muitas vezes as próprias fotos.

## 6. Como testar no iPhone (depois do deploy)

1. **Progresso → Fotos de progresso → Nova foto**: escolha uma foto da galeria (ou tire na hora), a posição e o dia, e salve.
2. Confira que a foto aparece na lista com a data, a posição e o peso daquele dia (se houver pesagem).
3. Toque em **Comparar** em duas fotos: elas aparecem lado a lado no topo.
4. **Excluir** uma foto e confirmar que sumiu.
5. Abra o endereço de uma foto (`/api/fotos-corpo/…`) em uma janela anônima: deve pedir login (não mostra a imagem).

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** aplicar a migration 0015 e fazer o deploy (migration antes do push).
- Conferir no aparelho: fotos (esta fase), passo a passo do Atalhos (Fase 6), câmera do código de barras (Fase 4) e os fluxos da Fase 7.
- Opcional: criptografia das fotos no servidor; limite de downloads por IP.
- Antigas: importar o backup do "Meu Treino"; e-mail próprio (SMTP) no Neon Auth; licenças do IBGE e do Open Food Facts antes de vender; plano pago do Gemini para uso comercial; base compartilhada entre usuários; nova logo.
