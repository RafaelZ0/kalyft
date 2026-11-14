// Gráficos simples em SVG (renderizados no servidor, sem pacote e sem estilo inline: compatível com a CSP).
// Desenho: grade discreta com números redondos, linha de 2px (sem área: o eixo não começa em zero), valor atual no fim,
// barras finas com topo arredondado, legenda quando há mais de uma série e valor exato ao passar o mouse
// (title de cada ponto/barra). Texto sempre nas cores de texto, nunca na cor da série.
import { escalaBonita } from "@/lib/grafico-escala";

const PASSOS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]",
  "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
];

/** Barra de progresso em passos de 5% (classes fixas, sem estilo inline). */
export function Barra({ percentual, aviso = false }: { percentual: number; aviso?: boolean }) {
  const p = Math.max(0, Math.min(100, percentual));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-linha" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${aviso ? "bg-aviso" : "bg-destaque"} ${PASSOS[Math.round(p / 5)]}`} />
    </div>
  );
}

export type PontoGrafico = { x: number; y: number };
export type SerieGrafico = { nome: string; pontos: PontoGrafico[]; tipo: "pontos" | "linha" | "tracejada" };

const L = 340;
const A = 196;
const M = { esq: 40, dir: 46, topo: 14, base: 24 };
const FONTE = 11;
const LIMITE_ALVOS = 160; // acima disso, sem alvos de toque por ponto (evita SVG pesado)

const fmt1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const fmt0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function Legenda({ series }: { series: SerieGrafico[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave" aria-hidden="true">
      {series.map((s) => (
        <li key={s.nome} className="flex items-center gap-1.5">
          <svg width="18" height="10" viewBox="0 0 18 10">
            {s.tipo === "pontos" ? (
              <circle cx="9" cy="5" r="3.5" className="fill-suave" />
            ) : (
              <line x1="1" x2="17" y1="5" y2="5" strokeWidth="2" strokeLinecap="round" strokeDasharray={s.tipo === "tracejada" ? "4 3" : undefined} className={s.tipo === "linha" ? "stroke-marca" : "stroke-suave"} />
            )}
          </svg>
          {s.nome}
        </li>
      ))}
    </ul>
  );
}

function RotulosX({ rotulos }: { rotulos: [string, string] }) {
  return (
    <>
      <text x={M.esq} y={A - 6} className="fill-suave" fontSize={FONTE}>{rotulos[0]}</text>
      <text x={L - M.dir} y={A - 6} textAnchor="end" className="fill-suave" fontSize={FONTE}>{rotulos[1]}</text>
    </>
  );
}

function Grade({ marcas, py, fmt }: { marcas: number[]; py: (v: number) => number; fmt: (v: number) => string }) {
  return (
    <g>
      {marcas.map((g) => (
        <g key={g}>
          <line x1={M.esq} x2={L - M.dir} y1={py(g)} y2={py(g)} className="stroke-linha" strokeWidth={1} />
          <text x={M.esq - 8} y={py(g) + 4} textAnchor="end" className="fill-suave tabular-nums" fontSize={FONTE}>{fmt(g)}</text>
        </g>
      ))}
    </g>
  );
}

/** Linha de referência (meta, gasto): tracejada e discreta, com o rótulo à direita, fora da área dos dados. */
function Referencia({ y, py, rotulo }: { y: number; py: (v: number) => number; rotulo: string }) {
  return (
    <g>
      <line x1={M.esq} x2={L - M.dir} y1={py(y)} y2={py(y)} className="stroke-apoio-texto" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={L - M.dir + 6} y={py(y) + 4} className="fill-suave" fontSize={FONTE - 1}>{rotulo}</text>
    </g>
  );
}

/**
 * Gráfico de linhas/pontos. `x` e `y` são números; `rotulosX` mostra o primeiro e o último
 * rótulo embaixo. A linha horizontal opcional marca uma meta.
 */
export function GraficoLinhas({
  series,
  rotulosX,
  unidade,
  titulo,
  linhaMeta,
}: {
  series: SerieGrafico[];
  rotulosX: [string, string];
  unidade: string;
  titulo: string;
  linhaMeta?: number | null;
}) {
  const todos = series.flatMap((s) => s.pontos);
  if (todos.length === 0) return <p className="text-suave">Sem dados ainda.</p>;
  const ys = [...todos.map((p) => p.y), ...(linhaMeta != null ? [linhaMeta] : [])];
  const escala = escalaBonita(Math.min(...ys), Math.max(...ys));
  const minX = Math.min(...todos.map((p) => p.x));
  const maxX = Math.max(...todos.map((p) => p.x));
  const larg = L - M.esq - M.dir;
  const alt = A - M.topo - M.base;
  const px = (x: number) => M.esq + (maxX === minX ? larg / 2 : ((x - minX) / (maxX - minX)) * larg);
  const py = (y: number) => M.topo + alt - ((y - escala.min) / (escala.max - escala.min)) * alt;
  const caminho = (pts: PontoGrafico[]) => pts.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const principal = series.find((s) => s.tipo === "linha") ?? series.find((s) => s.tipo !== "tracejada") ?? series[0];
  const ultimo = principal.pontos.at(-1);
  const comAlvos = todos.length <= LIMITE_ALVOS;

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={titulo} className="w-full overflow-visible">
        <title>{titulo}</title>
        <Grade marcas={escala.marcas} py={py} fmt={fmt1} />
        {linhaMeta != null ? <Referencia y={linhaMeta} py={py} rotulo={`meta ${fmt1(linhaMeta)}`} /> : null}

        {series.map((s) => {
          if (s.tipo === "pontos") {
            return (
              <g key={s.nome}>
                {s.pontos.map((p, i) => (
                  <circle key={i} cx={px(p.x)} cy={py(p.y)} r={3.5} className="fill-suave stroke-superficie" strokeWidth={2} fillOpacity={0.75}>
                    {comAlvos ? <title>{`${s.nome}: ${fmt1(p.y)} ${unidade}`}</title> : null}
                  </circle>
                ))}
              </g>
            );
          }
          const linha = s.tipo === "linha";
          return (
            <g key={s.nome}>
              <polyline
                fill="none"
                className={linha ? "stroke-marca" : "stroke-suave"}
                strokeWidth={2}
                strokeDasharray={linha ? undefined : "5 4"}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={caminho(s.pontos)}
              />
              {comAlvos
                ? s.pontos.map((p, i) => (
                    <circle key={i} cx={px(p.x)} cy={py(p.y)} r={7} fill="transparent">
                      <title>{`${s.nome}: ${fmt1(p.y)} ${unidade}`}</title>
                    </circle>
                  ))
                : null}
            </g>
          );
        })}

        {ultimo ? (
          <g>
            <circle cx={px(ultimo.x)} cy={py(ultimo.y)} r={4.5} className={principal.tipo === "linha" ? "fill-marca stroke-superficie" : "fill-suave stroke-superficie"} strokeWidth={2} />
            <text x={L - M.dir + 6} y={py(ultimo.y) + 4} className="fill-texto font-semibold tabular-nums" fontSize={FONTE + 1}>
              {fmt1(ultimo.y)}
            </text>
          </g>
        ) : null}
        <RotulosX rotulos={rotulosX} />
      </svg>
      <Legenda series={series} />
    </figure>
  );
}

