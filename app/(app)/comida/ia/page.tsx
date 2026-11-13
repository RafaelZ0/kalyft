import Link from "next/link";
import { exigirContaPropria as exigirUsuario } from "@/lib/auth/acompanhamento";
import { usoDoDia } from "@/lib/dal/ia";
import { hojeSaoPaulo } from "@/lib/datas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { planoGratuito } from "@/lib/ia/config";
import { dataDiario, refeicao as refeicaoSchema, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { Voltar, voltaQuery } from "../comum";
import { FluxoRefeicao } from "./fluxo";

export const metadata = { title: "Registrar com IA · Kalyft" };

export default async function PaginaRefeicaoIa(props: PageProps<"/comida/ia">) {
  const { userId, admin } = await exigirUsuario();
  const sp = await props.searchParams;
  const data = dataDiario.safeParse(sp.data).data ?? hojeSaoPaulo();
  const ref = refeicaoSchema.safeParse(sp.refeicao).data ?? "almoco";
  const volta = voltaQuery(data, ref);

  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) {
    return (
      <div className="page-stack">
        <Voltar href={`/comida/adicionar${volta}`} />
        <h1 className="page-heading">Registrar com IA</h1>
        <p className="page-intro">{acesso.erro}</p>
        {acesso.precisaAceite ? (
          <Link href="/treino/ia" className="action-primary">
            Ler e aceitar o aviso da IA
          </Link>
        ) : null}
      </div>
    );
  }

  const [texto, estimativa] = await Promise.all([usoDoDia(userId, hojeSaoPaulo(), "texto"), usoDoDia(userId, hojeSaoPaulo(), "estimativa")]);
  return (
    <div className="page-stack">
      <Voltar href={`/comida/adicionar${volta}`} />
      <h1 className="page-heading">{ROTULOS_REFEICAO[ref]}</h1>
      <FluxoRefeicao
        data={data}
        refeicao={ref}
        rotuloRefeicao={ROTULOS_REFEICAO[ref]}
        gratuito={planoGratuito({ IA_PLANO: process.env.IA_PLANO })}
        restanteTexto={texto.limite - texto.usadas}
        restanteEstimativa={estimativa.limite - estimativa.usadas}
      />
    </div>
  );
}
