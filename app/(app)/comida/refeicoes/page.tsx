import { FormDados } from "@/components/contexto-dados";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarRefeicoesSalvas } from "@/lib/dal/refeicoes-salvas";
import { hojeSaoPaulo } from "@/lib/datas";
import { comArtigo, dataDiario, refeicao as refeicaoSchema } from "@/lib/validacao/comida";
import { apagarRefeicaoSalva } from "../actions";
import { Voltar } from "../comum";
import { UsarRefeicao } from "./usar";

export const metadata = { title: "Refeições salvas · Kalyft" };

export default async function PaginaRefeicoes(props: PageProps<"/comida/refeicoes">) {
  const { userId } = await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data ?? hojeSaoPaulo();
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? null;
  const salvas = await listarRefeicoesSalvas(userId);

  return (
    <div className="page-stack">
      <Voltar href={`/comida?data=${data}`} />
      <h1 className="page-heading">Refeições salvas</h1>
      <p className="text-suave">
        Para salvar uma refeição, abra o dia em Comida e toque em &quot;Mais&quot; na refeição. Ao usar, os nutrientes são recalculados.
      </p>
      {salvas.length === 0 ? <p className="text-suave">Nenhuma refeição salva ainda.</p> : null}
      <ul className="space-y-4">
        {salvas.map((s) => (
          <li key={s.id} className="space-y-3 app-card">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lg font-bold">{s.nome}</span>
              <span className="text-sm text-suave">{s.itens} itens</span>
            </div>
            {ref ? (
              <UsarRefeicao refeicaoSalvaId={s.id} data={data} refeicao={ref} rotulo={`Usar ${comArtigo(ref, "em")}`} />
            ) : null}
            <FormDados action={apagarRefeicaoSalva}>
              <input type="hidden" name="refeicaoSalvaId" value={s.id} />
              <button type="submit" className="min-h-11 text-sm font-semibold text-suave underline">
                Apagar
              </button>
            </FormDados>
          </li>
        ))}
      </ul>
    </div>
  );
}
