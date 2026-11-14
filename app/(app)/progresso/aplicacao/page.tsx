import Link from "next/link";
import { FormDados } from "@/components/contexto-dados";
import { exigirContaPropria } from "@/lib/auth/acompanhamento";
import { datasDeAplicacao, obterDiaAplicacao } from "@/lib/dal/corpo";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { aplicacaoPendente, NOMES_DIA } from "@/lib/treino";
import { desfazerAplicacao, marcarAplicacao, salvarDiaAplicacao } from "../actions";

export const metadata = { title: "Aplicação semanal · Kalyft" };

// Recurso só da conta própria: no acompanhamento, exigirContaPropria volta para Hoje.
export default async function PaginaAplicacao() {
  const { userId } = await exigirContaPropria();
  const hoje = hojeSaoPaulo();
  const [diaAplic, aplicacoes] = await Promise.all([obterDiaAplicacao(userId), datasDeAplicacao(userId, somarDias(hoje, -90))]);
  const pendente = aplicacaoPendente(hoje, diaAplic, aplicacoes);

  return (
    <div className="page-stack">
      <Link href="/progresso" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Progresso</Link>
      <header className="space-y-2">
        <h1 className="page-heading">Aplicação semanal</h1>
        <p className="page-intro">Só um registro de &quot;feito&quot; no dia que você escolher. O app não dá orientação sobre medicação.</p>
      </header>

      {pendente ? (
        <FormDados action={marcarAplicacao} className="app-card space-y-3 border-marca">
          <p className="font-semibold">Hoje é o dia da aplicação.</p>
          <input type="hidden" name="data" value={hoje} />
          <button type="submit" className="min-h-12 w-full rounded-xl bg-destaque font-bold text-sobre-destaque">Marcar como feita</button>
        </FormDados>
      ) : null}

      <section aria-labelledby="h-lembrete" className="app-card space-y-4">
        <h2 id="h-lembrete" className="section-heading">Lembrete</h2>
        <FormDados action={salvarDiaAplicacao} className="flex items-end gap-3">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-suave">Lembrar aos</span>
            <select name="dia" defaultValue={diaAplic === null ? "" : String(diaAplic)} className="min-h-12 w-full rounded-xl border border-borda bg-superficie px-3 text-lg font-semibold">
              <option value="">Sem lembrete</option>
              {NOMES_DIA.map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
          </label>
          <button type="submit" className="min-h-12 rounded-xl border border-borda px-5 font-semibold">Salvar</button>
        </FormDados>
      </section>

      <section aria-labelledby="h-registros" className="app-card space-y-2">
        <h2 id="h-registros" className="section-heading">Últimas aplicações</h2>
        {aplicacoes.length === 0 ? <p className="text-suave">Nenhuma aplicação registrada nos últimos 90 dias.</p> : (
          <ul>
            {aplicacoes.map((d) => (
              <li key={d} className="flex min-h-12 items-center justify-between border-b border-linha text-sm last:border-b-0">
                <span>{formatarDataBr(d)}</span>
                {d === hoje ? (
                  <FormDados action={desfazerAplicacao}>
                    <input type="hidden" name="data" value={hoje} />
                    <button type="submit" className="min-h-11 px-3 font-semibold underline">Desfazer</button>
                  </FormDados>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
