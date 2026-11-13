import Link from "next/link";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarReceitas } from "@/lib/dal/receitas";
import { Voltar } from "../comum";

export const metadata = { title: "Receitas · Kalyft" };

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default async function PaginaReceitas() {
  const { userId } = await exigirUsuario();
  const lista = await listarReceitas(userId);
  return (
    <div className="page-stack">
      <Voltar href="/comida" />
      <h1 className="page-heading">Receitas</h1>
      <p className="page-intro">Monte uma receita com os ingredientes e quantas porções ela rende. Ela vira um alimento seu, com a medida &quot;porção&quot;, para registrar no diário.</p>
      <Link href="/comida/receitas/nova" className="action-primary">
        Nova receita
      </Link>
      {lista.length === 0 ? (
        <p className="text-suave">Você ainda não tem receitas.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map((r) => {
            const porPorcao = r.kcalPor100g !== null ? (r.kcalPor100g * (r.pesoFinalG / r.porcoes)) / 100 : null;
            return (
              <li key={r.id}>
                <Link href={`/comida/receitas/${r.id}`} className="app-card block active:border-marca">
                  <span className="block text-lg font-bold">{r.nome}</span>
                  <span className="block text-sm text-suave">
                    {r.porcoes.toLocaleString("pt-BR")} {r.porcoes === 1 ? "porção" : "porções"}
                    {porPorcao !== null ? ` · ≈ ${n(porPorcao)} kcal por porção` : " · sem alimento ligado (abra e salve de novo)"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
