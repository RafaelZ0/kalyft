import { FormDados } from "@/components/contexto-dados";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { historicoMetas, metaVigente } from "@/lib/dal/metas";
import { obterPerfil } from "@/lib/dal/perfil";
import { hojeSaoPaulo } from "@/lib/datas";
import type { Meta } from "@/lib/db/schema";
import Link from "next/link";
import { sair } from "../../acoes";
import { PainelMetas, PainelPerfil, type MetaTela } from "./paineis";
import { SeletorAparencia } from "@/components/aparencia";
import { iniciarTutorialAcao } from "../tutorial-actions";
import { AVISO_PRIVACIDADE } from "@/lib/aviso-privacidade";

export const metadata = { title: "Conta · Kalyft" };

// Só os campos necessários vão para o navegador (sem user_id nem ids).
function paraTela(m: Meta): MetaTela {
  return {
    vigenteDesde: m.vigenteDesde,
    kcal: m.kcal,
    proteinaG: m.proteinaG,
    carboG: m.carboG,
    gorduraG: m.gorduraG,
    aguaMl: m.aguaMl,
    pesoMetaKg: m.pesoMetaKg,
    dataMeta: m.dataMeta,
    observacao: m.observacao,
  };
}

export default async function PaginaAjustes() {
  const { userId, admin, modo } = await exigirUsuario();
  const [perfil, meta, historico] = await Promise.all([
    obterPerfil(userId),
    metaVigente(userId, hojeSaoPaulo()),
    historicoMetas(userId),
  ]);

  return (
    <div className="page-stack max-w-4xl">
      <header><h1 className="page-heading">Conta</h1><p className="page-intro">Seu perfil, suas metas e o Kalyft do seu jeito.</p></header>
      <section className="app-card"><SeletorAparencia /></section>
      {modo === "proprio" ? <section className="space-y-3" aria-label="Acompanhamento">
        {admin ? <Link href="/ajustes/alunos" className="block rounded-2xl border border-marca p-4 font-bold">Alunos <span className="block text-sm font-normal text-suave">Acompanhar alimentação, treino e evolução</span></Link> : null}
        <Link href="/ajustes/acompanhamento" className="block rounded-2xl border border-linha p-4 font-bold">Acompanhamento <span className="block text-sm font-normal text-suave">Solicitações, autorizações e histórico de alterações</span></Link>
        {admin ? null : <p data-teste="aviso-privacidade" className="text-sm text-suave">{AVISO_PRIVACIDADE}</p>}
        <form action={iniciarTutorialAcao}><button type="submit" data-tour="conta-passeio" className="block w-full rounded-2xl border border-linha p-4 text-left font-bold">Passeio pelo app <span className="block text-sm font-normal text-suave">Conheça as telas principais em poucos passos</span></button></form>
      </section> : null}

      <PainelPerfil
        perfil={{
          nome: perfil?.nome ?? null,
          dataNascimento: perfil?.dataNascimento ?? null,
          sexo: perfil?.sexo ?? null,
          alturaCm: perfil?.alturaCm ?? null,
          nivelAtividade: perfil?.nivelAtividade ?? null,
          inicioPlano: perfil?.inicioPlano ?? null,
        }}
      />

      <PainelMetas meta={meta ? paraTela(meta) : null} historico={historico.map(paraTela)} />

      <section aria-labelledby="atalhos" className="app-card space-y-3">
        <h2 id="atalhos" className="section-heading">Gasto, meta, passos e lembretes</h2>
        {[
          ["/progresso/meta", "Meta e plano", "Gasto estimado, opções de calorias e projeção do peso"],
          ["/ajustes/atividade", "Nível de atividade", "Conte sua rotina e a IA sugere o nível"],
          ["/ajustes/passos", "Passos do iPhone", "Chave e automação do app Atalhos"],
          ["/ajustes/lembretes", "Lembretes", "Avisos no celular para refeição, água, pesagem e treino"],
          ["/comecar", "Seu começo", "Cadastro guiado com o Kalu: continuar ou rever suas escolhas"],
        ].filter(([href]) => modo === "proprio" || href === "/progresso/meta").map(([href, titulo, texto]) => (
          <Link key={href} href={href} className="block rounded-2xl border border-linha p-4 active:border-marca">
            <span className="block text-lg font-bold">{titulo}</span>
            <span className="block text-sm text-suave">{texto}</span>
          </Link>
        ))}
      </section>

      {modo === "proprio" ? <FormDados action={sair}>
        <button type="submit" className="min-h-12 w-full rounded-xl border border-borda font-semibold text-suave">
          Sair da conta
        </button>
      </FormDados> : null}
    </div>
  );
}
