# Plano — base de alimentos ampliada e compartilhada

16/11/2026. **Somente análise e documentação.** Nenhum código, banco, migration ou dependência foi alterado.
Outro agente trabalha no protótipo do cadastro; este documento não substitui o plano central de continuidade.

Convenção usada no texto:

- **[Verificado]** — conferido no código do repositório (com o arquivo) ou por contagem somente-leitura no banco de
  **desenvolvimento** (sem dados pessoais; o banco de produção não foi consultado).
- **[Hipótese]** — proposta, suposição ou ponto que ainda precisa ser confirmado (licença, comportamento de fonte
  externa, decisão do dono).

Nenhum valor nutricional é proposto aqui. Os números que aparecem são contagens ou limites já existentes no código.

---

## 1. Situação atual

### 1.1 Onde os alimentos ficam

| Tabela | O que guarda | Quem escreve | Visível para |
|---|---|---|---|
| `alimentos_base` | TACO 4ª ed. (2011), por 100 g: kcal, proteína, carboidrato, gordura, fibra, sódio; `grupo`; `marcacoes` (jsonb com a marcação original da TACO e a fonte de complementos) | só o script `scripts/importar-taco.mjs`, com o papel dono do banco | todos (só leitura) |
| `fontes_alimentos` | fonte, edição, título, URL, termos de uso, citação, SHA-256 do arquivo | scripts de importação | todos |
| `alimentos_usuario` | alimento privado por pessoa, por 100 g, com `marca`, `origem` (`rotulo`, `ia_estimativa`, `codigo_barras`, `receita`) e `codigo_barras` opcional | a própria pessoa | só a dona |
| `produtos_barras` | cache **compartilhado** do Open Food Facts por código (sem `user_id`), com `incompleto` e `suspeito` | servidor, na consulta por código | servidor (a pessoa recebe uma cópia privada) |
| `medidas_ibge` | 605 medidas caseiras canônicas da POF 2008-2009 | script de importação | todos (sugestões) |
| `medidas` | medidas da pessoa por alimento ("minha concha = 140 g") | a própria pessoa | só a dona |
| `registros_alimentares` | diário com **snapshot** dos nutrientes calculados no registro e `origem` (`manual`, `ia_texto`, `ia_foto`, `codigo_barras`) | a própria pessoa | só a dona |

[Verificado: `lib/db/schema.ts`, `dados/taco/README.md`, `docs/SPEC.md` §4.]

### 1.2 Números da base (banco de desenvolvimento, contagem somente-leitura)

[Verificado em 16/11/2026]

- `alimentos_base`: **597** alimentos, todos da TACO. Sem kcal: 1; sem proteína: 2; sem fibra: 14; sem sódio: 10.
- Por grupo: Carnes 123 · Verduras/hortaliças 99 · Frutas 96 · Cereais 63 · Pescados 50 · Alimentos preparados 32 ·
  Leguminosas 30 · Leite 24 · Açucarados 20 · Bebidas 14 · Gorduras/óleos 14 · Nozes/sementes 11 · Miscelâneas 9 ·
  Ovos 7 · **Outros industrializados 5**.
- `fontes_alimentos`: `taco 4a-2011`, `usda sr-legacy` (só para complementos), `ibge pof-2008-2009`.
- `medidas_ibge`: 605 medidas.

O banco de produção pode ter as mesmas 597 linhas da TACO (mesmo script). Isso é **[Hipótese]**: não foi
consultado.

### 1.3 Como a busca funciona

[Verificado: `lib/busca.ts`, `lib/dal/alimentos.ts → buscarAlimentos`]

- O texto é normalizado (sem acento, minúsculas, só `a–z 0–9 %`) com até 6 palavras; o mesmo normalizador é usado
  na importação, no cadastro e na consulta.
- **Cada palavra** precisa aparecer no nome (`like`) **ou** ser parecida (`word_similarity ≥ 0,5`, pg_trgm, índice
  GIN em `nome_busca`).
- O universo pesquisado é **TACO + alimentos da própria pessoa**. Nada de outras pessoas, nada do cache do Open Food
  Facts (que só é acessado por código de barras).
