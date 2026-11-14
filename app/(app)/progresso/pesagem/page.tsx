import Link from "next/link";
import { FormDados } from "@/components/contexto-dados";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarPesagens } from "@/lib/dal/corpo";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { formatarGramas } from "@/lib/nutricao";
import { apagarPesagem } from "../actions";
import { FormPesagem } from "../form-pesagem";

export const metadata = { title: "Registrar peso · Kalyft" };

const txt = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export default async function PaginaPesagem() {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const lista = await listarPesagens(userId, somarDias(hoje, -365), 400);
  const hojeJa = lista.find((p) => p.data === hoje) ?? null;

  return (
    <div className="page-stack">
      <Link href="/progresso" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Progresso</Link>
      <header className="space-y-2">
        <h1 className="page-heading">Registrar peso</h1>
        <p className="page-intro">Idealmente em jejum, de manhã. Uma pesagem por dia; salvar de novo substitui a do dia.</p>
      </header>

      <section className="app-card">
        <FormPesagem
          hoje={hoje}
          atual={hojeJa ? { peso: txt(hojeJa.pesoKg), massaMagra: txt(hojeJa.massaMagraKg), cintura: txt(hojeJa.cinturaCm) } : null}
        />
      </section>

      <section id="historico" aria-labelledby="h-historico" className="app-card scroll-mt-6 space-y-2">
        <h2 id="h-historico" className="section-heading">Histórico</h2>
        {lista.length === 0 ? (
          <p className="text-suave">Seu primeiro registro é o começo do acompanhamento.</p>
        ) : (
          <ul>
            {lista.map((p) => (
              <li key={p.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-linha text-sm last:border-b-0">
                <span>
                  {formatarDataBr(p.data)} · <span className="font-semibold tabular-nums">{formatarGramas(p.pesoKg)} kg</span>
                  {p.massaMagraKg ? <span className="text-suave"> · magra {formatarGramas(p.massaMagraKg)} kg</span> : null}
                  {p.cinturaCm ? <span className="text-suave"> · cintura {formatarGramas(p.cinturaCm)} cm</span> : null}
                </span>
                <FormDados action={apagarPesagem}>
                  <input type="hidden" name="pesagemId" value={p.id} />
                  <button type="submit" className="min-h-11 px-3 font-semibold text-suave underline">Apagar</button>
                </FormDados>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
