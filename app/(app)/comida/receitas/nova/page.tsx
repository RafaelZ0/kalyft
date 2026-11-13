import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { Voltar } from "../../comum";
import { EditorReceita } from "../editor";

export const metadata = { title: "Nova receita · Kalyft" };

export default async function PaginaNovaReceita() {
  const { userId, admin, modo } = await exigirUsuario();
  const acesso = modo === "proprio" ? await verificarAcessoIa(userId, admin !== null) : { ok: false };
  return (
    <div className="space-y-8">
      <Voltar href="/comida/receitas" />
      <h1 className="text-3xl font-black">Nova receita</h1>
      <EditorReceita nomeInicial="" porcoesInicial={4} pesoFinalInicial="" itensIniciais={[]} iaDisponivel={acesso.ok} />
    </div>
  );
}
