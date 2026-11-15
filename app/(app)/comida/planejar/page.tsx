import Link from "next/link";
import { ChevronLeft, ChevronRight, ListChecks, Plus } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarPlanejados } from "@/lib/dal/planejamento";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { diasDaSemana, semanaDoPlanejamento } from "@/lib/planejamento";
import { REFEICOES, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { Voltar } from "../comum";
import { repetirSemanaAcao } from "./actions";
import { ItemPlanejado } from "./item-planejado";

export const metadata = { title: "Planejar a semana · Kalyft" };

const NOMES_DIA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default async function PaginaPlanejar(props: PageProps<"/comida/planejar">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const semana = semanaDoPlanejamento((await props.searchParams).semana, hoje);
  const dias = diasDaSemana(semana);
  const planejados = await listarPlanejados(userId, dias[0], dias[6]);
  const anterior = semanaDoPlanejamento(somarDias(semana, -7), hoje);
  const seguinte = semanaDoPlanejamento(somarDias(semana, 7), hoje);

  return (
    <div className="page-stack">
      <Voltar href="/comida" />
      <header className="space-y-3">
        <h1 className="page-heading">Planejar a semana</h1>
        <p className="page-intro">Escolha algumas refeições. Planejado não conta como comido: toque em &quot;Comi isso&quot; quando comer.</p>
        <nav aria-label="Semana" className="app-card flex items-center justify-between">
          {anterior !== semana ? (
            <Link href={`/comida/planejar?semana=${anterior}`} aria-label="Semana anterior" className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-borda"><ChevronLeft size={20} aria-hidden="true" /></Link>
          ) : <span className="min-w-12" />}
          <p className="text-center font-semibold">{formatarDataBr(dias[0])} a {formatarDataBr(dias[6])}</p>
          {seguinte !== semana ? (
            <Link href={`/comida/planejar?semana=${seguinte}`} aria-label="Próxima semana" className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-borda"><ChevronRight size={20} aria-hidden="true" /></Link>
          ) : <span className="min-w-12" />}
        </nav>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={`/comida/planejar/compras?semana=${semana}`} className="action-primary gap-2"><ListChecks size={18} aria-hidden="true" />Lista de compras</Link>
          {planejados.length === 0 && anterior !== semana ? (
            <FormDados action={repetirSemanaAcao}>
              <input type="hidden" name="semana" value={semana} />
              <button type="submit" className="action-secondary w-full">Repetir a semana passada</button>
            </FormDados>
          ) : null}
        </div>
      </header>

      {dias.map((d, k) => {
        const doDia = planejados.filter((p) => p.data === d);
        return (
          <section key={d} id={`dia-${d}`} aria-labelledby={`h-${d}`} className={`app-card scroll-mt-6 space-y-2 ${d === hoje ? "border-marca" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id={`h-${d}`} className="section-heading">{NOMES_DIA[k]} <span className="text-sm font-normal text-suave">{formatarDataBr(d)}{d === hoje ? " · hoje" : ""}</span></h2>
              <Link href={`/comida/planejar/adicionar?data=${d}`} aria-label={`Planejar ${NOMES_DIA[k]}`} className="flex min-h-11 items-center gap-1 rounded-xl border border-borda px-3 text-sm font-semibold"><Plus size={16} aria-hidden="true" />Planejar</Link>
            </div>
            {doDia.length === 0 ? (
              <p className="text-sm text-suave">Nada planejado.</p>
            ) : (
              REFEICOES.filter((r) => doDia.some((p) => p.refeicao === r)).map((r) => (
                <div key={r}>
                  <h3 className="eyebrow mt-2">{ROTULOS_REFEICAO[r]}</h3>
                  <ul>{doDia.filter((p) => p.refeicao === r).map((p) => <ItemPlanejado key={p.id} p={p} hoje={hoje} />)}</ul>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
