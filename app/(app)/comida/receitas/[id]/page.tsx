import { CircleCheck } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { obterReceita } from "@/lib/dal/receitas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { calcularReceita } from "@/lib/receita";
import { id as idSchema } from "@/lib/validacao/comida";
import { Voltar } from "../../comum";
import { excluirReceitaAcao } from "../actions";
import { EditorReceita } from "../editor";

export const metadata = { title: "Receita · Kalyft" };

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default async function PaginaReceita(props: PageProps<"/comida/receitas/[id]">) {
  const { userId, admin, modo } = await exigirUsuario();
  const params = await props.params;
  const sp = await props.searchParams;
  const id = idSchema.safeParse(params.id);
  if (!id.success) notFound();
  const r = await obterReceita(userId, id.data);
  if (!r) notFound();
  const acesso = modo === "proprio" ? await verificarAcessoIa(userId, admin !== null) : { ok: false };

  const calc = calcularReceita({
    ingredientes: r.itens.map((i) => ({ nome: i.nome, gramas: i.gramas, nutrientes: { kcal: i.kcal, proteinaG: i.proteinaG, carboG: i.carboG, gorduraG: i.gorduraG, fibraG: i.fibraG } })),
    porcoes: r.receita.porcoes,
    pesoFinalG: r.receita.pesoFinalG,
  });

  return (
    <div className="page-stack">
      <Voltar href="/comida/receitas" />
      <h1 className="page-heading">{r.receita.nome}</h1>
      {sp.salva === "1" ? <p role="status" className="rounded-2xl border-2 border-ok p-4 font-semibold text-ok"><CircleCheck size={18} aria-hidden="true" className="mr-2 inline" />Receita salva. Ela já está nos seus alimentos.</p> : null}

      {calc.ok ? (
        <section aria-labelledby="nutri" className="space-y-3">
          <h2 id="nutri" className="section-heading">Por porção ({n(calc.porPorcao.gramas)} g)</h2>
          <p className="text-4xl font-semibold">{n(calc.porPorcao.kcal)} <span className="text-lg font-bold text-suave">kcal</span></p>
          <p className="text-suave">
            Proteína {n(calc.porPorcao.proteinaG)} g · Carboidrato {n(calc.porPorcao.carboG)} g · Gordura {n(calc.porPorcao.gorduraG)} g · Fibra {n(calc.porPorcao.fibraG)} g
          </p>
          <p className="text-sm text-suave">Por 100 g: {n(calc.por100g.kcal)} kcal. Receita inteira: {n(calc.totais.kcal)} kcal em {n(calc.pesoFinalG)} g, {n(calc.porcoes)} {calc.porcoes === 1 ? "porção" : "porções"}.</p>
          {Object.values(calc.parcial).some(Boolean) ? <p className="text-sm font-medium text-aviso"><span aria-hidden="true">! </span>Algum ingrediente não tem todos os nutrientes na tabela: os valores de proteína, carboidrato, gordura ou fibra são parciais.</p> : null}
          {r.receita.alimentoUsuarioId ? (
            <Link href={`/comida/alimento/usuario/${r.receita.alimentoUsuarioId}`} className="flex min-h-12 items-center justify-center rounded-xl bg-destaque font-bold text-sobre-destaque">
              Registrar no diário
            </Link>
          ) : (
            <p className="text-sm font-medium text-aviso"><span aria-hidden="true">! </span>O alimento desta receita foi apagado em Meus alimentos. Salve a receita de novo para recriá-lo.</p>
          )}
          <p className="text-xs text-suave">Tudo é estimativa, calculada com a tabela e as quantidades que você informou.</p>
        </section>
      ) : null}

      <section aria-labelledby="editar" className="space-y-6">
        <h2 id="editar" className="section-heading">Editar</h2>
        <EditorReceita
          receitaId={r.receita.id}
          nomeInicial={r.receita.nome}
          porcoesInicial={r.receita.porcoes}
          pesoFinalInicial={String(r.receita.pesoFinalG).replace(".", ",")}
          itensIniciais={r.itens.map((i, k) => ({
            chave: k,
            tipo: i.alimentoUsuarioId ? "usuario" : "base",
            id: (i.alimentoUsuarioId ?? i.alimentoBaseId) as string,
            nome: i.nome,
            gramas: i.gramas,
            kcal100: i.kcal !== null && i.gramas > 0 ? (i.kcal / i.gramas) * 100 : null,
          }))}
          iaDisponivel={acesso.ok}
        />
        {r.itens.some((i) => !i.alimentoUsuarioId && !i.alimentoBaseId) ? (
          <p className="text-sm font-medium text-aviso"><span aria-hidden="true">! </span>Algum ingrediente foi apagado da tabela ou dos seus alimentos. Remova-o e escolha outro antes de salvar.</p>
        ) : null}
      </section>

      <FormDados action={excluirReceitaAcao}>
        <input type="hidden" name="receitaId" value={r.receita.id} />
        <button type="submit" className="min-h-12 w-full rounded-xl border border-erro font-semibold text-erro">Apagar receita</button>
      </FormDados>
    </div>
  );
}
