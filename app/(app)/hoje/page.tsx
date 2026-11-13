import Link from "next/link";
import { Apple, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Coffee, Dumbbell, Footprints, Moon, Plus, Scale, ShieldCheck, Sun, TrendingUp } from "lucide-react";
import { ResumoCalorias } from "@/components/resumo-calorias";
import { PainelAgua } from "../comida/painel-agua";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { totalAguaDoDia } from "@/lib/dal/agua";
import { carregarEnergia } from "@/lib/dal/energia";
import { passosDoPeriodo } from "@/lib/dal/passos";
import { listarDia } from "@/lib/dal/registros";
import { obterPerfil } from "@/lib/dal/perfil";
import { listarTreinos, obterAgenda, obterSessao, obterTrocas, planoAtivo } from "@/lib/dal/treino";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import { somarDia } from "@/lib/nutricao";
import { treinoDoDia } from "@/lib/treino";
import { listarAutorizacoes } from "@/lib/dal/acompanhamento";
import { REFEICOES, ROTULOS_REFEICAO } from "@/lib/validacao/comida";

export const metadata = { title: "Hoje · Kalyft" };
const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const ICONES_REFEICAO = { cafe: Coffee, almoco: Sun, lanche: Apple, jantar: Moon, ceia: Moon };

export default async function PaginaHoje(props: PageProps<"/hoje">) {
  const aviso = (await props.searchParams).acompanhamento;
  const mensagens: Record<string, string> = { contexto: "A conta acompanhada mudou. Atualize a página antes de continuar.", leitura: "Você está apenas acompanhando. Solicite autorização para alterar.", pessoal: "Volte para sua conta para usar este recurso." };
  const contexto = await exigirUsuario();
  const { userId, modo } = contexto;
  const hoje = hojeSaoPaulo();
  const [energia, registros, aguaMl, passos, plano, sessao, perfil, pedidos] = await Promise.all([
    carregarEnergia(userId, hoje, 60), listarDia(userId, hoje), totalAguaDoDia(userId, hoje), passosDoPeriodo(userId, hoje, hoje), planoAtivo(userId), obterSessao(userId, hoje), obterPerfil(userId), modo === "proprio" ? listarAutorizacoes(userId) : Promise.resolve([]),
  ]);
  const pendentes = pedidos.filter((p) => p.estado === "pendente").length;
  const meta = energia.meta;
  const painel = energia.painel;
  const totais = somarDia(registros);
  let treinoNome: string | null = null;
  if (plano) {
    const [agenda, trocas, treinos] = await Promise.all([obterAgenda(userId), obterTrocas(userId, hoje, hoje), listarTreinos(userId, plano.id)]);
    const id = treinoDoDia(hoje, agenda, trocas);
    treinoNome = id ? (treinos.find((t) => t.id === id)?.nome ?? null) : null;
  }
  const pesoHoje = energia.pesagens.find((p) => p.data === hoje)?.peso ?? null;
  const ultimoPeso = energia.pesagens.at(-1) ?? null;
  const primeiroNome = perfil?.nome?.trim().split(/\s+/)[0];
  const dataExtenso = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${hoje}T12:00:00Z`));
  return <div className="page-stack">
    <header className="mb-7"><p className="eyebrow mb-2">{dataExtenso}</p><h1 className="page-heading">{modo === "acompanhamento" ? `O dia de ${primeiroNome || "quem você acompanha"}` : primeiroNome ? `Olá, ${primeiroNome}.` : "Seu dia, em equilíbrio."}</h1><p className="page-intro">Alimentação e treino, um passo de cada vez.</p></header>
    {typeof aviso === "string" && mensagens[aviso] ? <p role="alert" className="app-card border-aviso text-sm text-aviso">{mensagens[aviso]}</p> : null}
    {pendentes > 0 ? <Link href="/ajustes/acompanhamento" className="app-card flex items-center gap-3 border-marca text-sm font-semibold"><ShieldCheck size={23} className="shrink-0 text-marca" aria-hidden="true" /><span>Você tem {pendentes} {pendentes === 1 ? "solicitação" : "solicitações"} de acompanhamento. Ver permissões</span><ChevronRight size={20} className="ml-auto shrink-0" aria-hidden="true" /></Link> : null}
    <div className="dashboard-grid">
      <div className="dashboard-stack">
        <ResumoCalorias totais={totais} meta={meta} temRegistros={registros.length > 0} />
        <section className="app-card" aria-labelledby="refeicoes"><div className="flex items-center justify-between gap-3"><h2 id="refeicoes" className="section-heading">Refeições do dia</h2><Link href="/comida" className="action-link">Ver diário</Link></div><ul className="mt-2 divide-y divide-linha">{REFEICOES.map((ref) => {
          const itens = registros.filter((r) => r.refeicao === ref);
          const kcal = itens.reduce((total, item) => total + item.kcal, 0);
          const Icone = ICONES_REFEICAO[ref];
          return <li key={ref}><Link href={itens.length ? `/comida?data=${hoje}#ref-${ref}` : `/comida/adicionar?data=${hoje}&refeicao=${ref}`} className="flex min-h-20 items-center gap-3 py-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fundo text-suave"><Icone size={20} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{ROTULOS_REFEICAO[ref]}</span><span className="mt-0.5 block truncate text-xs text-suave">{itens.length ? itens.map((item) => item.nome).join(", ") : "Quando fizer, registre aqui"}</span></span>{itens.length ? <span className="shrink-0 text-sm text-suave">{n(kcal)} kcal</span> : <Plus size={19} className="shrink-0 text-marca" aria-hidden="true" />}</Link></li>;
        })}</ul></section>
      </div>
      <div className="dashboard-stack">
        <PainelAgua data={hoje} totalMl={aguaMl} metaMl={meta?.aguaMl ?? null} editavel={contexto.podeEditar} compacto />
        <section className="app-card" aria-labelledby="treino"><div className="flex items-center justify-between gap-3"><h2 id="treino" className="section-heading">Treino de hoje</h2><span className="icon-badge"><Dumbbell size={21} aria-hidden="true" /></span></div><div className="my-5">
          {sessao?.status === "feito" ? <p className="flex items-center gap-2 font-semibold text-ok"><CheckCircle2 size={20} aria-hidden="true" />Treino concluído</p> : sessao?.status === "faltou" ? <p className="font-semibold text-suave">Pausa registrada hoje.</p> : <><p className="text-2xl font-semibold tracking-tight">{treinoNome || (plano ? "Dia de descanso" : "Vamos começar?")}</p><p className="mt-2 text-sm text-suave">{treinoNome ? "Seu plano, no seu ritmo." : plano ? "Recuperar também faz parte do seu percurso." : "Monte seu plano ou importe um treino que você já tem."}</p></>}
        </div><Link href={treinoNome && !sessao ? `/treino/sessao?data=${hoje}` : "/treino"} className="action-primary w-full">{treinoNome && !sessao ? "Começar treino" : plano ? "Ver meu treino" : "Criar meu plano"}<ArrowRight size={18} aria-hidden="true" /></Link></section>
        <section className="app-card" aria-labelledby="corpo"><div className="flex items-center justify-between"><h2 id="corpo" className="section-heading">Sua evolução</h2><TrendingUp size={22} className="text-ok" aria-hidden="true" /></div><dl className="mt-5 grid grid-cols-2 gap-5"><div><dt className="text-xs text-suave">{pesoHoje !== null ? "Peso de hoje" : "Último peso"}</dt><dd className="mt-1 text-2xl font-semibold tracking-tight">{pesoHoje !== null ? `${dec(pesoHoje)} kg` : ultimoPeso ? `${dec(ultimoPeso.peso)} kg` : "—"}</dd></div><div><dt className="text-xs text-suave">Tendência</dt><dd className="mt-1 text-2xl font-semibold tracking-tight">{painel.tendenciaKg !== null ? `${dec(painel.tendenciaKg)} kg` : "—"}</dd></div></dl><p className="mt-3 text-xs text-suave">{ultimoPeso ? `Última pesagem: ${formatarDataBr(ultimoPeso.data)}. A tendência é uma estimativa.` : "Registre seu peso para acompanhar sua evolução."}</p><div className="mt-4 rounded-xl bg-fundo p-3 text-sm text-suave">Acompanhe o percurso, além do número.</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Link href="/progresso" className="action-link"><Scale size={17} aria-hidden="true" />{pesoHoje === null ? "Registrar peso" : "Ver progresso"}</Link><Link href="/progresso/semana" className="action-link"><CalendarDays size={17} aria-hidden="true" />Resumo semanal</Link></div></section>
        <details className="app-card"><summary className="section-heading flex min-h-11 items-center gap-2"><Footprints size={21} className="text-marca" aria-hidden="true" />Mais sobre seu dia</summary><dl className="mt-4 grid grid-cols-2 gap-4"><div><dt className="text-xs text-suave">Passos</dt><dd className="text-xl font-semibold">{passos[0] ? n(passos[0].passos) : "—"}</dd>{!passos[0] && modo === "proprio" ? <Link href="/ajustes/passos" className="action-link">Configurar</Link> : null}</div><div><dt className="text-xs text-suave">Gasto estimado</dt><dd className="text-xl font-semibold">{painel.gasto ? `${n(painel.gasto.valor)} kcal` : "—"}</dd>{painel.gasto ? <p className="mt-1 text-xs text-suave">Entre {n(painel.gasto.minimo)} e {n(painel.gasto.maximo)} kcal</p> : null}</div></dl>{painel.previsaoDaMeta ? <p className="mt-4 text-sm text-suave">{painel.previsaoDaMeta.texto} (estimativa)</p> : null}{painel.faltam.length > 0 ? <p className="mt-3 text-sm text-suave">Complete seu perfil para estimar o gasto.</p> : null}<Link href="/progresso/meta" className="action-link mt-2">Meta e plano<ArrowRight size={17} aria-hidden="true" /></Link></details>
      </div>
    </div>
  </div>;
}
