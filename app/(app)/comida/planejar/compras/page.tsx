import Link from "next/link";
import { Check } from "lucide-react";
import { FormDados } from "@/components/contexto-dados";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { ingredientesDoPeriodo, marcasDaSemana } from "@/lib/dal/planejamento";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import { diasDaSemana, listaDeCompras, semanaDoPlanejamento, textoQuantidade } from "@/lib/planejamento";
import { Voltar } from "../../comum";
import { alternarAvulsoAcao, alternarCompradoAcao, removerAvulsoAcao } from "../actions";
import { AdicionarAvulso } from "./avulso";

export const metadata = { title: "Lista de compras · Kalyft" };

function Marcador({ comprado }: { comprado: boolean }) {
  return (
    <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${comprado ? "border-ok bg-ok text-fundo" : "border-borda"}`}>
      {comprado ? <Check size={16} /> : null}
    </span>
  );
}

export default async function PaginaCompras(props: PageProps<"/comida/planejar/compras">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const semana = semanaDoPlanejamento((await props.searchParams).semana, hoje);
  const dias = diasDaSemana(semana);
  const [expandidos, marcas] = await Promise.all([ingredientesDoPeriodo(userId, dias[0], dias[6]), marcasDaSemana(userId, semana)]);
  const lista = listaDeCompras(expandidos);
  const grupos = [...new Set(lista.map((i) => i.grupo ?? "Outros"))];
  const faltam = lista.filter((i) => !marcas.comprados.has(i.chave)).length + marcas.avulsos.filter((a) => !a.comprado).length;

  return (
    <div className="page-stack">
      <Voltar href={`/comida/planejar?semana=${semana}`} />
      <header className="space-y-2">
        <h1 className="page-heading">Lista de compras</h1>
        <p className="page-intro">{formatarDataBr(dias[0])} a {formatarDataBr(dias[6])}. Soma dos ingredientes do que você planejou (quantidades arredondadas para cima).</p>
        {lista.length || marcas.avulsos.length ? <p className="text-sm font-semibold">{faltam === 0 ? "Tudo comprado." : `${faltam} ${faltam === 1 ? "item falta" : "itens faltam"}.`}</p> : null}
      </header>

      {lista.length === 0 ? (
        <p className="app-card text-suave">
          Nada planejado nesta semana ainda. <Link href={`/comida/planejar?semana=${semana}`} className="font-semibold text-marca underline">Planejar refeições</Link>
        </p>
      ) : (
        grupos.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`} className="app-card space-y-1">
            <h2 id={`g-${g}`} className="eyebrow">{g}</h2>
            <ul>
              {lista.filter((i) => (i.grupo ?? "Outros") === g).map((i) => {
                const comprado = marcas.comprados.has(i.chave);
                return (
                  <li key={i.chave}>
                    <FormDados action={alternarCompradoAcao}>
                      <input type="hidden" name="semana" value={semana} />
                      <input type="hidden" name="chave" value={i.chave} />
                      <button type="submit" aria-pressed={comprado} className="flex min-h-12 w-full items-center gap-3 border-b border-linha py-2 text-left last:border-b-0">
                        <Marcador comprado={comprado} />
                        <span className={`min-w-0 flex-1 ${comprado ? "text-suave line-through" : ""}`}>{i.nome}</span>
                        <span className="shrink-0 tabular-nums text-sm text-suave">{textoQuantidade(i.gramas)}</span>
                      </button>
                    </FormDados>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <section aria-labelledby="avulsos" className="app-card space-y-3">
        <h2 id="avulsos" className="section-heading">Outros itens</h2>
        {marcas.avulsos.length ? (
          <ul>
            {marcas.avulsos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 border-b border-linha last:border-b-0">
                <FormDados action={alternarAvulsoAcao} className="min-w-0 flex-1">
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" aria-pressed={a.comprado} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
                    <Marcador comprado={a.comprado} />
                    <span className={`min-w-0 flex-1 ${a.comprado ? "text-suave line-through" : ""}`}>{a.texto}</span>
                  </button>
                </FormDados>
                <FormDados action={removerAvulsoAcao}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" aria-label={`Tirar ${a.texto} da lista`} className="min-h-11 px-2 text-sm font-semibold text-suave underline">Tirar</button>
                </FormDados>
              </li>
            ))}
          </ul>
        ) : null}
        <AdicionarAvulso semana={semana} />
      </section>
    </div>
  );
}
