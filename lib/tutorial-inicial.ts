// Passeio pelo app (tutorial inicial, entrega 2C). Regras puras: roteiro conforme a área escolhida, navegação e
// validação do estado guardado em jornadas_iniciais.tutorial. Concluir o passeio não prova aprendizado nem cria
// registros: é só orientação, sempre pulável e reabrível em Conta.
import { z } from "zod";

export type PassoTutorial = { id: string; rota: string; alvo: string; titulo: string; texto: string; area?: "comida" | "treino" };

export const PASSOS_TUTORIAL = [
  {
    id: "hoje",
    rota: "/hoje",
    alvo: "hoje-refeicoes",
    titulo: "Hoje",
    texto: "Aqui fica o resumo do seu dia: calorias, refeições, água e treino. Toque numa refeição para registrar o que você realmente comeu.",
  },
  {
    id: "comida",
    rota: "/comida",
    alvo: "comida-adicionar",
    area: "comida",
    titulo: "Comida",
    texto: "Em cada refeição, “Adicionar” abre a busca de alimentos, o código de barras e a descrição para a IA. A IA prepara um resultado e você confere as quantidades antes de salvar.",
  },
  {
    id: "treino",
    rota: "/treino",
    alvo: "treino",
    area: "treino",
    titulo: "Treino",
    texto: "Aqui você vê o treino do dia, inicia a sessão e registra as séries. Se ainda não tem plano, é por aqui que você cria ou importa.",
  },
  {
    id: "progresso",
    rota: "/progresso",
    alvo: "progresso-peso",
    titulo: "Progresso",
    texto: "Registre o peso e acompanhe a tendência e os gráficos. Tendências e projeções são estimativas, não garantias.",
  },
  {
    id: "conta",
    rota: "/ajustes",
    alvo: "conta-passeio",
    titulo: "Conta",
    texto: "Aqui você edita seus dados e metas, ajusta lembretes e pode refazer este passeio quando quiser.",
  },
] as const satisfies readonly PassoTutorial[];

export type IdPasso = (typeof PASSOS_TUTORIAL)[number]["id"];
export const IDS_PASSO = PASSOS_TUTORIAL.map((p) => p.id) as [IdPasso, ...IdPasso[]];

/** Roteiro conforme a área escolhida na jornada; sem área (quem não fez a jornada), mostra comida e treino. */
export function passosPara(area: "comida" | "treino" | "ambos" | undefined): PassoTutorial[] {
  return PASSOS_TUTORIAL.filter((p) => !("area" in p) || area === undefined || area === "ambos" || p.area === area);
}

export function vizinhos(passos: readonly PassoTutorial[], id: string): { indice: number; anterior: PassoTutorial | null; proximo: PassoTutorial | null } {
  const indice = Math.max(0, passos.findIndex((p) => p.id === id));
  return { indice, anterior: passos[indice - 1] ?? null, proximo: passos[indice + 1] ?? null };
}

/** Estado guardado (mesmos valores do CHECK do banco). Passo só faz sentido "em andamento". */
export const tutorialSchema = z
  .strictObject({
    estado: z.enum(["nao_iniciado", "em_andamento", "pulado", "concluido"]),
    passo: z.enum(IDS_PASSO).optional(),
  })
  .refine((t) => (t.estado === "em_andamento") === (t.passo !== undefined), "passo só no passeio em andamento");
export type EstadoTutorial = z.infer<typeof tutorialSchema>;

/** Estado guardado → estado válido (qualquer coisa inesperada vira "não iniciado", sem quebrar a tela). */
export function lerTutorial(bruto: unknown): EstadoTutorial {
  const r = tutorialSchema.safeParse(bruto);
  return r.success ? r.data : { estado: "nao_iniciado" };
}