- A ordem dá prioridade a: usados nos últimos 60 dias, depois favoritos, depois pontuação de semelhança, depois o
  nome que começa com a primeira palavra, e por fim o nome mais curto. Limite de 20 resultados.
- A refeição descrita para a IA (texto ou foto) usa a mesma busca para casar cada item com o banco
  (`lib/dal/refeicao-ia.ts → casarItens`). Ela tenta variações do nome, exige uma cobertura mínima das palavras
  significativas (`COBERTURA_MINIMA = 0,5`) e penaliza "cru" quando o pedido não diz cru
  (`lib/ia/refeicao.ts`).

### 1.4 Como os nutrientes são calculados

[Verificado: `lib/nutricao.ts`, `lib/barras.ts`]

- Todos os alimentos guardam valores **por 100 g**. O registro calcula `valor × gramas / 100`, com 2 casas.
- `null` significa **desconhecido**, nunca zero. Um alimento sem kcal **não pode** ser registrado
  (`calcularNutrientes` devolve `null`). Nos totais do dia, um nutriente faltando marca o total como **parcial**.
- O rótulo é convertido para 100 g pela porção (`paraPor100g`).
- Há duas checagens usadas no rótulo, no Open Food Facts e na estimativa da IA:
  - `problemasDeSanidade`: kcal entre 0 e 900, cada macro entre 0 e 100 g, e proteína + carboidrato + gordura até
    100,5 g. Os mesmos limites existem como CHECKs no banco.
  - `conferirEnergia`: as kcal precisam ficar perto de 4·P + 4·C + 9·G, com tolerância do maior valor entre 25% e
    30 kcal. Sem os três macros, a conferência não é feita.
- O carboidrato da TACO é por diferença e inclui fibra. Carboidrato negativo vira 0, e a marcação original é guardada
  (`dados/taco/README.md`).
- O registro guarda um **snapshot**: se o alimento mudar depois, o diário não muda (regra do `CLAUDE.md`).

### 1.5 Como um alimento novo entra hoje

[Verificado]

1. **Rótulo digitado** ou **rótulo lido pela IA** (`lib/ia/rotulo.ts`). Vira `alimentos_usuario`, origem `rotulo`.
2. **Código de barras**: consulta o Open Food Facts pelo servidor (`lib/off.ts`), com cache compartilhado em
   `produtos_barras`. O produto é marcado como `incompleto` ou `suspeito` (calorias que não fecham, soma de macros
   alta ou valor descartado por limite). Vira cópia privada com origem `codigo_barras`. Se o dado é suspeito ou
   incompleto, o destino é "conferir"; sem kcal, "cadastrar pelo rótulo".
3. **Estimativa da IA** de um alimento fora do banco (`app/(app)/comida/ia/actions.ts → estimarAlimento` e
   `confirmarEstimativa`):
   - a instrução pede valores típicos no Brasil, por 100 g, coerentes com 4/4/9, e até 4 medidas;
   - a resposta passa por `sanitizarEstimativa`, que recusa a estimativa sem kcal ou fora dos limites e marca
     `inconsistente`;
   - a tela avisa: "Estimativa da IA, por 100 g. Confira e ajuste os números antes de usar.";
   - só depois da confirmação da pessoa vira `alimentos_usuario`, origem `ia_estimativa`.
4. **Receita**: gera um alimento da pessoa com origem `receita`.

Nos quatro caminhos o resultado é **privado**. Não existe hoje nenhum caminho em que um alimento de uma pessoa
apareça para outra. O `docs/SPEC.md` §3.4 registra: "Fora do escopo desta fase: base compartilhada entre usuários
(comunidade). Se for feita, precisa de moderação, confirmação por outras pessoas e rótulo 'dado da comunidade'."

---

## 2. Lacunas comprováveis

