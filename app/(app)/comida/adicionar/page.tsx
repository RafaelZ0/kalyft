import { ScanBarcode, Sparkles, Plus } from "lucide-react";
import { SomenteContaPropria } from "@/components/contexto-dados";
import Link from "next/link";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { citacaoTaco, listarFavoritos, listarRecentes } from "@/lib/dal/alimentos";
import { hojeSaoPaulo } from "@/lib/datas";
import { dataDiario, refeicao as refeicaoSchema, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { CitacaoTaco, ListaAlimentos, Voltar, voltaQuery } from "../comum";
import { Busca } from "./busca";

export const metadata = { title: "Adicionar alimento · Kalyft" };

export default async function PaginaAdicionar(props: PageProps<"/comida/adicionar">) {
  const { userId } = await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data ?? hojeSaoPaulo();
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? "almoco";
  const volta = voltaQuery(data, ref);

  const [recentes, favs, citacao] = await Promise.all([
    listarRecentes(userId),
    listarFavoritos(userId),
    citacaoTaco(),
  ]);

  return (
    <div className="page-stack">
      <Voltar href={`/comida?data=${data}`} />
      <h1 className="page-heading">{ROTULOS_REFEICAO[ref]}</h1>
      <p className="page-intro">Busque um alimento ou escolha como quer registrar.</p>
      <div className="grid gap-3 sm:grid-cols-3">
      <SomenteContaPropria><Link
        href={`/comida/ia${volta}`}
        className="action-secondary gap-2"
      >
        <Sparkles size={19} aria-hidden="true" /> Texto ou foto com IA
      </Link></SomenteContaPropria>
      <SomenteContaPropria><Link
        href={`/comida/barras${volta}`}
        className="action-secondary gap-2"
      >
        <ScanBarcode size={19} aria-hidden="true" /> Código de barras
      </Link></SomenteContaPropria>
      <Link
        href={`/comida/meus-alimentos/novo${volta}`}
        className="action-secondary gap-2"
      >
        <Plus size={19} aria-hidden="true" /> Cadastrar pelo rótulo
      </Link>
      </div>
      <Busca volta={volta}>
        {favs.length > 0 ? (
          <section className="app-card space-y-2">
            <h2 className="text-lg font-bold">Favoritos</h2>
            <ListaAlimentos itens={favs} volta={volta} />
          </section>
        ) : null}
        {recentes.length > 0 ? (
          <section className="app-card space-y-2">
            <h2 className="text-lg font-bold">Recentes</h2>
            <ListaAlimentos itens={recentes} volta={volta} />
          </section>
        ) : null}
        {favs.length === 0 && recentes.length === 0 ? (
          <p className="text-suave">Digite o nome do alimento. Ex.: arroz, feijão, frango.</p>
        ) : null}
      </Busca>
      <CitacaoTaco citacao={citacao} />
    </div>
  );
}
