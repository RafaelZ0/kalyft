import { notFound } from "next/navigation";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarReceitas } from "@/lib/dal/receitas";
import { listarRefeicoesSalvas } from "@/lib/dal/refeicoes-salvas";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import { dataPlanejavel, semanaDoPlanejamento } from "@/lib/planejamento";
import { horaSaoPaulo, refeicaoDoHorario } from "@/lib/rotina";
import { refeicao as refeicaoSchema } from "@/lib/validacao/comida";
import { Voltar } from "../../comum";
import { AdicionarPlanejado } from "./adicionar-cliente";

export const metadata = { title: "Planejar refeição · Kalyft" };

export default async function PaginaAdicionarPlanejado(props: PageProps<"/comida/planejar/adicionar">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const sp = await props.searchParams;
  const data = typeof sp.data === "string" ? sp.data : hoje;
  if (!dataPlanejavel(data, hoje)) notFound();
  const refeicao = refeicaoSchema.safeParse(sp.refeicao).data ?? refeicaoDoHorario(horaSaoPaulo());
  const [receitas, salvas] = await Promise.all([listarReceitas(userId), listarRefeicoesSalvas(userId)]);

  return (
    <div className="page-stack">
      <Voltar href={`/comida/planejar?semana=${semanaDoPlanejamento(data, hoje)}#dia-${data}`} />
      <header className="space-y-2">
        <h1 className="page-heading">Planejar</h1>
        <p className="page-intro">{formatarDataBr(data)}. Escolha uma receita, uma refeição salva ou um alimento.</p>
      </header>
      <AdicionarPlanejado
        data={data}
        refeicaoInicial={refeicao}
        receitas={receitas.map((r) => ({ id: r.id, nome: r.nome }))}
        salvas={salvas.map((s) => ({ id: s.id, nome: s.nome, itens: s.itens }))}
      />
    </div>
  );
}
