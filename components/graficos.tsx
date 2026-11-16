"use client";

// Gráficos em SVG, sem pacote e sem estilo inline (compatível com a CSP). Mesma família visual em todo o app:
// escala só dos dados (referência longe vira texto), 3–4 datas no eixo, grade discreta, linha de 2 px que LIGA
// os pontos (cada bolinha é um vértice da linha), cor da marca na série principal, cinza no contexto e toque/teclado
// mostrando o valor do ponto. Texto sempre nas cores de texto, nunca na cor da série.
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { escalaComReferencia, indiceMaisPerto, marcasEixoX, rotuloEixoX, type EixoX } from "@/lib/grafico-escala";

const PASSOS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]",
  "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
];

/** Barra de progresso em passos de 5% (classes fixas, sem estilo inline). */
export function Barra({ percentual, aviso = false }: { percentual: number; aviso?: boolean }) {
  const p = Math.max(0, Math.min(100, percentual));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-linha" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${aviso ? "bg-aviso" : "bg-marca"} ${PASSOS[Math.round(p / 5)]}`} />
    </div>
  );
}

export type PontoGrafico = { x: number; y: number };
/**
 * `linha`: série principal (cor da marca). `secundaria`: segunda série comparável (cor de apoio).
 * `tracejada`: contexto (cinza tracejado, ex.: tendência, plano, esperado). Todas ligam os próprios pontos.
 */
export type SerieGrafico = { nome: string; pontos: PontoGrafico[]; tipo: "linha" | "secundaria" | "tracejada" };

const L = 340;
const A = 188;
const M = { esq: 34, dir: 12, topo: 12, base: 24 };
const FONTE = 11;
const MAX_MARCADORES = 45; // mais pontos que isso: só a linha (bolinhas viram ruído)

const fmt1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const fmt0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const COR = {
  linha: { traco: "stroke-marca", ponto: "fill-marca" },
  secundaria: { traco: "stroke-apoio-texto", ponto: "fill-apoio-texto" },
  tracejada: { traco: "stroke-suave", ponto: "fill-suave" },
} as const;

function Legenda({ series }: { series: Array<{ nome: string; tipo: SerieGrafico["tipo"] }> }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave" aria-hidden="true">
      {series.map((s) => (
        <li key={s.nome} className="flex items-center gap-1.5">
          <svg width="22" height="10" viewBox="0 0 22 10">
            <line x1="1" x2="21" y1="5" y2="5" strokeWidth="2" strokeLinecap="round" strokeDasharray={s.tipo === "tracejada" ? "4 3" : undefined} className={COR[s.tipo].traco} />
            {s.tipo !== "tracejada" ? <circle cx="11" cy="5" r="3" className={`${COR[s.tipo].ponto} stroke-superficie`} strokeWidth="1.5" /> : null}
          </svg>
          {s.nome}
        </li>
      ))}
    </ul>
  );
}

function Grade({ marcas, py, fmt }: { marcas: number[]; py: (v: number) => number; fmt: (v: number) => string }) {
  return (
    <g>
      {marcas.map((g) => (
        <g key={g}>
          <line x1={M.esq} x2={L - M.dir} y1={py(g)} y2={py(g)} className="stroke-linha" strokeWidth={1} />
          <text x={M.esq - 6} y={py(g) + 4} textAnchor="end" className="fill-suave tabular-nums" fontSize={FONTE}>{fmt(g)}</text>
        </g>
      ))}
    </g>
  );
}

/** Linha de referência (meta, gasto): tracejada e discreta, rótulo acima dela, dentro da área, à direita. */
function Referencia({ y, rotulo }: { y: number; rotulo: string }) {
  return (
    <g>
      <line x1={M.esq} x2={L - M.dir} y1={y} y2={y} className="stroke-texto" strokeOpacity={0.55} strokeWidth={1.25} strokeDasharray="4 4" />
      <text x={L - M.dir} y={y - 5} textAnchor="end" className="fill-texto font-semibold" fontSize={FONTE - 1}>{rotulo}</text>
    </g>
  );
}

function EixoXRotulos({ marcas, px }: { marcas: Array<{ x: number; rotulo: string }>; px: (x: number) => number }) {
  return (
    <g>
      {marcas.map((m, i) => (
        <text
          key={m.x}
          x={px(m.x)}
          y={A - 6}
          textAnchor={marcas.length > 1 && i === 0 ? "start" : i === marcas.length - 1 && marcas.length > 1 ? "end" : "middle"}
          className="fill-suave tabular-nums"
          fontSize={FONTE}
        >
          {m.rotulo}
        </text>
      ))}
    </g>
  );
}

