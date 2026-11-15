import Link from "next/link";
import { exigirContaPropria as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarLembretes } from "@/lib/dal/lembretes";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import { LIMITES_LEMBRETE } from "@/lib/lembretes";
import { chavePublicaVapid } from "@/lib/push";
import { pausarTodosAcao } from "./actions";
import { Aparelho } from "./aparelho";
import { ListaLembretes } from "./lista";

export const metadata = { title: "Lembretes · Kalyft" };

export default async function PaginaLembretes() {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const lembretes = await listarLembretes(userId);
  const pausaGeral = lembretes.length > 0 && lembretes.every((l) => l.pausadoAte !== null && l.pausadoAte >= hoje)
    ? lembretes.reduce((min, l) => (l.pausadoAte! < min ? l.pausadoAte! : min), lembretes[0].pausadoAte!)
    : null;

  return (
    <div className="space-y-12">
      <Link href="/ajustes" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Voltar</Link>
      <header className="space-y-3">
        <h1 className="page-heading">Lembretes</h1>
        <p className="text-lg text-suave">
          Avisos no celular nos horários que você escolher. Sem cobrança: se você já registrou, o lembrete fica quieto.
        </p>
      </header>

      <section aria-labelledby="aparelho" className="space-y-4">
        <h2 id="aparelho" className="section-heading">Este aparelho</h2>
        <Aparelho chavePublica={chavePublicaVapid()} />
      </section>

      <section aria-labelledby="meus" className="space-y-4">
        <h2 id="meus" className="section-heading">Meus lembretes</h2>
        <ListaLembretes
          lembretes={lembretes.map((l) => ({
            id: l.id,
            tipo: l.tipo,
            refeicao: l.refeicao,
            minuto: l.minuto,
            dias: l.dias,
            ativo: l.ativo,
            silenciarFeito: l.silenciarFeito,
            pausadoAte: l.pausadoAte,
          }))}
          hoje={hoje}
          podeCriar={lembretes.length < LIMITES_LEMBRETE.porPessoa}
        />
        <p className="text-sm text-suave">O aviso pode chegar alguns minutos depois do horário escolhido.</p>
      </section>

      {lembretes.length > 0 ? (
        <section aria-labelledby="pausar" className="space-y-4">
          <h2 id="pausar" className="section-heading">Dar um tempo</h2>
          {pausaGeral ? (
            <form action={pausarTodosAcao} className="space-y-3">
              <p className="text-lg">Todos os lembretes pausados até {formatarDataBr(pausaGeral)}.</p>
              <input type="hidden" name="retomar" value="1" />
              <button type="submit" className="action-secondary w-full">Retomar agora</button>
            </form>
          ) : (
            <div className="space-y-2">
              <p className="text-suave">Pausar todos os lembretes por:</p>
              <div className="grid grid-cols-3 gap-2">
                {LIMITES_LEMBRETE.pausarDias.map((d) => (
                  <form key={d} action={pausarTodosAcao}>
                    <input type="hidden" name="dias" value={d} />
                    <button type="submit" className="action-secondary w-full">{d === 1 ? "Hoje" : `${d} dias`}</button>
                  </form>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
