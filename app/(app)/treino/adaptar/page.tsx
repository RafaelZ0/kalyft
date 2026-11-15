import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormDados } from "@/components/contexto-dados";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { planoAtivo } from "@/lib/dal/treino";
import { carregarTreinoDoDia } from "@/lib/dal/treino-do-dia";
import { hojeSaoPaulo, rotuloDia } from "@/lib/datas";
import { alternativas, minutosEstimados, semAjuste } from "@/lib/treino-adaptado";
import { dataAteHoje } from "@/lib/validacao/treino";
import { removerAdaptacaoAcao } from "./actions";
import { AdaptarCliente, type ItemAdaptarTela } from "./adaptar-cliente";

export const metadata = { title: "Adaptar treino · Kalyft" };

export default async function PaginaAdaptar(props: PageProps<"/treino/adaptar">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const pedido = (await props.searchParams).data;
  const data = dataAteHoje.safeParse(typeof pedido === "string" ? pedido : hoje).data;
  if (!data) notFound();
  const plano = await planoAtivo(userId);
  if (!plano) redirect("/treino");
  const dia = await carregarTreinoDoDia(userId, plano, data);
  if (!dia || dia.completos.length === 0) redirect(`/treino?data=${data}`);

  const itens: ItemAdaptarTela[] = dia.completos.map((i) => ({
    id: i.id,
    nome: i.exercicio.nome,
    series: i.series,
    repsMax: i.repsMax,
    descansoS: i.descansoS,
    porSegundos: i.porSegundos,
    exercicioId: i.exercicioId,
    grupo: i.grupo,
    substitutos: i.substitutos.map((s) => ({ id: s.id, nome: s.nome })),
    alternativas: alternativas(i, dia.exercicios),
  }));

  return (
    <div className="page-stack">
      <Link href={`/treino?data=${data}`} className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Treino</Link>
      <header className="space-y-2">
        <h1 className="page-heading">Adaptar o treino</h1>
        <p className="page-intro">
          {dia.treino.nome} · {rotuloDia(data, hoje)}. Vale só para este dia: seu plano continua igual.
        </p>
      </header>
      <AdaptarCliente
        data={data}
        itens={itens}
        inicial={dia.adaptacao?.itens ?? semAjuste(dia.completos)}
        minutosInicial={dia.adaptacao?.minutos ?? null}
        minutosCompleto={minutosEstimados(dia.completos)}
      />
      {dia.adaptacao ? (
        <FormDados action={removerAdaptacaoAcao} className="text-center">
          <input type="hidden" name="data" value={data} />
          <button type="submit" className="min-h-11 font-semibold text-suave underline">Voltar ao treino completo</button>
        </FormDados>
      ) : null}
    </div>
  );
}
