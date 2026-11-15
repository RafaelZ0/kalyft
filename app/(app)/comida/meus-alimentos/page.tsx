import Link from "next/link";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { FormDados } from "@/components/contexto-dados";
import { listarMeusAlimentos } from "@/lib/dal/alimentos";
import { listarOcultos } from "@/lib/dal/rotina";
import { ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { reexibirNaRotinaAcao } from "../../hoje/actions";
import { formatarKcal } from "@/lib/nutricao";
import { Voltar } from "../comum";

export const metadata = { title: "Meus alimentos · Kalyft" };

export default async function PaginaMeusAlimentos() {
  const { userId } = await exigirUsuario();
  const [alimentos, ocultos] = await Promise.all([listarMeusAlimentos(userId), listarOcultos(userId)]);
  return (
    <div className="page-stack">
      <Voltar href="/comida" />
      <h1 className="page-heading">Meus alimentos</h1>
      <Link href="/comida/meus-alimentos/novo" className="action-primary">
        + Cadastrar pelo rótulo
      </Link>
      {alimentos.length === 0 ? (
        <p className="text-suave">Você ainda não cadastrou alimentos.</p>
      ) : (
        <ul>
          {alimentos.map((a) => (
            <li key={a.id}>
              <Link href={`/comida/meus-alimentos/${a.id}`} className="flex min-h-14 items-center justify-between gap-4 border-b border-linha py-2">
                <span>
                  <span className="block font-medium">{a.nome}</span>
                  {a.marca ? <span className="text-sm text-suave">{a.marca}</span> : null}
                </span>
                <span className="shrink-0 text-sm text-suave">{formatarKcal(a.kcal)} kcal/100 g</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {ocultos.length ? (
        <section aria-labelledby="ocultos" className="app-card space-y-2">
          <h2 id="ocultos" className="section-heading">Escondidos da rotina</h2>
          <p className="text-sm text-suave">Estes alimentos não aparecem em &quot;Sua rotina&quot;, no Hoje.</p>
          <ul>
            {ocultos.map((o) => (
              <li key={o.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-linha text-sm last:border-b-0">
                <span><span className="font-semibold">{o.nome}</span> <span className="text-suave">· {ROTULOS_REFEICAO[o.refeicao]}</span></span>
                <FormDados action={reexibirNaRotinaAcao}>
                  <input type="hidden" name="id" value={o.id} />
                  <button type="submit" className="min-h-11 px-2 font-semibold text-marca underline">Mostrar de novo</button>
                </FormDados>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