/** Seleção por toque, mouse e teclado (setas). Devolve o índice escolhido e os manipuladores. */
function useSelecao(n: number, xsTela: number[]) {
  const [sel, setSel] = useState<number | null>(null);
  const escolher = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0) return;
    setSel(indiceMaisPerto(xsTela, ((e.clientX - r.left) / r.width) * L));
  };
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    if (e.key === "ArrowRight") setSel((s) => (s === null ? n - 1 : Math.min(n - 1, s + 1)));
    else if (e.key === "ArrowLeft") setSel((s) => (s === null ? n - 1 : Math.max(0, s - 1)));
    else if (e.key === "Escape") setSel(null);
    else return;
    e.preventDefault();
  };
  return {
    sel,
    svg: {
      onPointerDown: escolher,
      onPointerMove: (e: PointerEvent<SVGSVGElement>) => (e.pointerType === "mouse" || e.buttons ? escolher(e) : undefined),
      onPointerLeave: (e: PointerEvent<SVGSVGElement>) => (e.pointerType === "mouse" ? setSel(null) : undefined),
    },
    teclado,
  };
}

/** Linha de leitura acima do gráfico: o valor do ponto escolhido, ou a dica de toque. Altura fixa (sem pulo). */
function Leitura({ id, texto }: { id: string; texto: string | null }) {
  return (
    <p id={id} aria-live="polite" className="min-h-5 text-sm tabular-nums text-suave">
      {texto ?? "Toque no gráfico para ver o valor de cada dia."}
    </p>
  );
}

/**
 * Linhas no tempo. Cada série liga os próprios pontos (as bolinhas ficam exatamente sobre a linha).
 * `referencia` (meta) só é desenhada se estiver perto dos dados; senão o cartão mostra o valor como texto.
 */
