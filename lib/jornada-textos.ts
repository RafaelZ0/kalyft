// Textos da jornada inicial (vindos do protótipo v2 aprovado) e rótulos das opções. Sem lógica de negócio.
import type { Etapa } from "@/lib/jornada";

export type Pose = "acolher" | "ouvir" | "pensar" | "esclarecer" | "orientar" | "explicar" | "confirmar" | "celebrar";

/** Dimensões das imagens de 320 px (evitam salto de layout). */
export const DIMENSOES_POSE: Record<Pose, [number, number]> = {
  acolher: [320, 357],
  ouvir: [320, 414],
  pensar: [320, 357],
  esclarecer: [320, 357],
  orientar: [320, 414],
  explicar: [320, 357],
  confirmar: [320, 357],
  celebrar: [320, 292],
};

export const CAPITULOS = [
  { id: "direcao", rotulo: "Direção", etapas: ["foco"] },
  { id: "perfil", rotulo: "Perfil", etapas: ["perfil", "objetivo"] },
  { id: "rotina", rotulo: "Rotina", etapas: ["rotina", "atividade"] },
  { id: "plano", rotulo: "Plano", etapas: ["treino", "alimentacao"] },
  { id: "comeco", rotulo: "Começo", etapas: ["revisao", "inicio"] },
] as const satisfies ReadonlyArray<{ id: string; rotulo: string; etapas: readonly Etapa[] }>;

export const TEXTOS_ETAPA: Record<Etapa, { titulo: string; intro: string; pose: Pose; fala: string; ajuda?: string }> = {
  foco: {
    titulo: "Seu começo tem que fazer sentido.",
    intro: "Escolha o que você quer organizar. O resto vem um passo de cada vez.",
    pose: "acolher",
    fala: "Vamos criar um caminho para a sua rotina, não uma rotina impossível.",
    ajuda: "Se escolher os dois, vamos começar a configuração por uma área e deixar a outra como próximo passo.",
  },
  perfil: {
    titulo: "Vamos conhecer seu ponto de partida.",
    intro: "Esses dados ajudam a preparar as configurações. Nada é aplicado à sua conta antes da revisão.",
    pose: "ouvir",
    fala: "Você pode deixar para depois. Dados em branco continuam em branco, sem valores inventados.",
    ajuda: "Se deixar dados necessários em branco, as estimativas correspondentes ficam pendentes. Você ainda pode usar o app.",
  },
  objetivo: {
    titulo: "O que você quer construir daqui pra frente?",
    intro: "Escolha o foco principal. Você poderá ajustar isso depois.",
    pose: "pensar",
    fala: "Seu objetivo orienta o caminho. Não precisamos colocar um prazo para ele agora.",
    ajuda: "O peso de referência é opcional e não vira meta sozinho: metas têm confirmação própria.",
  },
  rotina: {
    titulo: "Como é um dia comum para você?",
    intro: "Trabalho, tarefas e deslocamento também fazem parte do seu movimento.",
    pose: "ouvir",
    fala: "Trabalhar sentado e fazer exercício são coisas diferentes. Vamos olhar para as duas.",
  },
  atividade: {
    titulo: "E o movimento fora das obrigações?",
    intro: "Conte como está sua atividade hoje, sem confundir com o que pretende fazer.",
    pose: "esclarecer",
    fala: "Pode estar começando, voltando ou já praticando. Cada ponto de partida é válido.",
    ajuda: "O nível de atividade continua revisável depois, em Conta.",
  },
  treino: {
    titulo: "Um treino que caiba na sua vida.",
    intro: "Vamos conhecer sua experiência e disponibilidade antes de preparar um plano.",
    pose: "orientar",
    fala: "Dias disponíveis são uma intenção. Eles não contam como treinos já realizados.",
    ajuda: "Conte apenas limitações que queira considerar. O app não avalia lesões nem gera orientação clínica.",
  },
  alimentacao: {
    titulo: "Comer bem precisa caber na rotina.",
    intro: "Aproveite o que já funciona e conte o que devemos considerar.",
    pose: "explicar",
    fala: "Se você já tem um plano, vamos respeitar esse ponto de partida. As sugestões sempre terão revisão.",
    ajuda: "Preferência alimentar e alergia são informações diferentes. Uma sugestão de IA não garante ausência de alergênicos.",
  },
  revisao: {
    titulo: "Seu caminho, do seu jeito.",
    intro: "Confira o que vai para a sua conta. Você escolhe o que atualizar.",
    pose: "confirmar",
    fala: "Revise com calma. Confirmar aqui não cria metas nem monta um treino sozinho.",
  },
  inicio: {
    titulo: "Pronto para começar?",
    intro: "Seu caminho está organizado. Agora é um passo de cada vez.",
    pose: "celebrar",
    fala: "Um começo organizado já faz diferença.",
  },
};

