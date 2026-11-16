// Importa a tabela de composição do IBGE (POF 2008-2009) para alimentos_base, fonte "ibge". Idempotente: rodar de
// novo atualiza, não duplica. Lê o CSV transcrito da planilha oficial (scripts/converter-ibge-pof.py).
//
// Uso:
//   npm run ibge-pof:importar -- --alvo dev            (usa .env.local)
//   npm run ibge-pof:importar -- --alvo test           (usa .env.test.local)
//   npm run ibge-pof:importar -- --alvo producao --confirmar   (usa .env.main.local)
//   acrescente --simular para validar e mostrar o resumo sem gravar.
//
// Usa a URL do papel DONO (DATABASE_URL_MIGRACOES): o papel do app não pode gravar nessa tabela.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { normalizarBusca } from "../lib/busca.ts";

const ARQUIVO = "dados/ibge-pof/composicao.csv";
const SHA256 = "73b08f34b088cb55a3cfef0ef6fdc353a48ad2b21de7efafec29f1af5911673b";
const TOTAL_ESPERADO = 1971;

export const FONTE = {
  fonte: "ibge",
  edicao: "pof-2008-2009-tcn",
  titulo: "Tabelas de Composição Nutricional dos Alimentos Consumidos no Brasil (POF 2008-2009)",
  url: "https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/",
  termos:
    "Publicação © IBGE 2011, sem licença explícita de reprodução; dados públicos usados citando a fonte. Segundo a publicação, a maior parte dos valores vem da base NDSR (University of Minnesota) e da TACO.",
  citacao:
    "IBGE. Pesquisa de orçamentos familiares 2008-2009: tabelas de composição nutricional dos alimentos consumidos no Brasil. Rio de Janeiro: IBGE, 2011.",
};

/** Fontes de referência da própria planilha (aba "Código e Fonte de Referência"). */
export const REFERENCIAS = {
  1: "NDSR (Univ. de Minnesota, EUA)",
  2: "TACO",
  3: "Ministério da Saúde (alimentos regionais)",
  4: "Tabela portuguesa (Martins)",
  5: "Culinária goiana (Naves)",
  6: "Pacheco",
  7: "Rótulo",
  8: "Referência mista",
  9: "INPA",
};

const CAMPOS = ["kcal", "proteina_g", "gordura_g", "carbo_g", "fibra_g", "sodio_mg"];
const FAIXAS = { kcal: 900, proteina_g: 100, gordura_g: 100, carbo_g: 100, fibra_g: 100, sodio_mg: 40000 };

/**
 * Converte uma célula numérica. Convenção da publicação: "-" = zero não resultante de arredondamento.
 * Vazio = desconhecido. Guarda a marcação original.
 */
export function converterValor(bruto) {
  const v = String(bruto ?? "").trim();
  if (v === "-") return { valor: 0, marca: "-" };
  if (v === "") return { valor: null, marca: "vazio" };
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`valor inesperado "${v}"`);
  return { valor: Math.round((Number(v) + Number.EPSILON) * 100) / 100, marca: null };
}

/**
 * Gorduras puras (azeite, banha) passam do limite físico só por arredondamento da fonte (ex.: 100,43 g de gordura,
 * 902 kcal). Até 1% acima, ajusta ao limite e devolve o original para ficar registrado; acima disso, recusa (null).
 */
export function ajustarAoLimite(valor, limite) {
  if (valor === null || valor <= limite) return { valor, original: null };
  if (valor <= limite * 1.01) return { valor: limite, original: valor };
  return null;
}

/** "BOLO DE CENOURA" + "NAO SE APLICA" → "Bolo de cenoura"; "MILHO (EM GRAO)" + "COZIDO(A)" → "Milho (em grao), cozido(a)". */
export function nomeDoItem(descricao, preparo) {
  const base = descricao.trim().toLowerCase().replace(/\s+/g, " ");
  const p = preparo.trim().toUpperCase() === "NAO SE APLICA" ? "" : `, ${preparo.trim().toLowerCase()}`;
  const nome = `${base}${p}`;
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function extrairItens(texto) {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const cab = linhas[0].split(";");
  const esperado = ["codigo_alimento", "descricao", "codigo_preparo", "preparo", "ref_codigo", "ref_descricao", ...CAMPOS.slice(0, 1), "proteina_g", "gordura_g", "carbo_g", "fibra_g", "sodio_mg", "sodio_adicao_mg"];
  if (cab.join(";") !== esperado.join(";")) throw new Error(`cabeçalho inesperado: ${cab.join(";")}`);
  const itens = [];
  const erros = [];
  const vistos = new Set();
  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(";");
    const [codAlim, descricao, codPrep, preparo, refCod, refDesc] = c;
    const codigo = `${codAlim}-${codPrep}`;
    try {
      if (!/^\d{7}$/.test(codAlim) || !/^\d{1,3}$/.test(codPrep)) throw new Error("código inválido");
      if (vistos.has(codigo)) throw new Error("código repetido");
      vistos.add(codigo);
      const ref = REFERENCIAS[Number(refCod)];
      if (!ref) throw new Error(`referência desconhecida ${refCod}`);
      /** @type {Record<string, any>} */
      const item = {
        codigo,
        nome: nomeDoItem(descricao, preparo),
        referencia: `${ref}: ${refDesc}`.slice(0, 300),
        marcacoes: {},
      };
      const valores = { kcal: c[6], proteina_g: c[7], gordura_g: c[8], carbo_g: c[9], fibra_g: c[10], sodio_mg: c[11] };
      for (const campo of CAMPOS) {
        const { valor, marca } = converterValor(valores[campo]);
        const ajuste = ajustarAoLimite(valor, FAIXAS[campo]);
        if (ajuste === null) throw new Error(`${campo} fora da faixa (${valor})`);
        item[campo] = ajuste.valor;
        if (ajuste.original !== null) item.marcacoes[campo] = { marca: "limite", fonte: "ibge", ref: String(ajuste.original) };
        else if (marca) item.marcacoes[campo] = { marca, fonte: "ibge" };
      }
      const adicao = converterValor(c[12]);
      if (adicao.valor !== null && adicao.valor > 40000) throw new Error("sódio de adição fora da faixa");
      item.sodio_adicao_mg = adicao.valor === 0 ? null : adicao.valor;
      if (item.nome.length < 1 || item.nome.length > 200) throw new Error("nome com tamanho inválido");
      itens.push(item);
    } catch (e) {
      erros.push(`linha ${i + 1} (${codigo}): ${e.message}`);
    }
  }
  return { itens, erros };
}

