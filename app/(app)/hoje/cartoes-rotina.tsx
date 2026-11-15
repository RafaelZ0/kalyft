import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { formatarDataBr } from "@/lib/datas";
import type { Pausa } from "@/lib/retomar";
import type { ItemRotina as Item } from "@/lib/rotina";
import { REFEICOES, ROTULOS_REFEICAO, type Refeicao } from "@/lib/validacao/comida";
import { marcarPausaAcao } from "./actions";
import { ItemRotina } from "./item-rotina";

/** "Sua rotina": alimentos habituais da refeição escolhida (por padrão, a do horário). Some sem histórico. */
export function CartaoRotina({ refeicao, itens, temOutras }: { refeicao: Refeicao; itens: Item[]; temOutras: Refeicao[] }) {
  if (itens.length === 0 && temOutras.length === 0) return null;
  return (
    <section aria-labelledby="rotina" className="app-card space-y-3">
      <div className="space-y-1">
        <h2 id="rotina" className="section-heading">Sua rotina</h2>
        <p className="text-sm text-suave">O que você costuma comer. Ajuste a porção e registre em um toque.</p>
      </div>
      <nav aria-label="Refeição da rotina" className="flex flex-wrap gap-2">
        {REFEICOES.filter((r) => r === refeicao || temOutras.includes(r)).map((r) => (
          <Link
            key={r}
            href={`/hoje?rotina=${r}#rotina`}
            aria-current={r === refeicao ? "true" : undefined}
            className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${r === refeicao ? "bg-destaque text-sobre-destaque" : "border border-borda text-suave"}`}
          >
            {ROTULOS_REFEICAO[r]}
          </Link>
        ))}
      </nav>
      {itens.length ? (
        <ul className="divide-y divide-linha">{itens.map((i) => <ItemRotina key={`${refeicao}-${i.tipo}-${i.alimentoId}`} item={i} refeicao={refeicao} />)}</ul>
      ) : (
        <p className="text-sm text-suave">Nada habitual pendente nesta refeição hoje.</p>
      )}
    </section>
  );
}

/** "Retomar de hoje": aparece depois de alguns dias sem atividade e some no primeiro registro do dia. */
export function CartaoRetomar({ pausa, hoje, temPlano, editavel, marcada }: { pausa: Pausa; hoje: string; temPlano: boolean; editavel: boolean; marcada: boolean }) {
  return (
    <section aria-labelledby="retomar" className="app-card space-y-4 border-marca">
      <div className="flex items-start gap-3">
        <span className="icon-badge"><RotateCcw size={20} aria-hidden="true" /></span>
        <div className="space-y-1">
          <h2 id="retomar" className="section-heading">Vamos retomar de onde você está</h2>
          <p className="text-sm text-suave">
            Seu histórico e seu plano continuam aqui. Não precisa preencher os dias que passaram; comece por uma coisa simples hoje.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Link href={`/comida/adicionar?data=${hoje}`} className="flex min-h-12 items-center justify-center rounded-xl bg-destaque px-4 text-sm font-bold text-sobre-destaque">Registrar uma refeição</Link>
        <Link href="/progresso/pesagem" className="flex min-h-12 items-center justify-center rounded-xl border border-borda px-4 text-sm font-semibold">Registrar o peso</Link>
        <Link href="/treino" className="flex min-h-12 items-center justify-center rounded-xl border border-borda px-4 text-sm font-semibold">{temPlano ? "Ver o treino de hoje" : "Montar um treino"}</Link>
      </div>
      {marcada ? (
        <p className="border-t border-linha pt-3 text-sm text-suave">Esses dias estão marcados como pausa no calendário.</p>
      ) : editavel ? (
        <FormDados action={marcarPausaAcao} className="border-t border-linha pt-3">
          <button type="submit" className="min-h-11 text-left text-sm font-semibold text-suave underline">
            Marcar {pausa.dias === 1 ? "o dia" : `os ${pausa.dias} dias`} de {formatarDataBr(pausa.inicio)} a {formatarDataBr(pausa.fim)} como pausa
          </button>
        </FormDados>
      ) : null}
    </section>
  );
}
