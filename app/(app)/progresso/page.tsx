import Link from "next/link";
import { Scale } from "lucide-react";
import { GradeAtalhos, type Atalho } from "@/components/grade-atalhos";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { datasDeAplicacao, listarPesagens, obterDiaAplicacao } from "@/lib/dal/corpo";
import { metaVigente } from "@/lib/dal/metas";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { formatarGramas } from "@/lib/nutricao";
import { periodoValido } from "@/lib/painel-energia";
import { abaValida, resumirPeso } from "@/lib/progresso-resumo";
import { aplicacaoPendente, massaGorda, tendenciaDoPeso } from "@/lib/treino";
import { GraficosProgresso } from "./graficos-progresso";

export const metadata = { title: "Progresso · Kalyft" };

const kg = (v: number) => `${formatarGramas(v)} kg`;
const comSinal = (v: number) => (v > 0 ? `+${formatarGramas(v)}` : formatarGramas(v));

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-suave">{rotulo}</dt>
      <dd className="text-xl font-semibold tabular-nums sm:text-2xl">{valor}</dd>
      {detalhe ? <dd className="text-xs text-suave">{detalhe}</dd> : null}
    </div>
  );
}

export default async function PaginaProgresso(props: PageProps<"/progresso">) {
  const { userId, modo } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const sp = await props.searchParams;
  const periodo = periodoValido(sp.periodo);
  const aba = abaValida(sp.aba);
  const [lista, meta, diaAplic, aplicacoes] = await Promise.all([
    listarPesagens(userId, somarDias(hoje, -120), 400),
    metaVigente(userId, hoje),
    modo === "proprio" ? obterDiaAplicacao(userId) : Promise.resolve(null),
    modo === "proprio" ? datasDeAplicacao(userId, somarDias(hoje, -30)) : Promise.resolve([]),
  ]);

  const tendencia = tendenciaDoPeso([...lista].reverse().map((p) => ({ data: p.data, peso: p.pesoKg })));
  const ultima = lista[0];
  const tendenciaAtual = tendencia.at(-1)?.tendencia ?? null;
  const gorda = ultima ? massaGorda(ultima.pesoKg, ultima.massaMagraKg) : null;
  const resumo = resumirPeso(tendencia, hoje, meta?.pesoMetaKg ?? null);
  const pendente = aplicacaoPendente(hoje, diaAplic, aplicacoes);

  const atalhos: Atalho[] = [
    { href: "/progresso/pesagem", titulo: "Registrar peso", icone: "peso" },
    { href: "/progresso/semana", titulo: "Resumo da semana", icone: "semana" },
    { href: "/progresso/fotos", titulo: "Fotos", icone: "fotos" },
    { href: "/progresso/meta", titulo: "Meta e plano", icone: "meta" },
    { href: "/progresso/pesagem#historico", titulo: "Pesagens", icone: "historico" },
    { href: "/progresso?aba=composicao#graficos", titulo: "Composição", icone: "composicao" },
    ...(modo === "proprio" && diaAplic !== null ? [{ href: "/progresso/aplicacao", titulo: "Aplicação", icone: "aplicacao" } as const] : []),
    { href: "/buscar", titulo: "Mais funções", icone: "graficos" },
  ];

  return (
    <div className="page-stack">
      <header className="space-y-2"><h1 className="page-heading">Progresso</h1><p className="page-intro">Acompanhe o percurso, além do número.</p></header>

      <section aria-labelledby="resumo-peso" className="app-card space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="resumo-peso" className="section-heading">Seu peso</h2>
            <p className="text-sm text-suave">
              {ultima
                ? resumo.diasSemPesar === 0 ? "Pesagem de hoje registrada." : `Última pesagem em ${formatarDataBr(ultima.data)}.`
                : "Seu primeiro registro é o começo do acompanhamento."}
            </p>
          </div>
          <Link href="/progresso/pesagem" data-tour="progresso-peso" className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-destaque px-4 text-sm font-bold text-sobre-destaque">
            <Scale size={18} aria-hidden="true" />{ultima && resumo.diasSemPesar === 0 ? "Editar" : "Registrar"}
          </Link>
        </div>
        {ultima ? (
          <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-fundo p-4 sm:grid-cols-4">
            <Numero rotulo="Último" valor={kg(ultima.pesoKg)} />
            <Numero rotulo="Tendência" valor={tendenciaAtual === null ? "—" : kg(tendenciaAtual)} detalhe="estimativa" />
            <Numero rotulo="Em 30 dias" valor={resumo.variacao30d === null ? "—" : `${comSinal(resumo.variacao30d)} kg`} detalhe={resumo.variacao30d === null ? "pese por mais tempo" : "pela tendência"} />
            {resumo.faltaParaMeta !== null ? (
              <Numero rotulo="Até a meta" valor={resumo.faltaParaMeta <= 0 ? "Atingida" : kg(resumo.faltaParaMeta)} detalhe={`meta ${kg(meta!.pesoMetaKg!)}`} />
            ) : (
              <Numero rotulo="Massa gorda" valor={gorda === null ? "—" : kg(gorda)} />
            )}
          </dl>
        ) : null}
      </section>

      {pendente ? (
        <Link href="/progresso/aplicacao" className="app-card flex min-h-14 items-center justify-between border-marca font-semibold">
          Hoje é o dia da aplicação <span className="text-marca">Marcar ›</span>
        </Link>
      ) : null}

      <section aria-label="Atalhos do progresso" className="app-card">
        <GradeAtalhos rotulo="Atalhos do progresso" atalhos={atalhos} />
      </section>

      <GraficosProgresso userId={userId} hoje={hoje} periodo={periodo} aba={aba} />

      {modo === "proprio" && diaAplic === null ? (
        <p className="text-center text-sm text-suave">
          Usa medicação semanal? <Link href="/progresso/aplicacao" className="inline-flex min-h-11 items-center font-semibold underline">Ative o lembrete</Link>
        </p>
      ) : null}
    </div>
  );
}
