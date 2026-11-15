import Link from "next/link";
import { exigirContaPropria as exigirUsuario } from "@/lib/auth/acompanhamento";
import { usoDoDia } from "@/lib/dal/ia";
import { metaVigente } from "@/lib/dal/metas";
import { listarDia } from "@/lib/dal/registros";
import { hojeSaoPaulo } from "@/lib/datas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { planoGratuito } from "@/lib/ia/config";
import { horaSaoPaulo, refeicaoDoHorario } from "@/lib/rotina";
import { refeicao as refeicaoSchema } from "@/lib/validacao/comida";
import { Voltar } from "../comum";
import { SugestoesFluxo } from "./sugestoes-fluxo";

export const metadata = { title: "O que posso fazer? · Kalyft" };

// Só da conta própria: a IA é pessoal (no acompanhamento, exigirContaPropria volta para Hoje).
export default async function PaginaSugestoes(props: PageProps<"/comida/sugestoes">) {
  const { userId, admin } = await exigirUsuario();
  const sp = await props.searchParams;
  const hoje = hojeSaoPaulo();
  const refeicao = refeicaoSchema.safeParse(sp.refeicao).data ?? refeicaoDoHorario(horaSaoPaulo());

  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) {
    return (
      <div className="page-stack">
        <Voltar href="/comida" />
        <h1 className="page-heading">O que posso fazer com o que tenho?</h1>
        <p className="page-intro">{acesso.erro}</p>
        {acesso.precisaAceite ? <Link href="/treino/ia" className="action-primary">Ler e aceitar o aviso da IA</Link> : null}
      </div>
    );
  }

  const [uso, estimativa, meta, registros] = await Promise.all([
    usoDoDia(userId, hoje, "sugestao"),
    usoDoDia(userId, hoje, "estimativa"),
    metaVigente(userId, hoje),
    listarDia(userId, hoje),
  ]);
  // Só para mostrar na prévia; a action recalcula no servidor se a pessoa marcar para enviar.
  const consumido = { kcal: registros.reduce((s, r) => s + Number(r.kcal), 0), proteinaG: registros.reduce((s, r) => s + Number(r.proteinaG ?? 0), 0) };
  const restante = meta ? { kcal: meta.kcal != null ? meta.kcal - consumido.kcal : null, proteinaG: meta.proteinaG != null ? meta.proteinaG - consumido.proteinaG : null } : null;

  return (
    <div className="page-stack">
      <Voltar href="/comida" />
      <header className="space-y-2">
        <h1 className="page-heading">O que posso fazer com o que tenho?</h1>
        <p className="page-intro">Diga os ingredientes e o tempo. A IA sugere opções simples; as calorias vêm da tabela do app.</p>
      </header>
      <SugestoesFluxo
        data={hoje}
        refeicaoInicial={refeicao}
        restante={restante}
        restanteUso={uso.limite - uso.usadas}
        restanteEstimativa={estimativa.limite - estimativa.usadas}
        gratuito={planoGratuito({ IA_PLANO: process.env.IA_PLANO })}
      />
    </div>
  );
}
