import { FormDados } from "@/components/contexto-dados";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FotoExercicio } from "@/components/foto-exercicio";
import { CartaoGrafico, PoucosDados } from "@/components/cartao-grafico";
import { GraficoLinhas } from "@/components/graficos";
import { PERIODOS, ROTULOS_PERIODO, type Periodo } from "@/lib/painel-energia";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { evolucaoDoExercicio, obterExercicio } from "@/lib/dal/treino";
import { diasEntre } from "@/lib/treino";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { id as idSchema } from "@/lib/validacao/treino";
import { apagarExercicio } from "../../actions";
import { FormExercicio } from "../form-exercicio";

export const metadata = { title: "Exercício · Kalyft" };

export default async function PaginaExercicio(props: PageProps<"/treino/exercicios/[id]">) {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse((await props.params).id);
  if (!id.success) notFound();
  const ex = await obterExercicio(userId, id.data);
  if (!ex) notFound();
  const todas = await evolucaoDoExercicio(userId, ex.id);
  const sp = await props.searchParams;
  const periodo: Periodo = sp.periodo === "4s" || sp.periodo === "3m" ? sp.periodo : "tudo";
  const desde = somarDias(hojeSaoPaulo(), -PERIODOS[periodo]);
  const evolucao = todas.filter((e) => e.data >= desde);
  const primeira = evolucao[0]?.data;
  const recorde = todas.length ? Math.max(...todas.map((e) => e.cargaMax)) : null;
  const kg = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <div className="page-stack">
      <Link href="/treino/exercicios" className="inline-flex min-h-11 items-center font-semibold text-suave">
        ‹ Voltar
      </Link>
      <h1 className="page-heading leading-tight">{ex.nome}</h1>
      <FotoExercicio fotoId={ex.fotoId} nome={ex.nome} />

      <section aria-labelledby="evolucao" className="app-card space-y-4">
        <h2 id="evolucao" className="section-heading">Evolução</h2>
        <nav aria-label="Período" className="flex gap-2">
          {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
            <Link
              key={p}
              href={`/treino/exercicios/${ex.id}?periodo=${p}`}
              aria-current={p === periodo ? "true" : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold ${p === periodo ? "border-marca bg-marca-suave text-marca" : "border-borda text-suave"}`}
            >
              {ROTULOS_PERIODO[p]}
            </Link>
          ))}
        </nav>
        <CartaoGrafico
          id="g-carga"
          rotulo="Maior carga · última sessão"
          valor={evolucao.length ? kg(evolucao.at(-1)!.cargaMax) : null}
          unidade="kg"
          contexto={recorde !== null ? `recorde ${kg(recorde)} kg` : null}
        >
          {evolucao.length >= 3 ? (
            <GraficoLinhas
              titulo={`Maior carga por sessão de ${ex.nome}`}
              unidade="kg"
              eixoX={{ tipo: "dias", inicio: primeira! }}
              series={[{ nome: "Maior carga", tipo: "linha", pontos: evolucao.map((e) => ({ x: diasEntre(primeira!, e.data), y: e.cargaMax })) }]}
            />
          ) : (
            <PoucosDados itens={[]} mensagem="O gráfico aparece a partir da terceira sessão com este exercício no período." />
          )}
        </CartaoGrafico>
        {evolucao.length > 0 ? (
          <ul>
            {[...evolucao].reverse().slice(0, 20).map((e) => (
              <li key={e.data} className="flex min-h-11 items-center justify-between border-b border-linha text-sm">
                <span>{formatarDataBr(e.data)}</span>
                <span className="font-semibold">
                  {e.cargaMax.toLocaleString("pt-BR")} kg <span className="font-normal text-suave">· {e.series} séries</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="editar" className="space-y-4 border-t border-linha pt-8">
        <h2 id="editar" className="section-heading">Editar</h2>
        <FormExercicio
          valores={{ id: ex.id, nome: ex.nome, grupo: ex.grupo ?? "", unilateral: ex.unilateral, cargaPorHalter: ex.cargaPorHalter, medida: ex.medida, fotoId: ex.fotoId ?? "" }}
        />
        <FormDados action={apagarExercicio} className="pt-4">
          <input type="hidden" name="exercicioId" value={ex.id} />
          <button type="submit" className="min-h-12 w-full rounded-xl border-2 border-erro font-semibold text-erro">
            Apagar exercício (apaga também as séries registradas)
          </button>
        </FormDados>
      </section>
    </div>
  );
}
