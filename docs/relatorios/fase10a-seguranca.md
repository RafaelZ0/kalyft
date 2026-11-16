# Kalyft – Fase 10A: tabela de composição do IBGE na base de alimentos – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 16/11/2026. Escopo: importar as 1.971 linhas (1.121 alimentos) da tabela oficial do IBGE "Tabelas de
Composição Nutricional dos Alimentos Consumidos no Brasil" (POF 2008-2009) para `alimentos_base`, com a fonte e a
referência de cada valor visíveis. Motivo: "bolo de cenoura" e "rosquinha" não existiam na TACO.
Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção** (migration 0024, importação e
deploy aguardam aprovação do dono).

## 1. Dados e origem

- Arquivo oficial do FTP do IBGE com SHA-256 registrado (zip e xls). Transcrição para CSV por script versionado
  (`scripts/converter-ibge-pof.py`); o importador confere o SHA-256 do CSV antes de gravar.
- Validação completa antes de gravar (cabeçalho, códigos únicos, referência conhecida, faixas físicas). Qualquer
  erro aborta tudo; a gravação é uma transação única (fonte + itens).
- Nenhum valor foi inventado ou estimado. Os dois ajustes (azeite e banha, acima do limite físico por arredondamento)
  ficam marcados com o valor original.
- A tabela é **só leitura** para o app: a gravação usa o papel dono do banco, como a TACO.

## 2. Mudanças no app

| Parte | Verificação |
|---|---|
| Migration 0024 | `alimentos_base` aceita `fonte in ('taco','ibge')`; novas colunas `referencia` (≤ 300) e `sodio_adicao_mg` (0–40.000) com CHECK |
| Busca (`buscarAlimentos`) | mesma consulta parametrizada; empate favorece a TACO; devolve a fonte para o rótulo da lista |
| Detalhe do alimento | mostra a fonte, a referência ("De onde vêm estes valores"), o sódio de adição à parte e a citação correta |
| Registro | sem mudança: snapshot calculado pelas gramas, como qualquer alimento da base |

Nenhuma rota, Server Action ou permissão nova.

## 3. Testes

| Suíte | Resultado |
|---|---|
| Unidade | novos: 5 (convenção "-", nome legível, ajuste ao limite, arquivo real com 1.971 itens e referências, linhas inválidas recusadas) |
| Banco (`test`) | novos: 4 (busca de bolo de cenoura e rosquinha como IBGE, TACO preservada, detalhe com referência/sódio de adição/citação, cálculo do registro) |
| Totais | unidade 550, banco 337, `tsc`, `eslint`, `next build` sem erros |

Conferência visual do detalhe do "Bolo de cenoura" (fonte, valores, origem, medidas do IBGE e citação).

## 4. `npm audit`

Nenhuma dependência nova no app. `xlrd` 2.0.1 (Python) foi usado só para converter o arquivo, num ambiente isolado
fora do projeto.

## 5. Segredos e código provisório

Nenhum segredo novo. Nenhum código provisório.

## 6. Riscos residuais

1. **Licença não explícita** do IBGE ("© IBGE. 2011"); cerca de 89% dos valores vêm da base comercial NDSR.
   Decisão do dono: usar citando a fonte e mostrando a origem. Confirmar com o IBGE antes de uso comercial.
2. **Equivalências:** vários itens usam os valores de um alimento parecido (ex.: rosquinha doce = biscoito maisena).
   A tela mostra a referência para a pessoa julgar.
3. Nomes vêm da planilha sem acentos em alguns casos (ex.: "Milho (em grao)"); a busca ignora acentos, então não
   afeta a localização.
4. Alimentos parecidos podem aparecer na TACO e no IBGE; cada um mostra a fonte, e o empate na busca favorece a TACO.

## 7. Como testar no iPhone (depois do deploy)

Comida → Adicionar → buscar "bolo de cenoura" e "rosquinha": aparecem com "IBGE (POF 2008-2009)". Abra o bolo:
confira "De onde vêm estes valores" e a medida "fatia média · 60 g"; adicione e veja no diário.

## 8. Publicação (precisa de aprovação)

1. `npm run db:migrar:producao` (migration 0024).
2. `npm run ibge-pof:importar -- --alvo producao --confirmar`.
3. Push.
