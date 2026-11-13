import { FormDados } from "@/components/contexto-dados";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarPendentes } from "@/lib/dal/acessos";
import { historicoMetas, metaVigente } from "@/lib/dal/metas";
import { obterPerfil } from "@/lib/dal/perfil";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import type { Meta } from "@/lib/db/schema";
import Link from "next/link";
import { sair } from "../../acoes";
import { decidirCadastro } from "./actions";
import { PainelMetas, PainelPerfil, type MetaTela } from "./paineis";
import { SeletorAparencia } from "@/components/aparencia";

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
  const [perfil, meta, historico, pendentes] = await Promise.all([
    obterPerfil(userId),
    metaVigente(userId, hojeSaoPaulo()),
    historicoMetas(userId),
    admin ? listarPendentes(admin) : Promise.resolve([]),
  ]);

  return (
    <div className="page-stack max-w-4xl">
      <header><h1 className="page-heading">Conta</h1><p className="page-intro">Seu perfil, suas metas e o Kalyft do seu jeito.</p></header>
      <section className="app-card"><SeletorAparencia /></section>
      {modo === "proprio" ? <section className="space-y-3" aria-label="Acompanhamento">
        {admin ? <Link href="/ajustes/alunos" className="block rounded-2xl border border-marca p-4 font-bold">Alunos <span className="block text-sm font-normal text-suave">Acompanhar alimentação, treino e evolução</span></Link> : null}
        <Link href="/ajustes/acompanhamento" className="block rounded-2xl border border-linha p-4 font-bold">Acompanhamento <span className="block text-sm font-normal text-suave">Solicitações, autorizações e histórico de alterações</span></Link>
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
        <h2 id="atalhos" className="section-heading">Gasto, meta e passos</h2>
        {[
          ["/progresso/meta", "Meta e plano", "Gasto estimado, opções de calorias e projeção do peso"],
          ["/ajustes/atividade", "Nível de atividade", "Conte sua rotina e a IA sugere o nível"],
          ["/ajustes/passos", "Passos do iPhone", "Chave e automação do app Atalhos"],
        ].filter(([href]) => modo === "proprio" || href === "/progresso/meta").map(([href, titulo, texto]) => (
          <Link key={href} href={href} className="block rounded-2xl border border-linha p-4 active:border-marca">
            <span className="block text-lg font-bold">{titulo}</span>
            <span className="block text-sm text-suave">{texto}</span>
          </Link>
        ))}
      </section>

      {admin ? (
        <section aria-labelledby="cadastros">
          <h2 id="cadastros" className="mb-2 section-heading">Cadastros pendentes</h2>
          {pendentes.length === 0 ? (
            <p className="text-suave">Nenhum cadastro aguardando.</p>
          ) : (
            <ul>
              {pendentes.map((p) => (
                <li key={p.userId} className="border-b border-linha py-4">
                  <p className="font-semibold break-all">{p.email}</p>
                  <p className="text-sm text-suave">pedido em {formatarDataBr(p.criadoEm.toISOString().slice(0, 10))}</p>
                  <FormDados action={decidirCadastro} className="mt-3 flex gap-3">
                    <input type="hidden" name="alvo" value={p.userId} />
                    <button name="decisao" value="aprovar" className="min-h-12 flex-1 rounded-xl bg-destaque font-bold text-sobre-destaque">
                      Aprovar
                    </button>
                    <button name="decisao" value="recusar" className="min-h-12 flex-1 rounded-xl border border-borda font-semibold">
                      Recusar
                    </button>
                  </FormDados>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {modo === "proprio" ? <FormDados action={sair}>
        <button type="submit" className="min-h-12 w-full rounded-xl border border-borda font-semibold text-suave">
          Sair da conta
        </button>
      </FormDados> : null}
    </div>
  );
}