type Opcoes = ReadonlyArray<readonly [string, string, string?]>;

export const OPCOES: Record<string, Opcoes> = {
  area: [["comida", "Alimentação", "Organizar refeições e registros."], ["treino", "Treino", "Preparar seu plano e acompanhar sessões."], ["ambos", "Os dois", "Cuidar da rotina, uma área de cada vez."]],
  primeira: [["comida", "Alimentação"], ["treino", "Treino"]],
  sexo: [["feminino", "Feminino"], ["masculino", "Masculino"], ["depois", "Prefiro informar depois"]],
  objetivo: [["organizar", "Organizar minha rotina"], ["reduzir", "Reduzir meu peso"], ["manter", "Manter meu peso"], ["massa", "Ganhar massa muscular"], ["forca", "Desenvolver força e condicionamento"]],
  trabalho: [["sentado", "Fico sentado"], ["alternado", "Alterno entre sentado e em pé"], ["movimento", "Caminho ou fico em pé por bastante tempo"], ["fisico", "Faço trabalho físico frequente"]],
  deslocamento: [["transporte", "Principalmente transporte"], ["caminhada", "Caminho parte do trajeto"], ["bicicleta", "Bicicleta"], ["casa", "Trabalho ou estudo em casa"], ["misto", "Varia conforme o dia"]],
  exercicio: [["nenhum", "Ainda não pratico"], ["voltando", "Estou voltando a praticar"], ["regular", "Já pratico com frequência"]],
  tipos: [["musculacao", "Musculação"], ["caminhada", "Caminhada"], ["corrida", "Corrida"], ["bike", "Bicicleta"], ["esporte", "Esporte"], ["outro", "Outra atividade"]],
  nivelDeclarado: [["sedentario", "Sedentário"], ["leve", "Leve"], ["moderado", "Moderado"], ["alto", "Alto"], ["muito_alto", "Muito alto"]],
  metodo: [["ajuda", "Quero ajuda para começar", "Preparar uma sugestão para eu revisar."], ["existente", "Já tenho um plano", "Trazer a orientação que já sigo."], ["manual", "Configurar por conta própria", "Preencher sem depender da IA."]],
  experiencia: [["iniciante", "Estou começando"], ["retorno", "Estou voltando depois de uma pausa"], ["regular", "Já treino regularmente"]],
  local: [["academia", "Academia"], ["casa", "Em casa"], ["ar_livre", "Ao ar livre"], ["misto", "Em mais de um lugar"]],
  equipamentos: [["completa", "Academia completa"], ["halteres", "Halteres"], ["elasticos", "Elásticos"], ["corpo", "Peso do corpo"]],
  diasSemana: [["seg", "Seg"], ["ter", "Ter"], ["qua", "Qua"], ["qui", "Qui"], ["sex", "Sex"], ["sab", "Sáb"], ["dom", "Dom"]],
  limitacao: [["nao", "Nenhuma que eu queira informar"], ["profissional", "Quero revisar isso com um profissional"], ["adaptacao", "Preciso conversar sobre adaptações"]],
  preferencia: [["variada", "Alimentação variada"], ["vegetariana", "Vegetariana"], ["vegana", "Vegana"], ["outra", "Outra / definir depois"]],
  restricao: [["nao", "Nenhuma que eu queira informar"], ["lactose", "Lactose"], ["gluten", "Glúten"], ["outra", "Outra / revisar depois"]],
  alergia: [["nao", "Nenhuma que eu queira informar"], ["sim", "Sim, preciso revisar isso antes das sugestões"], ["depois", "Prefiro tratar disso depois"]],
  planejamento: [["sim", "Sim, com lista de compras"], ["depois", "Quero conhecer depois"], ["nao", "Prefiro registrar dia a dia"]],
};

export function rotuloDe(campo: string, valor: string | undefined): string | null {
  if (!valor) return null;
  return OPCOES[campo]?.find(([v]) => v === valor)?.[1] ?? null;
}

export const ROTULOS_CAMPO_PERFIL: Record<string, string> = {
  nome: "Nome de preferência",
  dataNascimento: "Data de nascimento",
  sexo: "Sexo usado no cálculo",
  alturaCm: "Altura",
  nivelAtividade: "Nível de atividade",
};
