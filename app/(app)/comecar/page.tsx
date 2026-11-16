import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Kalu } from "@/components/kalu";
import { exigirContaPropria } from "@/lib/auth/acompanhamento";
import { carregarRevisao, obterJornada } from "@/lib/dal/jornada";
import { formatarDataBr } from "@/lib/datas";
import { ETAPAS, ETAPAS_PULAVEIS, etapaAnterior, etapaDisponivel, etapasAplicaveis, type Etapa, type Rascunho } from "@/lib/jornada";
import { OPCOES, ROTULOS_CAMPO_PERFIL, rotuloDe, TEXTOS_ETAPA } from "@/lib/jornada-textos";
import { adiarJornadaAcao, iniciarJornadaAcao } from "./actions";
import { FormularioEtapa } from "./formulario-etapa";
import { Revisao, type SecaoResumo } from "./revisao";
import { Trilha } from "./trilha";
import { lerTutorial } from "@/lib/tutorial-inicial";
import { iniciarTutorialAcao, pularTutorialAcao } from "../tutorial-actions";

export const metadata = { title: "Seu começo · Kalyft" };

const NI = "Não informado";
const num = (v: number | undefined, sufixo: string) => (v === undefined ? NI : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${sufixo}`);
const lst = (campo: string, v: string[] | undefined) => (v?.length ? v.map((x) => rotuloDe(campo, x) ?? x).join(", ") : NI);
const opc = (campo: string, v: string | undefined) => rotuloDe(campo, v) ?? NI;

/** Resumo da revisão, por seção, só com o caminho escolhido. */
function resumo(r: Rascunho): SecaoResumo[] {
  const area = r.foco?.area;
  const secoes: SecaoResumo[] = [
    {
      id: "foco",
      titulo: "Sua direção",
      editar: "/comecar?etapa=foco",
      linhas: [["Área", opc("area", area)], ...(area === "ambos" ? ([["Começar por", opc("primeira", r.foco?.primeira)]] as Array<[string, string]>) : [])],
    },
    {
      id: "perfil",
      titulo: "Seu ponto de partida",
      editar: "/comecar?etapa=perfil",
      linhas: [
        ["Nome de preferência", r.perfil?.nome ?? NI],
        ["Nascimento", r.perfil?.nascimento ? formatarDataBr(r.perfil.nascimento) : NI],
        ["Sexo usado no cálculo", opc("sexo", r.perfil?.sexo)],
        ["Altura", num(r.perfil?.alturaCm, "cm")],
        ["Peso", num(r.perfil?.pesoKg, "kg")],
        ["Data da pesagem", r.perfil?.dataPesagem ? formatarDataBr(r.perfil.dataPesagem) : NI],
      ],
    },
    {
      id: "objetivo",
      titulo: "Seu objetivo",
      editar: "/comecar?etapa=objetivo",
      linhas: [["Foco", opc("objetivo", r.objetivo?.objetivo)], ...(r.objetivo?.pesoReferenciaKg !== undefined ? ([["Peso de referência", num(r.objetivo.pesoReferenciaKg, "kg")]] as Array<[string, string]>) : [])],
    },
    {
      id: "rotina",
      titulo: "Seu dia a dia",
      editar: "/comecar?etapa=rotina",
      linhas: [["Movimento cotidiano", opc("trabalho", r.rotina?.trabalho)], ["Deslocamento", opc("deslocamento", r.rotina?.deslocamento)]],
    },
    {
      id: "atividade",
      titulo: "Atividade atual",
      editar: "/comecar?etapa=atividade",
      linhas: [
        ["Exercício", opc("exercicio", r.atividade?.exercicio)],
        ...(r.atividade?.diasPorSemana !== undefined
          ? ([["Frequência", `${r.atividade.diasPorSemana} dias por semana${r.atividade.minutos ? ` · ${r.atividade.minutos} min` : ""}`], ["Atividades", lst("tipos", r.atividade.tipos)]] as Array<[string, string]>)
          : []),
        ["Nível declarado", opc("nivelDeclarado", r.atividade?.nivelDeclarado)],
      ],
    },
  ];
  if (area === "treino" || area === "ambos") {
    secoes.push({
      id: "treino",
      titulo: "Como vai treinar",
      editar: "/comecar?etapa=treino",
      linhas: [
        ["Ponto de partida", opc("metodo", r.treino?.metodo)],
        ["Experiência", opc("experiencia", r.treino?.experiencia)],
        ["Local", opc("local", r.treino?.local)],
        ["Equipamentos", lst("equipamentos", r.treino?.equipamentos)],
        ["Dias disponíveis", lst("diasSemana", r.treino?.diasSemana)],
        ["Tempo por sessão", num(r.treino?.minutosSessao, "min")],
        ["Limitações", opc("limitacao", r.treino?.limitacao)],
      ],
    });
  }
  if (area === "comida" || area === "ambos") {
    secoes.push({
      id: "alimentacao",
      titulo: "Sua alimentação",
      editar: "/comecar?etapa=alimentacao",
      linhas: [
        ["Ponto de partida", opc("metodo", r.alimentacao?.metodo)],
        ["Preferência", opc("preferencia", r.alimentacao?.preferencia)],
        ["Restrição", opc("restricao", r.alimentacao?.restricao)],
        ["Alergia", opc("alergia", r.alimentacao?.alergia)],
        ["Refeições por dia", r.alimentacao?.refeicoesPorDia !== undefined ? String(r.alimentacao.refeicoesPorDia) : NI],
        ["Tempo de preparo", num(r.alimentacao?.minutosPreparo, "min")],
        ["Planejamento", opc("planejamento", r.alimentacao?.planejamento)],
      ],
    });
  }
  return secoes;
}

function Cabecalho({ etapa }: { etapa: Etapa }) {
  const t = TEXTOS_ETAPA[etapa];
  return (
    <header className="space-y-5">
      <Kalu pose={t.pose} fala={t.fala} />
      <div className="space-y-2">
        <h1 className="page-heading">{t.titulo}</h1>
        <p className="page-intro">{t.intro}</p>
        {t.ajuda ? <p className="text-sm text-suave">{t.ajuda}</p> : null}
      </div>
    </header>
  );
}

export default async function PaginaComecar(props: PageProps<"/comecar">) {
  const { userId } = await exigirContaPropria();
  const sp = await props.searchParams;
  const jornada = await obterJornada(userId);

  // Ainda não começou (ou adiou): convite, sem obrigar.
  if (!jornada || jornada.estado === "adiada") {
    return (
      <div className="page-stack max-w-2xl">
        <header className="space-y-5">
          <Kalu pose="acolher" fala="Oi! Eu sou o Kalu. Vou te ajudar a montar um começo que caiba na sua rotina." />
          <h1 className="page-heading">Vamos montar seu começo?</h1>
          <p className="page-intro">São alguns passos curtos. Você pode pular o que quiser, parar e continuar depois de onde parou.</p>
          <p className="text-sm text-suave">Nada é aplicado ao seu perfil antes da revisão final. Metas e plano de treino continuam com confirmação própria.</p>
        </header>
        <div className="space-y-3">
          <form action={iniciarJornadaAcao}>
            <button type="submit" className="action-primary w-full">{jornada ? "Continuar de onde parei" : "Começar"}<ArrowRight size={18} aria-hidden="true" /></button>
          </form>
          {!jornada ? (
            <form action={adiarJornadaAcao}>
              <button type="submit" className="action-secondary w-full">Agora não</button>
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  // Concluída: primeiro marco e primeira missão (escolha da pessoa, nada é registrado automaticamente).
  if (jornada.estado === "concluida") {
    const area = jornada.rascunho.foco?.area;
    const primeira = area === "ambos" ? jornada.rascunho.foco?.primeira : area;
    const outra = area === "ambos" ? (primeira === "comida" ? "Treino" : "Alimentação") : null;
    const t = TEXTOS_ETAPA.inicio;
    return (
      <div className="page-stack max-w-2xl">
        <Trilha etapa="inicio" aplicaveis={etapasAplicaveis(jornada.rascunho)} />
        <header className="space-y-5">
          <Kalu pose={t.pose} fala={t.fala} />
          <h1 className="page-heading">{t.titulo}</h1>
          <p className="page-intro">{t.intro}</p>
        </header>
        <div className="app-card flex items-start gap-3">
          <CheckCircle2 size={24} className="shrink-0 text-ok" aria-hidden="true" />
          <div>
            <p className="font-semibold">Caminho revisado</p>
            <p className="text-sm text-suave">Seu primeiro marco. Você pode rever suas escolhas em Conta quando quiser.</p>
          </div>
        </div>
        <section className="app-card space-y-3" aria-labelledby="missao">
          <p className="eyebrow">Sua primeira missão</p>
          <h2 id="missao" className="section-heading">{primeira === "treino" ? "Preparar seu treino" : "Conhecer o registro de comida"}</h2>
          <p className="text-sm text-suave">
            {primeira === "treino" ? "Encontre ou monte seu plano antes de iniciar uma sessão real." : "Descubra onde registrar algo que você realmente comeu."}
          </p>
          <Link href={primeira === "treino" ? "/treino" : "/comida"} className="action-primary w-full">
            {primeira === "treino" ? "Ir para o treino" : "Ir para a comida"}<ArrowRight size={18} aria-hidden="true" />
          </Link>
          {outra ? <p className="text-sm text-suave"><strong>{outra}</strong> continua como próximo passo. Você não precisa fazer tudo agora.</p> : null}
        </section>
        {lerTutorial(jornada.tutorial).estado === "nao_iniciado" ? (
          <section aria-labelledby="passeio" className="app-card space-y-3">
            <h2 id="passeio" className="section-heading">Quer conhecer o app?</h2>
            <p className="text-sm text-suave">Um passeio rápido pelas telas principais. Você pode pular agora e refazer quando quiser em Conta.</p>
            <form action={iniciarTutorialAcao}>
              <button type="submit" className="action-primary w-full">Mostrar em poucos passos</button>
            </form>
            <form action={pularTutorialAcao}>
              <button type="submit" className="action-secondary w-full">Pular por agora</button>
            </form>
          </section>
        ) : null}
        <Link href="/hoje" className="action-secondary w-full">Ir para o Hoje</Link>
      </div>
    );
  }

  // Em andamento: a etapa pedida (se disponível e já alcançável) ou a última salva.
  const rascunho = jornada.rascunho;
  const aplicaveis = etapasAplicaveis(rascunho);
  const pedida = typeof sp.etapa === "string" && (ETAPAS as readonly string[]).includes(sp.etapa) ? (sp.etapa as Etapa) : null;
  const alcance = aplicaveis.indexOf(jornada.etapa === "inicio" ? "revisao" : jornada.etapa);
  let etapa: Etapa = jornada.etapa === "inicio" ? "revisao" : jornada.etapa;
  if (pedida && pedida !== "inicio" && etapaDisponivel(rascunho, pedida) && aplicaveis.indexOf(pedida) <= Math.max(alcance, 0)) etapa = pedida;
  if (!etapaDisponivel(rascunho, etapa)) etapa = "foco";
  const voltar = etapa === "foco" ? null : `/comecar?etapa=${etapaAnterior(rascunho, etapa)}`;

  if (etapa === "revisao") {
    const dados = await carregarRevisao(userId);
    if (!dados) return <p className="text-suave">Não foi possível carregar a revisão. Atualize a página.</p>;
    const rotulosValor: Record<string, string> = {};
    for (const [v, r] of OPCOES.nivelDeclarado) rotulosValor[`nivelAtividade:${v}`] = r;
    for (const [v, r] of OPCOES.sexo) rotulosValor[`sexo:${v}`] = r;
    return (
      <div className="page-stack max-w-2xl">
        <Trilha etapa="revisao" aplicaveis={aplicaveis} />
        <Cabecalho etapa="revisao" />
        <Revisao
          revisao={dados.jornada.revisao}
          secoes={resumo(dados.jornada.rascunho)}
          mudancas={dados.plano.perfil}
          rotulos={ROTULOS_CAMPO_PERFIL}
          rotulosValor={rotulosValor}
          pesagem={dados.plano.pesagem}
        />
        {voltar ? <Link href={voltar} className="action-link">Voltar</Link> : null}
      </div>
    );
  }

  const valores = { ...((rascunho as Record<string, unknown>)[etapa] as Record<string, unknown> | undefined) };
  return (
    <div className="page-stack max-w-2xl">
      <Trilha etapa={etapa} aplicaveis={aplicaveis} />
      <Cabecalho etapa={etapa} />
      <FormularioEtapa
        key={`${etapa}-${jornada.revisao}`}
        etapa={etapa}
        revisao={jornada.revisao}
        valores={valores}
        pulavel={(ETAPAS_PULAVEIS as readonly string[]).includes(etapa)}
        voltar={voltar}
      />
      <form action={adiarJornadaAcao}>
        <button type="submit" className="min-h-11 w-full text-sm font-semibold text-suave underline-offset-4 hover:underline">Continuar depois</button>
      </form>
    </div>
  );
}