| # | Lacuna | Evidência |
|---|---|---|
| L1 | Base oficial pequena para industrializados: só 5 alimentos no grupo "Outros alimentos industrializados" e 32 em "Alimentos preparados" | contagem do §1.2 |
| L2 | Alguns campos desconhecidos na TACO: 1 alimento sem kcal (não pode ser registrado), 2 sem proteína, 14 sem fibra, 10 sem sódio | contagem do §1.2; `dados/taco/README.md` cita o 591 (coco verde) sem kcal |
| L3 | A busca não encontra nada fora da TACO e dos próprios alimentos: um produto já consultado por código por outra pessoa não aparece pelo **nome** | `buscarAlimentos` só une `alimentos_base` e `alimentos_usuario` do `user_id` |
| L4 | Trabalho repetido: duas pessoas que comem o mesmo prato caseiro precisam cadastrá-lo (ou pedir à IA) separadamente | alimentos só privados (§1.5) |
| L5 | **A procedência se perde no diário.** O `origem` do registro não tem valor para "estimativa da IA" (só `manual`, `ia_texto`, `ia_foto`, `codigo_barras`), e o vínculo com o alimento da pessoa é `on delete set null`: se ela apagar o alimento estimado, o registro deixa de mostrar que os números eram uma estimativa | `registros_origem_check`; `drizzle/0003…` (FK `ON DELETE SET NULL`) |
| L6 | A procedência é por alimento, não por nutriente: um alimento da pessoa não diz qual campo veio do rótulo, qual foi estimado e qual foi ajustado | `alimentos_usuario` só tem `origem` (um valor) |
| L7 | Nenhuma prevenção de duplicata por nome: só por código de barras e por pessoa (`alimentos_usuario_codigo_key`). Nomes quase iguais convivem | `lib/db/schema.ts` |
| L8 | A estimativa da IA guarda o resultado sem a versão do modelo, da instrução e do pedido original. Não é possível auditar depois como o valor surgiu | `confirmarEstimativa` grava só nome, marca, nutrientes e `origem` |
| L9 | `alimentos_base` aceita só `fonte = 'taco'` por CHECK. Para receber outra fonte oficial é preciso uma migration | `alimentos_base_fonte_check` |
| L10 | Não há fluxo de moderação nem papel de revisor: o único papel especial é o administrador (`ADMIN_EMAILS`), usado para aprovar contas e para o acompanhamento | `lib/auth/sessao.ts` |

**[Hipótese]** Também podem existir lacunas de nomes regionais (por exemplo, nomes populares diferentes dos da TACO) e
de pratos típicos. Não foram medidas: falta um registro das buscas sem resultado (hoje isso não é registrado, e
registrar exigiria cuidado com privacidade).

---

## 3. Fontes possíveis

Uma fonte só entra com **licença verificada** e o arquivo guardado com SHA-256, como já é feito com TACO e IBGE.

| Fonte | Situação no Kalyft | Licença / termos | O que agregaria |
|---|---|---|---|
| TACO 4ª ed. (NEPA/UNICAMP) | em uso | [Verificado] "reprodução parcial ou total permitida, desde que citada a fonte" | base atual |
| USDA FoodData Central | usada só para 2 complementos | [Verificado no repositório] domínio público (`dados/taco/README.md`) | completar campos desconhecidos (L2); alimentos genéricos não brasileiros |
| Open Food Facts | em uso por código de barras | [Verificado no repositório] ODbL com atribuição; o `SPEC.md` §6 pede **verificar** a obrigação de compartilhar bases derivadas e o uso comercial | industrializados (L1, L3) |
| IBGE POF 2008-2009 (medidas referidas) | em uso | [Verificado no repositório] sem licença explícita; usar citando a fonte; confirmar antes de uso comercial | medidas caseiras |
| TBCA (Tabela Brasileira de Composição de Alimentos, USP/FoRC) | não usada | **[Hipótese]** termos de uso e possibilidade de redistribuição não verificados | alimentos e preparações brasileiras além da TACO |
| IBGE POF — tabelas de composição dos alimentos consumidos | não usada | **[Hipótese]** existência, formato e licença a verificar | pratos como consumidos no Brasil |
| Rótulo do produto (foto ou digitação pela pessoa) | em uso, privado | dado declarado pelo fabricante | industrializados sem código no Open Food Facts |
| Estimativa da IA | em uso, privada | não é fonte de referência: é **estimativa** | ponto de partida que a pessoa confere |

**Atualização 16/11/2026 (consulta às páginas oficiais):**

