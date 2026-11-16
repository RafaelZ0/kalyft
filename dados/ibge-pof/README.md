# IBGE – Tabelas de Composição Nutricional dos Alimentos Consumidos no Brasil (POF 2008-2009)

- **Publicação:** IBGE, Coordenação de Trabalho e Rendimento. *Pesquisa de orçamentos familiares 2008-2009: tabelas de
  composição nutricional dos alimentos consumidos no Brasil*. Rio de Janeiro: IBGE, 2011. ISBN 978-85-240-4194-5.
- **Arquivo oficial:** `tabelacompleta.zip` (contém `tabelacompleta.xls`), do FTP do IBGE:
  `https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/`
  - SHA-256 do zip: `3aa01426f16f8041ce830de2dda7e5003806b437917cb829f8cefe84a0ac21e0`
  - SHA-256 do xls: `e75487405593196fe551d58e934e415e840f33f78acd0af08ed61bedb957c7ac`
- **Transcrição usada pelo app:** `composicao.csv` (UTF-8, `;`), gerado por `scripts/converter-ibge-pof.py` (Python 3 +
  `xlrd` 2.0.1, só na máquina de quem importa). SHA-256: `73b08f34b088cb55a3cfef0ef6fdc353a48ad2b21de7efafec29f1af5911673b`.
  Valores transcritos sem alteração (até 6 casas); o importador arredonda para 2 casas, como a coluna do banco.
- **Conteúdo:** 1.971 linhas (alimento + forma de preparo), 1.121 alimentos. Valores por 100 g de parte comestível.
  Colunas usadas: energia, proteína, lipídeos totais, carboidrato, fibra, sódio e sódio de adição.

## Convenções e decisões

| Situação | Como o Kalyft guarda |
|---|---|
| `-` (publicação: "dado numérico igual a zero não resultante de arredondamento") | 0, marcação `-` |
| vazio | desconhecido (null) |
| Gordura pura acima do limite físico só por arredondamento (azeite: 100,43 g de gordura; banha: 902 kcal) | limite (100 g / 900 kcal), marcação `limite` com o valor original; acima de 1% do limite, a importação falha |
| Sódio | `sodio_mg` = coluna "sódio" (sódio do alimento, como na TACO). "Sódio de adição" (sal estimado do preparo) fica à parte em `sodio_adicao_mg` e **não** é somado |
| Fonte de referência de cada linha | `referencia` = "Fonte: descrição na referência" (ex.: "TACO: Biscoito, doce, maisena") |

## Fontes de referência (contagem de linhas)

NDSR (University of Minnesota) 1.752 · TACO 127 · mista 51 · Ministério da Saúde 20 · rótulos 10 · Pacheco 5 ·
Naves 4 · Martins 1 · INPA 1. Os valores são **equivalências** escolhidas pelo IBGE (ex.: "Rosquinha doce" usa
"Biscoito, doce, maisena" da TACO; "Bolo de cenoura" usa "Cake, carrot, homemade" da NDSR). A tela mostra a
referência de cada alimento.

## Termos de uso

A página de créditos traz apenas "© IBGE. 2011", sem frase de permissão de reprodução, e as páginas de termos do IBGE
recusaram o acesso automático. **A licença não está explícita.** O dono decidiu (16/11/2026) usar os dados citando a
fonte e mostrando a origem de cada valor, mesma postura das medidas do IBGE (`dados/ibge/`). Antes de uso comercial,
confirmar com o IBGE, inclusive sobre os valores originados da NDSR, que é uma base comercial.

Importação: `npm run ibge-pof:importar -- --alvo dev` (ver `scripts/importar-ibge-pof.mjs`).
