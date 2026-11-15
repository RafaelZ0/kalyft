import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarSeriesDoDia, obterSessao, planoAtivo, ultimaSessaoDoExercicio } from "@/lib/dal/treino";
import { carregarTreinoDoDia } from "@/lib/dal/treino-do-dia";
import { hojeSaoPaulo } from "@/lib/datas";
import { dicaDeProgressao } from "@/lib/treino";
import { dataAteHoje } from "@/lib/validacao/treino";
import { SessaoCliente, type DicaTela, type ItemTela } from "./sessao-cliente";

export const metadata = { title: "Treinando · Kalyft" };

export default async function PaginaSessao(props: PageProps<"/treino/sessao">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const pedido = (await props.searchParams).data;
  const data = dataAteHoje.safeParse(typeof pedido === "string" ? pedido : hoje).data;
  if (!data) notFound();

  const plano = await planoAtivo(userId);
  if (!plano) redirect("/treino");
  const [dia, sessao, feitas] = await Promise.all([carregarTreinoDoDia(userId, plano, data), obterSessao(userId, data), listarSeriesDoDia(userId, data)]);
  if (!dia) redirect(`/treino?data=${data}`);
  const { treino } = dia;
  // Adaptação do dia já aplicada: séries reduzidas, pulados fora, e o exercício trocado vem primeiro nas opções.
  const itens = dia.doDia.map((i) => {
    const plano = [i.exercicio, ...i.substitutos];
    const escolhido = i.exercicioEscolhido ? (plano.find((e) => e.id === i.exercicioEscolhido) ?? dia.exercicios.find((e) => e.id === i.exercicioEscolhido)) : undefined;
    const opcoes = escolhido ? [escolhido, ...plano.filter((e) => e.id !== escolhido.id)] : plano;
    return { ...i, opcoes };
  });

  // Dica de progressão: última sessão anterior de cada exercício (principal e substitutos).
  const dicas: Record<string, DicaTela | null> = {};
  await Promise.all(
    itens.flatMap((i) => {
      const nSeries = i.series;
      return i.opcoes.map(async (ex) => {
        const ultima = await ultimaSessaoDoExercicio(userId, ex.id, data);
        const d = dicaDeProgressao(ultima, nSeries, i.repsMax, ex.medida === "segundos");
        dicas[`${i.id}:${ex.id}`] = d ? { ultima: d.ultima.map((s) => ({ numero: s.numero, cargaKg: s.cargaKg, repeticoes: s.repeticoes, segundos: s.segundos })), subirCarga: d.subirCarga } : null;
      });
    }),
  );

  const itensTela: ItemTela[] = itens.map((i) => ({
    id: i.id,
    series: i.series,
    repsMin: i.repsMin,
    repsMax: i.repsMax,
    descansoS: i.descansoS,
    observacao: i.observacao,
    opcoes: i.opcoes.map((e) => ({
      id: e.id,
      nome: e.nome,
      principal: e.id === i.exercicio.id,
      unilateral: e.unilateral,
      cargaPorHalter: e.cargaPorHalter,
      porSegundos: e.medida === "segundos",
      fotoId: e.fotoId,
    })),
  }));

  return (
    <div className="page-stack">
      <Link href={`/treino?data=${data}`} className="inline-flex min-h-11 items-center font-semibold text-suave">
        ‹ Voltar
      </Link>
      <h1 className="page-heading">{treino.nome}</h1>
      {dia.adaptacao ? (
        <p className="app-card text-sm">
          <span className="font-semibold">Treino adaptado para hoje.</span> <span className="text-suave">O plano continua igual.</span>{" "}
          <Link href={`/treino/adaptar?data=${data}`} className="font-semibold text-marca underline">Ajustar</Link>
        </p>
      ) : null}
      {itensTela.length === 0 ? (
        <p className="text-suave">
          Este treino não tem exercícios. <Link href="/treino/plano" className="underline">Adicionar no plano</Link>
        </p>
      ) : (
        <SessaoCliente
          data={data}
          treinoId={treino.id}
          itens={itensTela}
          dicas={dicas}
          feitas={feitas.map((f) => ({ ...f, cargaKg: Number(f.cargaKg) }))}
          observacao={sessao?.observacao ?? ""}
        />
      )}
    </div>
  );
}
