import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CampoBusca } from "@/components/campo-busca";
import { GradeAtalhos } from "@/components/grade-atalhos";
import { IconeFuncao } from "@/components/icone-funcao";
import { exigirContextoDados } from "@/lib/auth/acompanhamento";
import { BUSCA_MIN, normalizarBusca, palavrasDaBusca } from "@/lib/busca";
import { buscarFuncoes, funcoesDisponiveis, termoValido } from "@/lib/busca-funcoes";
import { buscarAlimentos } from "@/lib/dal/alimentos";
import { listarReceitas } from "@/lib/dal/receitas";
import { listarExercicios } from "@/lib/dal/treino";

export const metadata = { title: "Buscar · Kalyft" };

const LIMITE = 8;
const AREAS = ["Alimentação", "Treino", "Progresso", "Conta"] as const;

/** Todas as palavras do termo aparecem no nome (sem acento, começo de palavra). */
function combina(nome: string, palavras: string[]): boolean {
  const ws = normalizarBusca(nome).split(" ");
  return palavras.every((p) => ws.some((w) => w.startsWith(p)));
}

function Grupo({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="app-card space-y-2">
      <h2 id={id} className="section-heading">{titulo}</h2>
      <ul>{children}</ul>
    </section>
  );
}

function Linha({ href, titulo, detalhe }: { href: string; titulo: string; detalhe?: string | null }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 border-b border-linha py-2 last:border-b-0">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{titulo}</span>
          {detalhe ? <span className="block truncate text-sm text-suave">{detalhe}</span> : null}
        </span>
        <ChevronRight size={18} className="shrink-0 text-suave" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default async function PaginaBuscar(props: PageProps<"/buscar">) {
  const contexto = await exigirContextoDados();
  const { userId, modo } = contexto;
  const ctx = { modo, admin: contexto.admin !== null };
  const termo = termoValido((await props.searchParams).q);
  const palavras = palavrasDaBusca(normalizarBusca(termo));
  const buscarDados = normalizarBusca(termo).length >= BUSCA_MIN;

  const funcoes = buscarFuncoes(termo, ctx);
  const [alimentos, receitas, exercicios] = buscarDados
    ? await Promise.all([
        buscarAlimentos(userId, termo),
        listarReceitas(userId).then((l) => l.filter((r) => combina(r.nome, palavras))),
        listarExercicios(userId).then((l) => l.filter((e) => combina(e.nome, palavras))),
      ])
    : [[], [], []];
  const nada = termo !== "" && funcoes.length + alimentos.length + receitas.length + exercicios.length === 0;

  return (
    <div className="page-stack">
      <header className="space-y-4">
        <h1 className="page-heading">Buscar</h1>
        <CampoBusca valor={termo} autoFocus={termo === ""} />
      </header>

      {termo === "" ? (
        <section aria-labelledby="todas" className="app-card space-y-6">
          <h2 id="todas" className="section-heading">Todas as funções</h2>
          {AREAS.map((area) => {
            const itens = funcoesDisponiveis(ctx).filter((f) => f.area === area);
            return itens.length ? (
              <div key={area} className="space-y-3">
                <h3 className="eyebrow">{area}</h3>
                <GradeAtalhos rotulo={area} atalhos={itens.map((f) => ({ href: f.href, titulo: f.titulo, icone: f.icone }))} />
              </div>
            ) : null;
          })}
        </section>
      ) : null}

      {funcoes.length ? (
        <section aria-labelledby="r-funcoes" className="app-card space-y-2">
          <h2 id="r-funcoes" className="section-heading">Funções</h2>
          <ul>
            {funcoes.map((f) => (
              <li key={f.id}>
                <Link href={f.href} className="flex min-h-16 items-center gap-3 border-b border-linha py-2 last:border-b-0">
                  <span className="icon-badge"><IconeFuncao icone={f.icone} size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{f.titulo}</span>
                    <span className="block text-sm text-suave">{f.area} · {f.descricao}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-suave" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {alimentos.length ? (
        <Grupo id="r-alimentos" titulo="Alimentos">
          {alimentos.slice(0, LIMITE).map((a) => (
            <Linha key={`${a.tipo}-${a.id}`} href={`/comida/alimento/${a.tipo}/${a.id}`} titulo={a.nome} detalhe={[a.marca, a.kcal !== null ? `${Math.round(a.kcal)} kcal em 100 g` : null].filter(Boolean).join(" · ")} />
          ))}
        </Grupo>
      ) : null}

      {receitas.length ? (
        <Grupo id="r-receitas" titulo="Receitas">
          {receitas.slice(0, LIMITE).map((r) => <Linha key={r.id} href={`/comida/receitas/${r.id}`} titulo={r.nome} />)}
        </Grupo>
      ) : null}

      {exercicios.length ? (
        <Grupo id="r-exercicios" titulo="Exercícios">
          {exercicios.slice(0, LIMITE).map((e) => <Linha key={e.id} href={`/treino/exercicios/${e.id}`} titulo={e.nome} detalhe={e.grupo} />)}
        </Grupo>
      ) : null}

      {nada ? (
        <p className="app-card text-suave">
          Nada encontrado para “{termo}”. Tente outra palavra, como “peso”, “água” ou o nome de um alimento.
        </p>
      ) : null}
    </div>
  );
}