- **TBCA** (tbca.net.br, versão 7.x): mais de 5.700 alimentos, dos quais mais de 4.000 são preparações calculadas
  por receita padrão. Os termos dizem: "Não é permitida a reprodução total ou parcial do material", "Não é
  permitida a comercialização" e "Para fins comerciais, é necessário contatar os coordenadores". O site não tem
  download da base inteira nem API. **Conclusão: não pode ser importada sem autorização por escrito**
  (tbca.contato@usp.br).
- **Open Food Facts:** a busca por nome tem limite de "10 req/min/IP" e não serve para busca a cada tecla. Para
  volumes maiores, o projeto pede o uso do arquivo de exportação (CSV/JSONL). A licença é ODbL.
- **Teste real do dono:** "bolo de cenoura" e "rosquinha" não existem na TACO. A TACO tem bolos de aipim,
  chocolate, coco e milho, mas nenhuma rosquinha ([Verificado] no banco de desenvolvimento).

- **IBGE — POF 2008-2009, "Tabelas de Composição Nutricional dos Alimentos Consumidos no Brasil":** o arquivo
  oficial está no FTP do IBGE (`ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/
  Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/tabelacompleta.zip`, com
  `tabelacompleta.xls`). [Verificado] por leitura bruta do texto do arquivo, ele contém, entre outros, "BOLO DE
  CENOURA", "ROSQUINHA DOCE", "ROSQUINHA RECHEADA", "ROSCA DOCE", vários "BISCOITO" e colunas de energia (kcal),
  proteína, carboidrato, fibra, sódio e colesterol, com "Código e Fonte de Referência" por item. **[Hipótese]**
  termos de reuso (as páginas do IBGE recusaram o acesso automático) e o total de itens (falta um leitor de .xls).
- **IBGE POF — leitura completa (16/11/2026, com `xlrd` 2.0.1 isolado, fora do app):** [Verificado]
  - Publicação: IBGE, Coordenação de Trabalho e Rendimento, Rio de Janeiro, 2011, ISBN 978-85-240-4194-5. A página
    de créditos diz apenas "© IBGE. 2011", sem frase de permissão de reprodução. **A licença não está explícita.**
  - Valores "por 100 gramas de parte comestível". O traço "-" significa "dado numérico igual a zero não resultante
    de arredondamento" (convenções da publicação).
  - 1.971 linhas (alimento + forma de preparo) e 1.121 alimentos distintos. Colunas: energia, proteína, lipídeos
    totais, carboidrato, fibra, sódio, sódio de adição, minerais, vitaminas, colesterol, ácidos graxos, açúcar
    total e açúcar de adição.
  - Valores não numéricos são só "-" (zero): kcal 9, proteína 73, lipídeos 87, carboidrato 573, fibra 858, sódio 52.
  - **Fonte por linha:** NDSR (University of Minnesota, base comercial) 1.752; TACO 127; mista 51; Ministério da
    Saúde 20; rótulos 10; Pacheco 5; Naves 4; Martins (Portugal) 1; INPA 1.
  - **Os valores são equivalências, não análises do item brasileiro.** Exemplos: "BOLO DE CENOURA" = NDSR "Cake,
    carrot, homemade, without nuts, regular"; "ROSQUINHA DOCE" = TACO "Biscoito, doce, maisena"; "ROSQUINHA
    RECHEADA DE QUALQUER SABOR" = TACO "Biscoito, doce, recheado com chocolate".
  - Riscos: (1) licença do IBGE não explícita (mesma situação das medidas IBGE já usadas, registrada no `SPEC.md`
    §6); (2) cerca de 89% dos valores reproduzem uma base comercial (NDSR) publicada pelo IBGE, e o direito de
    redistribuir não está claro.

Regra proposta **[Hipótese, depende de aprovação]**: a estimativa da IA **nunca** vira dado oficial. Ela pode virar
dado compartilhado só como "dado da comunidade (estimativa revisada)", identificada como tal (§6).

---

## 4. Fluxo de contribuição proposto

**[Hipótese]** Nada disto existe no código.

1. **Descrever.** A pessoa descreve o alimento ("pão de queijo caseiro, médio"), opcionalmente com foto do rótulo
   ou código de barras.
2. **Procurar antes de criar.** O servidor procura na TACO, nos alimentos da pessoa e na base compartilhada
   aprovada (§7). Achando um candidato parecido, oferece usar o existente.
