# Kalyft — kit de identidade C

Conceito C e composição símbolo + nome aprovados em 13/11/2026. Este kit é o redesenho vetorial de produção do estudo aprovado. As curvas e o letreiramento foram reconstruídos para uso consistente; não se trata de conversão automática pixel a pixel da imagem gerada.

## Arquivos

- `logo-claro.svg`: símbolo vermelho e nome grafite, fundo transparente.
- `logo-escuro.svg`: símbolo e nome brancos, fundo transparente.
- `logo-monocromatico.svg`: versão preta, fundo transparente.
- `simbolo-vermelho.svg`, `simbolo-branco.svg`, `simbolo-preto.svg`: símbolo isolado.
- `icone-app.svg`: ícone com fundo vermelho e cantos arredondados.
- `icone-maskable.svg`: ícone de fundo integral, com símbolo dentro da área circular segura central de 80% do quadro.
- `favicon.svg`: versão compacta com fundo vermelho.
- `prancha-vetorial.svg`: apresentação dos arquivos reconstruídos.
- PNGs: logos claro/escuro com 2320 px de largura; símbolo com 800 px; ícones de 512 e 192 px; favicon de 32 px; prancha de 1400 px.

## Cores

| Papel | HEX | RGB |
|---|---|---|
| Vermelho da marca | #C83C32 | 200, 60, 50 |
| Grafite | #202321 | 32, 35, 33 |
| Fundo quente | #F7F5F2 | 247, 245, 242 |
| Branco | #FFFFFF | 255, 255, 255 |

Para interfaces, as cores de texto, foco, preenchimento e erro terão tokens específicos para cada tema; a paleta da logo não substitui a verificação de contraste dos componentes.

## Uso

Preferir o logo completo em apresentação, login e página pública. Usar símbolo em cabeçalhos compactos e ícone na instalação do app. Sobre fundo escuro, usar a versão branca. Os SVGs não incluem fontes ou imagens externas: todo o desenho está em contornos.

Área livre mínima: 20% da altura do símbolo em todos os lados. Tamanho mínimo recomendado inicialmente: símbolo de 24 px de largura; logo horizontal de 140 px. Em 16 px, preferir favicon com fundo. Esses limites são recomendações de partida e devem ser confirmados na interface real e nos aparelhos.

Não esticar, girar, separar peças, alterar proporções, adicionar brilho, sombras, relevo ou dourado. Não separar “ft” por cor. Manter contraste com o fundo e evitar fotos movimentadas diretamente atrás do desenho.

O ícone maskable mantém fundo até as bordas para o recorte feito pelo sistema. Não substituir esse arquivo pelo ícone de cantos arredondados em campos que exigem maskable.

## Reprodução e manutenção

`gerar-kit.py` contém os desenhos originais e gera todos os SVGs sem dependências externas. Os PNGs foram exportados com Sharp já disponível no projeto. O letreiramento é uma construção geométrica própria para esta composição, não uma fonte para textos da interface.

A prancha foi inspecionada visualmente. Os SVGs foram renderizados em PNG; a produção do aplicativo ainda precisa validar a aplicação em dispositivos reais. Os arquivos não foram ligados ao aplicativo nem publicados nesta etapa.

Domínio e disponibilidade de marca continuam pendentes de verificação. A aprovação estética não equivale a comprovação de exclusividade.
