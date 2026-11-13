import Link from "next/link";
import { exigirAdmin } from "@/lib/auth/sessao";
import { listarAlunos } from "@/lib/dal/acompanhamento";
import { CampoContexto } from "@/components/contexto-dados";
import { iniciarAcompanhamento } from "./actions";

export const metadata = { title: "Alunos · Kalyft" };

export default async function PaginaAlunos({ searchParams }: { searchParams: Promise<{ busca?: string; pagina?: string }> }) {
  const admin = await exigirAdmin();
  const parametros = await searchParams;
  const busca = typeof parametros.busca === "string" ? parametros.busca.trim().slice(0, 100) : "";
  const pagina = Math.min(100_000, Math.max(1, Number.parseInt(parametros.pagina ?? "1", 10) || 1));
  const alunos = await listarAlunos(admin, busca, pagina);
  const endereco = (numero: number) => `/ajustes/alunos?${new URLSearchParams({ busca, pagina: String(numero) })}`;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link href="/ajustes" className="inline-flex min-h-11 items-center text-sm font-semibold text-suave">← Ajustes</Link>
        <h1 className="text-4xl font-black tracking-tight">Alunos</h1>
        <p className="text-suave">Acompanhe alimentação, treino e evolução. A edição e as fotos precisam de autorizações separadas.</p>
      </div>
      <form method="get" className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Buscar por nome ou e-mail</span>
          <input name="busca" type="search" defaultValue={busca} maxLength={100} className="min-h-12 w-full rounded-xl border-2 border-borda bg-transparent px-4" />
        </label>
        <button className="min-h-12 rounded-full bg-destaque font-bold text-sobre-destaque">Buscar</button>
      </form>
      {alunos.length ? <ul className="divide-y divide-linha">
        {alunos.map((aluno) => <li key={aluno.userId} className="space-y-3 py-5">
          <div>
            <p className="text-lg font-bold break-words">{aluno.nome || "Aluno sem nome"}</p>
            <p className="text-sm break-all text-suave">{aluno.email}</p>
          </div>
          <form action={iniciarAcompanhamento}>
            <CampoContexto />
            <input type="hidden" name="alunoId" value={aluno.userId} />
            <button className="min-h-12 w-full rounded-full border-2 border-borda px-4 font-semibold">Acompanhar</button>
          </form>
        </li>)}
      </ul> : <p className="rounded-2xl border-2 border-linha p-5 text-suave">{busca ? "Nenhum aluno encontrado para esta busca." : "Nenhum aluno aprovado disponível."}</p>}
      <nav aria-label="Páginas de alunos" className="flex items-center justify-between gap-3">
        {pagina > 1 ? <Link href={endereco(pagina - 1)} className="inline-flex min-h-12 items-center rounded-full border-2 border-borda px-4 font-semibold">Anterior</Link> : <span />}
        <span className="text-sm text-suave">Página {pagina}</span>
        {alunos.length === 20 ? <Link href={endereco(pagina + 1)} className="inline-flex min-h-12 items-center rounded-full border-2 border-borda px-4 font-semibold">Próxima</Link> : <span />}
      </nav>
    </div>
  );
}