export type BarraGrafico = { x: number; y: number };

/** Retângulo com topo arredondado e base reta (a barra cresce a partir do zero). */
function caminhoBarra(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

/**
 * Barras (uma por dia ou semana) com uma linha horizontal de referência (gasto, meta...). Barras acima da
 * linha, quando `acimaEmAtencao`, ficam em laranja: acima do gasto ou da meta é atenção, não erro.
 */
export function GraficoBarras({
  barras,
  rotulosX,
  unidade,
  titulo,
  linha,
  rotuloLinha,
  acimaEmAtencao = false,
}: {
  barras: BarraGrafico[];
  rotulosX: [string, string];
  unidade: string;
  titulo: string;
  linha?: number | null;
  rotuloLinha?: string;
  acimaEmAtencao?: boolean;
}) {
  if (barras.length === 0) return <p className="text-suave">Sem dados ainda.</p>;
  const escala = escalaBonita(0, Math.max(...barras.map((b) => b.y), linha ?? 0), { zero: true });
  const larg = L - M.esq - M.dir;
  const alt = A - M.topo - M.base;
  const base = M.topo + alt;
  const n = barras.length;
  const passo = larg / n;
  const largBarra = Math.max(2, Math.min(passo - 2, 16)); // fina, com no mínimo 2 de espaço entre barras
  const py = (y: number) => M.topo + alt - (y / escala.max) * alt;
  const algumaAcima = acimaEmAtencao && linha != null && barras.some((b) => b.y > linha);
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={titulo} className="w-full overflow-visible">
        <title>{titulo}</title>
        <Grade marcas={escala.marcas} py={py} fmt={fmt0} />
        {barras.map((b, i) => {
          const x = M.esq + i * passo + (passo - largBarra) / 2;
          const acima = acimaEmAtencao && linha != null && b.y > linha;
          return (
            <g key={i}>
              <path d={caminhoBarra(x, py(b.y), largBarra, base)} className={acima ? "fill-aviso" : "fill-marca"} />
              <rect x={M.esq + i * passo} y={M.topo} width={passo} height={alt} fill="transparent">
                <title>{`${fmt0(b.y)} ${unidade}`}</title>
              </rect>
            </g>
          );
        })}
        {linha != null ? <Referencia y={linha} py={py} rotulo={`${rotuloLinha ?? "ref."} ${fmt0(linha)}`} /> : null}
        <RotulosX rotulos={rotulosX} />
      </svg>
      {algumaAcima ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave" aria-hidden="true">
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-marca" />Até {rotuloLinha ?? "a referência"}</li>
          <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-aviso" />Acima de {rotuloLinha ?? "a referência"}</li>
        </ul>
      ) : null}
    </figure>
  );
}