3. **Preparar o cadastro.** Sem candidato, a IA prepara um rascunho com nome padronizado, grupo, nutrientes por 100 g
   e medidas. Valem as mesmas regras da estimativa atual: limites físicos, conferência de energia (4/4/9) e o aviso
   "Estimativa da IA". O rascunho guarda o pedido original, o modelo e a versão da instrução (L8).
4. **Conferir.** A pessoa revisa campo por campo. Cada campo fica marcado como "estimado pela IA", "do rótulo" ou
   "ajustado por mim" (§6). Nada é salvo sem confirmação (`CLAUDE.md`).
5. **Uso privado imediato.** O alimento vira dela, como hoje (`alimentos_usuario`). Não depende de revisão.
6. **Oferecer à comunidade (opcional).** Uma caixa desmarcada por padrão: "Sugerir este alimento para outras
   pessoas". A sugestão vai para uma fila **sem identificar a pessoa** para quem a recebe. Ficam só um vínculo
   interno, para retirada, e a contagem.
7. **Revisão** (§5). Aprovado, entra na base compartilhada com a procedência. Recusado, continua privado.
8. **Retirada.** A pessoa pode retirar uma sugestão ainda não aprovada. Depois de aprovado, o dado fica, mas sem
   ligação com ela (decisão de privacidade a confirmar).

Pontos a decidir com o dono:

- quem revisa (só o administrador, ou revisores convidados);
- se uma confirmação de outras pessoas ("usei e os números batem com o rótulo") conta como sinal;
- termos de uso da contribuição (licença do dado compartilhado, compatível com ODbL se misturar com Open Food Facts).

---

## 5. Revisão dos nutrientes

**[Hipótese]** Checagens automáticas, que reaproveitam funções já existentes ([Verificado] `problemasDeSanidade`,
`conferirEnergia`):

1. Limites físicos por 100 g (os mesmos CHECKs do banco).
2. Energia × macros (4/4/9, mesma tolerância). Se não fechar, vai para revisão obrigatória.
3. Campos obrigatórios: kcal sempre. Para a base compartilhada, propõe-se exigir também proteína, carboidrato e
   gordura.
4. **Comparação com a referência:** o candidato mais parecido da TACO no mesmo grupo. Uma diferença grande vira
   alerta para o revisor. É só um alerta, nunca uma correção automática.
5. Coerência de unidade: suspeita de valores informados "por porção" como se fossem por 100 g, quando a porção do
   rótulo é conhecida.

Revisão humana:

- o revisor vê lado a lado o rascunho, a origem de cada campo, a referência da TACO e os alertas;
- pode aprovar, pedir ajuste ou recusar, sempre com motivo;
- a revisão fica registrada (quem revisou, quando e o que mudou), com tabela de auditoria e CHECKs, como o
  acompanhamento já faz.

A IA pode **sugerir** ao revisor onde olhar ("as calorias não fecham com os macros"). Ela **não aprova** nada.

---

## 6. Identificação de estimativas

**[Hipótese]** Proposta de modelo de procedência:

- **Por campo:** cada nutriente com origem (`oficial:taco`, `oficial:usda`, `rotulo`, `off`, `ia_estimativa`,
  `ajuste_usuario`) e, quando for oficial, a referência (código da fonte). A TACO já faz isso em `marcacoes`
  ([Verificado]); a ideia é estender aos alimentos da pessoa e aos compartilhados (L6).
- **Selo na interface:** "Oficial (TACO)", "Rótulo", "Open Food Facts", "Estimativa da IA", "Comunidade — revisado".
  Um alimento com qualquer campo estimado mostra "contém estimativa".
- **No diário (L5):** o snapshot do registro passa a guardar a procedência no momento do registro (por exemplo,
  "contém estimativa"). Assim, apagar o alimento não apaga a informação. Exige migration e decisão do dono.
- O texto segue o `CLAUDE.md`: estimativas sempre apresentadas como estimativas.

---

## 7. Prevenção de duplicatas

**[Hipótese]** Aproveita o que já existe ([Verificado]: normalização `normalizarBusca`, `pg_trgm`, índice GIN e
unicidade de código de barras por pessoa).

