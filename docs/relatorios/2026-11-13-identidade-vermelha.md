# Repaginada Kalyft — entrega local

## Implementação

- Identidade vermelha aprovada, símbolo C e logotipo em contornos compartilhados pela interface e ícones de instalação.
- Paletas clara e escura, preferência Sistema/Claro/Escuro persistida por dispositivo. Sistema acompanha a preferência do aparelho em tempo real.
- Inicialização do tema antes da hidratação com nonce da CSP existente; nenhuma dependência remota para ícones/tema.
- Lucide React 0.555.0 fixado como dependência direta, aproveitando o pacote já existente no lockfile e no projeto.
- Navegação lateral no desktop, inferior no mobile, cabeçalho com aparência e atalho para pular ao conteúdo.
- Hoje com dados reais: calorias e macros, refeições, água com registro/desfazer, treino, peso/tendência, passos e detalhes do gasto.
- Alimentação, treino, progresso, conta, login e fluxos secundários harmonizados em superfícies, hierarquia e formulários.
- Contexto de acompanhamento, formulários e validações preservados; faixa de acompanhamento permanece visível em seu contexto.

## Evidências

| Verificação | Resultado |
|---|---|
| `npm test` | 435 testes, 32 arquivos, passaram |
| `npm run lint` | Passou |
| `npm run typecheck` | Passou |
| `npm run build -- --webpack` | Passou, todas as rotas geradas/compiladas |
| `git diff --check` | Passou |
| Ícones reais | Testes renderizam PNGs de 32, 192 e 512 px e verificam assinatura/dimensões |
| Aparência | Testes de preferência inválida, Sistema, escolha manual e armazenamento bloqueado |
| Navegador | Login da versão compilada em claro/escuro; escolha escura persistiu após reload; opção Sistema restaurada; layout mobile sem rolagem horizontal na janela observada |
| Revisão | Revisão independente sem regressão funcional prioritária; corrigida largura dos cartões do resumo semanal em tela pequena |

O build padrão com Turbopack falhou ao iniciar o subprocesso PostCSS no Windows (processo encerrou antes da conexão). A validação completa foi feita com o compilador Webpack suportado pela versão instalada; o script de build original foi mantido.

## Limites e continuidade

Não foi efetuado deploy ou push. As páginas autenticadas ainda precisam de inspeção visual com sessão local. Os testes de banco e testes em iPhone físico não foram repetidos: não houve mudança em banco, migrations, actions ou DAL. A revisão visual de login não comprova execução dos fluxos de câmera, importação, IA ou treino em aparelho real.

O escopo desta entrega é a identidade e a interface das capacidades existentes. Cobrança, assinatura, autosserviço comercial, documentos jurídicos e as demais funcionalidades de lançamento continuam no planejamento de produto, sem implementação nesta repaginada.

Arquivos de referência: `docs/DIRECAO-PRODUTO-E-DESIGN-KALYFT.md`, `design/marca/LEIA-ME.md` e `docs/superpowers/plans/2026-11-13-identidade-vermelha.md`.