function lerEnv(arquivo) {
  const linha = readFileSync(arquivo, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL_MIGRACOES="));
  const url = linha?.slice("DATABASE_URL_MIGRACOES=".length).trim().replace(/^["']|["']$/g, "");
  if (!url) throw new Error(`DATABASE_URL_MIGRACOES não encontrada em ${arquivo}.`);
  return url;
}

async function main() {
  const args = process.argv.slice(2);
  const alvo = args[args.indexOf("--alvo") + 1];
  const simular = args.includes("--simular");
  const envs = { dev: ".env.local", test: ".env.test.local", producao: ".env.main.local" };
  if (!envs[alvo]) throw new Error("Informe --alvo dev, test ou producao.");
  if (alvo === "producao" && !args.includes("--confirmar")) throw new Error("Produção exige --confirmar.");

  const buf = readFileSync(ARQUIVO);
  const hash = createHash("sha256").update(buf).digest("hex");
  if (hash !== SHA256) throw new Error(`SHA-256 diferente do arquivo conferido (${hash}).`);
  const { itens, erros } = extrairItens(buf.toString("utf8"));
  if (erros.length) throw new Error(`Validação falhou, nada foi gravado:\n- ${erros.join("\n- ")}`);
  if (itens.length !== TOTAL_ESPERADO) throw new Error(`Esperados ${TOTAL_ESPERADO} itens, lidos ${itens.length}.`);
  const semKcal = itens.filter((x) => x.kcal === null);
  console.log(`Arquivo conferido (SHA-256 ok). ${itens.length} itens válidos. Sem calorias: ${semKcal.length}.`);
  if (simular) return console.log("Simulação: nada foi gravado.");

  const sql = neon(lerEnv(envs[alvo]));
  const linhas = itens.map((x) => ({ ...x, codigo_fonte: x.codigo, nome_busca: normalizarBusca(x.nome) }));
  // Uma transação: grava a fonte e todos os itens, ou nada.
  await sql.transaction([
    sql`insert into fontes_alimentos (fonte, edicao, titulo, url, termos, citacao, arquivo_sha256)
        values (${FONTE.fonte}, ${FONTE.edicao}, ${FONTE.titulo}, ${FONTE.url}, ${FONTE.termos}, ${FONTE.citacao}, ${hash})
        on conflict (fonte, edicao) do update set titulo = excluded.titulo, url = excluded.url, termos = excluded.termos,
          citacao = excluded.citacao, arquivo_sha256 = excluded.arquivo_sha256, importado_em = now()`,
    sql`insert into alimentos_base (fonte, edicao, codigo_fonte, nome, nome_busca, grupo, kcal, proteina_g, carbo_g, gordura_g, fibra_g, sodio_mg, marcacoes, referencia, sodio_adicao_mg)
        select ${FONTE.fonte}, ${FONTE.edicao}, r.codigo_fonte, r.nome, r.nome_busca, null, r.kcal, r.proteina_g, r.carbo_g, r.gordura_g, r.fibra_g, r.sodio_mg,
          coalesce(r.marcacoes, '{}'::jsonb), r.referencia, r.sodio_adicao_mg
        from jsonb_to_recordset(${JSON.stringify(linhas)}::jsonb) as r(
          codigo_fonte text, nome text, nome_busca text, kcal numeric, proteina_g numeric, carbo_g numeric, gordura_g numeric,
          fibra_g numeric, sodio_mg numeric, marcacoes jsonb, referencia text, sodio_adicao_mg numeric)
        on conflict (fonte, codigo_fonte) do update set edicao = excluded.edicao, nome = excluded.nome, nome_busca = excluded.nome_busca,
          kcal = excluded.kcal, proteina_g = excluded.proteina_g, carbo_g = excluded.carbo_g, gordura_g = excluded.gordura_g,
          fibra_g = excluded.fibra_g, sodio_mg = excluded.sodio_mg, marcacoes = excluded.marcacoes, referencia = excluded.referencia,
          sodio_adicao_mg = excluded.sodio_adicao_mg, atualizado_em = now()`,
  ]);
  const [{ total }] = await sql`select count(*)::int as total from alimentos_base where fonte = 'ibge'`;
  console.log(`Gravado no branch "${alvo}". Itens do IBGE no banco: ${total}.`);
}

if (process.argv[1]?.endsWith("importar-ibge-pof.mjs")) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