1. **Antes de criar** (§4, passo 2): busca pelo nome normalizado com `word_similarity` em TACO, base compartilhada e
   alimentos da pessoa. Candidatos acima de um limiar aparecem como "já existe?".
2. **Chave de código de barras:** na base compartilhada, código único global. Um código já existente nunca cria
   outro registro; vira pedido de correção.
3. **Assinatura de nutrientes:** mesmo nome normalizado e nutrientes muito próximos indicam provável duplicata. Vai
   para a fila do revisor; nunca é fundido automaticamente.
4. **Fusão pelo revisor:** ao aprovar, o revisor pode ligar a sugestão a um item existente. As pessoas continuam com
   o próprio alimento privado; nada é apagado delas.
5. **Nome padronizado:** a IA propõe o nome no estilo da TACO ("Pão, de queijo, assado") só como sugestão, que a
   pessoa pode trocar.

Os limiares precisam de teste com dados reais antes de valer. Não há números definidos aqui.

---

## 8. Proposta de implementação por etapas

Cada etapa segue o `CLAUDE.md`: plano aprovado antes do código, migration versionada, funções puras com testes,
relatório de segurança. Todas são **[Hipótese]** até aprovação.

| Etapa | Escopo | Depende de |
|---|---|---|
| **B0 — Decisões** | dono decide: revisores, licença do dado compartilhado, retenção/anonimato da sugestão, quais fontes externas buscar | — |
| **B1 — Procedência** (sem compartilhar nada) | procedência por campo em `alimentos_usuario`; snapshot "contém estimativa" no registro (corrige L5, L6); pedido/modelo/versão da estimativa (L8); selos na interface | B0 parcial |
| **B2 — IA prepara o cadastro** | fluxo "descrever → procurar antes de criar → rascunho da IA → conferir campo a campo" (§4, passos 1 a 5), ainda privado; reaproveita `estimarAlimento` e `sanitizarEstimativa` | B1 |
| **B3 — Fontes oficiais adicionais** | verificar licenças (TBCA, IBGE, USDA ampliado); importar com SHA-256 e citação; ampliar `alimentos_base_fonte_check` (L9); complementar campos desconhecidos (L2) com aprovação do dono | B0 |
| **B4 — Base compartilhada (leitura)** | tabela separada, só leitura para o app, alimentada pelo revisor; busca passa a incluir itens aprovados com selo (L3) | B1, B0 |
| **B5 — Contribuição e revisão** | fila de sugestões anônima, checagens automáticas (§5), tela do revisor, auditoria, duplicatas (§7) (L4, L7, L10) | B4 |
| **B6 — Industrializados compartilhados** | promover produtos do cache do Open Food Facts e rótulos revisados para a base compartilhada, respeitando ODbL | B5 e conferência jurídica da ODbL |

Riscos e cuidados:

- **Privacidade:** a sugestão não pode revelar a outras pessoas o que alguém come. Isso pede anonimato na fila e
  nenhum vínculo público.
- **Licença:** misturar dados ODbL pode obrigar a abrir a base derivada. Precisa de conferência antes da B6.
- **Qualidade:** a base compartilhada amplia o alcance de um erro. Por isso nenhum dado entra sem revisão humana, e
  estimativas nunca são apresentadas como oficiais.
- **Segurança:** as mesmas regras de sempre: DAL com `user_id` da sessão, Zod, limites de uso de IA, texto do
  usuário tratado como dado na instrução da IA (já feito em `montarEntradaEstimativa`).

---

## 9. Fora deste documento

Não foram alterados código, banco, migrations, dependências, `design/kalu/`, `CLAUDE.md` nem o plano central de
continuidade. O protótipo do cadastro em andamento por outro agente não foi lido nem modificado.

---

## 10. Execução — Fase 10A (16/11/2026)

Decisão do dono: importar a tabela de composição do IBGE inteira, mostrando a origem de cada alimento. Feito nos
branches `dev` e `test` (1.971 itens). Detalhes em `dados/ibge-pof/README.md` e
`docs/relatorios/fase10a-seguranca.md`. A TBCA não foi usada: os termos proíbem a reprodução sem autorização.