export function GraficoLinhas({
  series,
  eixoX,
  unidade,
  titulo,
  referencia,
  rotuloReferencia = "meta",
}: {
  series: SerieGrafico[];
  eixoX: EixoX;
  unidade: string;
  titulo: string;
  referencia?: number | null;
  rotuloReferencia?: string;
}) {
  const idLeitura = useId();
  const validas = series.map((s) => ({ ...s, pontos: [...s.pontos].sort((a, b) => a.x - b.x) })).filter((s) => s.pontos.length > 0);
  const todos = validas.flatMap((s) => s.pontos);
  const xs = [...new Set(todos.map((p) => p.x))].sort((a, b) => a - b);
  const minX = xs[0] ?? 0;
  const maxX = xs.at(-1) ?? 0;
  const larg = L - M.esq - M.dir - 12;
  const alt = A - M.topo - M.base;
  const px = (x: number) => M.esq + 6 + (maxX === minX ? larg / 2 : ((x - minX) / (maxX - minX)) * larg);
  const { sel, svg, teclado } = useSelecao(xs.length, xs.map(px));
  if (todos.length === 0) return <p className="text-suave">Sem dados ainda.</p>;

  const { escala, referenciaNoDesenho } = escalaComReferencia(todos.map((p) => p.y), referencia);
  const py = (y: number) => M.topo + alt - ((y - escala.min) / (escala.max - escala.min)) * alt;
  const caminho = (pts: PontoGrafico[]) => pts.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const fmtEixo = escala.max - escala.min < 10 ? fmt1 : fmt0;
  const marcasX = marcasEixoX(xs).map((x) => ({ x, rotulo: rotuloEixoX(eixoX, x) }));

  const xSel = sel !== null ? xs[sel] : null;
  const valoresSel =
    xSel === null ? [] : validas.map((s) => ({ s, p: s.pontos.find((p) => p.x === xSel) ?? null })).filter((v): v is { s: (typeof validas)[number]; p: PontoGrafico } => v.p !== null);
  const leitura =
    xSel === null ? null : `${rotuloEixoX(eixoX, xSel)}: ${valoresSel.map((v) => `${validas.length > 1 ? `${v.s.nome} ` : ""}${fmt1(v.p.y)} ${unidade}`).join(" · ")}`;

  return (
    <figure className="space-y-2">
      <Leitura id={idLeitura} texto={leitura} />
      <div tabIndex={0} onKeyDown={teclado} aria-describedby={idLeitura} aria-label={`${titulo}. Use as setas para ver os valores.`} role="group" className="rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-destaque">
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={titulo} className="w-full touch-pan-y select-none" {...svg}>
          <title>{titulo}</title>
          <Grade marcas={escala.marcas} py={py} fmt={fmtEixo} />
          {referencia != null && referenciaNoDesenho ? <Referencia y={py(referencia)} rotulo={`${rotuloReferencia} ${fmt1(referencia)}`} /> : null}

          {xSel !== null ? <line x1={px(xSel)} x2={px(xSel)} y1={M.topo} y2={M.topo + alt} className="stroke-suave" strokeWidth={1} /> : null}

          {/* contexto primeiro (por baixo), série principal por cima */}
          {[...validas].sort((a, b) => (a.tipo === "linha" ? 1 : 0) - (b.tipo === "linha" ? 1 : 0)).map((s) => {
            const cor = COR[s.tipo];
            const marcadores = s.tipo !== "tracejada" && s.pontos.length <= MAX_MARCADORES;
            const ultimo = s.pontos.at(-1)!;
            return (
              <g key={s.nome}>
                {s.pontos.length > 1 ? (
                  <polyline
                    fill="none"
                    className={cor.traco}
                    strokeWidth={2}
                    strokeDasharray={s.tipo === "tracejada" ? "5 4" : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={caminho(s.pontos)}
                  />
                ) : null}
                {marcadores
                  ? s.pontos.map((p, i) => <circle key={i} cx={px(p.x)} cy={py(p.y)} r={3.5} className={`${cor.ponto} stroke-superficie`} strokeWidth={1.5} />)
                  : null}
                {s.tipo !== "tracejada" ? <circle cx={px(ultimo.x)} cy={py(ultimo.y)} r={5} className={`${cor.ponto} stroke-superficie`} strokeWidth={2} /> : null}
              </g>
            );
          })}

          {valoresSel.map((v) => (
            <circle key={v.s.nome} cx={px(v.p.x)} cy={py(v.p.y)} r={6} className={`${COR[v.s.tipo].ponto} stroke-superficie`} strokeWidth={2.5} />
          ))}
          <EixoXRotulos marcas={marcasX} px={px} />
        </svg>
      </div>
      <Legenda series={validas} />
    </figure>
  );
}

export type BarraGrafico = { x: number; y: number; rotulo: string };

/** Retângulo com topo arredondado e base reta (a barra cresce a partir do zero). */
function caminhoBarra(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

/**
 * Barras (uma por dia ou semana) com linha de referência opcional (gasto, meta). Com `acimaEmAtencao`, barras
 * acima da referência ficam em âmbar: acima do gasto ou da meta é atenção, não erro. Toque destaca a barra.
 */
export function GraficoBarras({
  barras,
  unidade,
  titulo,
  linha,
  rotuloLinha,
  acimaEmAtencao = false,
  inteiro = true,
}: {
  barras: BarraGrafico[];
  unidade: string;
  titulo: string;
  linha?: number | null;
  rotuloLinha?: string;
  acimaEmAtencao?: boolean;
  inteiro?: boolean;
}) {
  const idLeitura = useId();
  const larg = L - M.esq - M.dir;
  const n = barras.length;
  const passo = n > 0 ? larg / n : larg;
  const centro = (i: number) => M.esq + i * passo + passo / 2;
  const { sel, svg, teclado } = useSelecao(n, barras.map((_, i) => centro(i)));
  if (n === 0) return <p className="text-suave">Sem dados ainda.</p>;

  const { escala } = escalaComReferencia([...barras.map((b) => b.y), 0], linha ?? null, { zero: true });
  const alt = A - M.topo - M.base;
  const base = M.topo + alt;
  const largBarra = Math.max(3, Math.min(passo - 2, 18)); // fina, sempre com espaço entre barras
  const py = (y: number) => M.topo + alt - (y / escala.max) * alt;
  const fmt = inteiro ? fmt0 : fmt1;
  const algumaAcima = acimaEmAtencao && linha != null && barras.some((b) => b.y > linha);
  const marcasX = marcasEixoX(barras.map((_, i) => i)).map((i) => ({ x: i, rotulo: barras[i].rotulo }));
  const leitura = sel === null ? null : `${barras[sel].rotulo}: ${fmt(barras[sel].y)} ${unidade}${linha != null && rotuloLinha ? ` (${rotuloLinha} ${fmt0(linha)})` : ""}`;

  return (
    <figure className="space-y-2">
      <Leitura id={idLeitura} texto={leitura} />
      <div tabIndex={0} onKeyDown={teclado} aria-describedby={idLeitura} aria-label={`${titulo}. Use as setas para ver os valores.`} role="group" className="rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-destaque">
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={titulo} className="w-full touch-pan-y select-none" {...svg}>
          <title>{titulo}</title>
          <Grade marcas={escala.marcas} py={py} fmt={fmt0} />
          {barras.map((b, i) => {
            const x = centro(i) - largBarra / 2;
            const acima = acimaEmAtencao && linha != null && b.y > linha;
            const apagada = sel !== null && sel !== i;
            return <path key={i} d={caminhoBarra(x, py(b.y), largBarra, base)} className={`${acima ? "fill-aviso" : "fill-marca"} ${apagada ? "opacity-35" : ""}`} />;
          })}
          {linha != null ? <Referencia y={py(linha)} rotulo={`${rotuloLinha ?? "ref."} ${fmt0(linha)}`} /> : null}
          <EixoXRotulos marcas={marcasX} px={centro} />
        </svg>
      </div>
      {algumaAcima ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave" aria-hidden="true">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-marca" />Até {rotuloLinha ?? "a referência"}</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-aviso" />Acima de {rotuloLinha ?? "a referência"}</li>
        </ul>
      ) : null}
    </figure>
  );
}
