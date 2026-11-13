import Link from "next/link";
import { Plus, Utensils } from "lucide-react";
import { Barra } from "@/components/graficos";
import type { Totais } from "@/lib/nutricao";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export function ResumoCalorias({ totais, meta, temRegistros }: {
  totais: Totais;
  meta: { kcal: number | null; proteinaG: number | null; carboG: number | null; gorduraG: number | null } | null;
  temRegistros: boolean;
}) {
  const percentual = meta?.kcal && meta.kcal > 0 ? totais.kcal / meta.kcal * 100 : null;
  const restante = meta?.kcal != null ? meta.kcal - totais.kcal : null;
  return <section className="app-card" aria-labelledby="calorias">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="icon-badge"><Utensils size={20} aria-hidden="true" /></span><h2 id="calorias" className="section-heading">Sua alimentação</h2></div><Link href="/progresso/meta" className="action-link">Ver meta</Link></div>
    <div className="my-6 flex items-center justify-between gap-3">
      <div><p className="text-4xl font-bold tracking-tight sm:text-5xl">{fmt(totais.kcal)} <span className="text-base font-medium tracking-normal text-suave">kcal</span></p><p className="mt-2 text-sm text-suave">{meta?.kcal != null ? `consumidas de ${fmt(meta.kcal)} kcal` : "consumidas hoje"}</p>
      <p className="mt-3 text-sm text-suave">{!temRegistros ? "Seu primeiro registro começa aqui." : restante !== null ? restante >= 0 ? <><strong className="text-texto">{fmt(restante)} kcal</strong> até sua referência</> : <><strong className="text-aviso">{fmt(-restante)} kcal acima</strong> da referência. Acompanhe a média da semana.</> : "Defina sua meta para acompanhar o dia."}</p></div>
      {percentual !== null ? <svg viewBox="0 0 132 132" role="img" aria-label={`${fmt(percentual)}% da referência diária`} className="energy-ring"><circle className="track" cx="66" cy="66" r="57" /><circle className="value" cx="66" cy="66" r="57" pathLength={100} strokeDasharray={`${Math.min(100, Math.max(0, percentual))} 100`} /><text x="66" y="66" textAnchor="middle" dominantBaseline="middle" className="fill-texto text-2xl font-semibold">{fmt(percentual)}%</text><text x="66" y="87" textAnchor="middle" className="fill-suave text-xs">da referência</text></svg> : null}
    </div>
    <div className="mb-5 grid grid-cols-3 gap-3 border-t border-linha pt-5">
      {([{ campo: "proteinaG", nome: "Proteína" }, { campo: "carboG", nome: "Carboidratos" }, { campo: "gorduraG", nome: "Gorduras" }] as const).map(({ campo, nome }) => <div key={campo}><p className="mb-1 text-xs text-suave">{nome}</p><p className="text-sm font-semibold">{fmt(totais[campo])}<span className="font-normal text-suave">{meta?.[campo] != null ? ` / ${fmt(meta[campo])}` : ""} g</span></p>{totais.parcial[campo] ? <p className="text-xs text-suave">Total parcial</p> : null}{meta?.[campo] != null && meta[campo] > 0 ? <div className="mt-2"><Barra percentual={totais[campo] / meta[campo] * 100} /></div> : null}</div>)}
    </div>
    <Link href="/comida/adicionar" className="action-primary w-full"><Plus size={19} aria-hidden="true" />Registrar alimentação</Link>
    {!meta ? <Link href="/progresso/meta" className="action-link mt-2">Definir minhas metas</Link> : null}
  </section>;
}
