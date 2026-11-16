// Busca de funções do app ("O que você quer fazer?"). Função pura: a lista de destinos e os sinônimos ficam
// aqui; a tela só desenha o resultado. Funções pessoais (IA, passos, aplicação) não aparecem no acompanhamento,
// e Alunos só aparece para administrador.
import { normalizarBusca, palavrasDaBusca } from "@/lib/busca";

export type IconeFuncao =
  | "peso" | "semana" | "fotos" | "meta" | "historico" | "composicao" | "aplicacao" | "graficos"
  | "adicionar" | "agua" | "barras" | "ia" | "receitas" | "salvas" | "copiar" | "meus-alimentos"
  | "treino" | "plano" | "exercicios" | "calendario" | "falta" | "treino-ia"
  | "atividade" | "passos" | "lembretes" | "acompanhamento" | "alunos" | "conta";

export type Escopo = "todos" | "proprio" | "admin";

export type Funcao = {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  icone: IconeFuncao;
  area: "Progresso" | "Alimentação" | "Treino" | "Conta";
  termos: string[];
  escopo: Escopo;
};

export const FUNCOES: readonly Funcao[] = [
  { id: "registrar-peso", titulo: "Registrar peso", descricao: "Pesagem do dia, massa magra e cintura", href: "/progresso/pesagem", icone: "peso", area: "Progresso", termos: ["pesar", "balanca", "pesagem", "cintura", "massa magra", "kg"], escopo: "todos" },
  { id: "pesagens", titulo: "Histórico de pesagens", descricao: "Pesagens anteriores e exclusão", href: "/progresso/pesagem#historico", icone: "historico", area: "Progresso", termos: ["pesagens", "historico", "apagar peso", "peso antigo"], escopo: "todos" },
  { id: "semana", titulo: "Resumo da semana", descricao: "Calorias, treinos e peso da semana", href: "/progresso/semana", icone: "semana", area: "Progresso", termos: ["relatorio", "semanal", "resumo"], escopo: "todos" },
  { id: "fotos", titulo: "Fotos de progresso", descricao: "Frente, lado e costas ao longo do tempo", href: "/progresso/fotos", icone: "fotos", area: "Progresso", termos: ["foto", "corpo", "comparar", "antes e depois"], escopo: "todos" },
  { id: "meta", titulo: "Meta e plano", descricao: "Gasto estimado, quanto comer e projeção do peso", href: "/progresso/meta", icone: "meta", area: "Progresso", termos: ["meta", "calorias", "macros", "proteina", "projecao", "objetivo", "deficit"], escopo: "todos" },
  { id: "graficos", titulo: "Gráficos", descricao: "Consumo, déficit, proteína e treinos", href: "/progresso?aba=calorias#graficos", icone: "graficos", area: "Progresso", termos: ["grafico", "evolucao", "consumo", "gasto"], escopo: "todos" },
  { id: "composicao", titulo: "Composição corporal", descricao: "Peso, massa magra e massa gorda", href: "/progresso?aba=composicao#graficos", icone: "composicao", area: "Progresso", termos: ["gordura", "massa magra", "bioimpedancia"], escopo: "todos" },
  { id: "aplicacao", titulo: "Aplicação semanal", descricao: "Lembrete e registro de feito", href: "/progresso/aplicacao", icone: "aplicacao", area: "Progresso", termos: ["injecao", "ozempic", "remedio", "lembrete", "caneta"], escopo: "proprio" },

  { id: "adicionar-comida", titulo: "Adicionar alimento", descricao: "Buscar na tabela e registrar no diário", href: "/comida/adicionar", icone: "adicionar", area: "Alimentação", termos: ["comida", "registrar", "refeicao", "comer", "almoco", "jantar", "cafe", "lanche", "diario"], escopo: "todos" },
  { id: "agua", titulo: "Água", descricao: "Registrar copos de água do dia", href: "/comida#agua", icone: "agua", area: "Alimentação", termos: ["beber", "hidratacao", "copo", "ml"], escopo: "todos" },
  { id: "barras", titulo: "Código de barras", descricao: "Ler o código do produto com a câmera", href: "/comida/barras", icone: "barras", area: "Alimentação", termos: ["barras", "scanner", "camera", "produto", "embalagem", "rotulo"], escopo: "todos" },
  { id: "comida-ia", titulo: "Registrar com IA", descricao: "Escreva ou fotografe o prato", href: "/comida/ia", icone: "ia", area: "Alimentação", termos: ["inteligencia artificial", "foto do prato", "texto", "kalu"], escopo: "proprio" },
  { id: "sugestoes", titulo: "O que posso fazer?", descricao: "Sugestões de refeição com os ingredientes que você tem", href: "/comida/sugestoes", icone: "receitas", area: "Alimentação", termos: ["sugestao", "ideia", "cardapio", "o que comer", "ingredientes", "geladeira", "preparar", "cozinhar"], escopo: "proprio" },
  { id: "planejar", titulo: "Planejar a semana", descricao: "Escolher refeições da semana", href: "/comida/planejar", icone: "calendario", area: "Alimentação", termos: ["planejamento", "cardapio", "semana", "marmita", "organizar"], escopo: "todos" },
  { id: "compras", titulo: "Lista de compras", descricao: "Ingredientes do que você planejou", href: "/comida/planejar/compras", icone: "plano", area: "Alimentação", termos: ["mercado", "supermercado", "feira", "comprar"], escopo: "todos" },
  { id: "receitas", titulo: "Receitas", descricao: "Ingredientes, porções e peso final", href: "/comida/receitas", icone: "receitas", area: "Alimentação", termos: ["receita", "ingredientes", "preparo", "porcao"], escopo: "todos" },
  { id: "refeicoes-salvas", titulo: "Refeições salvas", descricao: "Refeições que você repete", href: "/comida/refeicoes", icone: "salvas", area: "Alimentação", termos: ["favorita", "repetir", "salva"], escopo: "todos" },
  { id: "copiar", titulo: "Copiar refeição", descricao: "Repetir uma refeição de outro dia", href: "/comida/copiar", icone: "copiar", area: "Alimentação", termos: ["copiar", "repetir", "ontem"], escopo: "todos" },
  { id: "meus-alimentos", titulo: "Meus alimentos", descricao: "Alimentos cadastrados por você", href: "/comida/meus-alimentos", icone: "meus-alimentos", area: "Alimentação", termos: ["cadastrar alimento", "rotulo", "tabela nutricional"], escopo: "todos" },

  { id: "treino", titulo: "Treino de hoje", descricao: "Começar ou continuar o treino", href: "/treino", icone: "treino", area: "Treino", termos: ["academia", "musculacao", "malhar", "series", "cronometro", "descanso"], escopo: "todos" },
  { id: "plano", titulo: "Plano de treino", descricao: "Treinos, exercícios e agenda da semana", href: "/treino/plano", icone: "plano", area: "Treino", termos: ["ficha", "divisao", "agenda", "rotina"], escopo: "todos" },
  { id: "exercicios", titulo: "Exercícios", descricao: "Seus exercícios e o catálogo", href: "/treino/exercicios", icone: "exercicios", area: "Treino", termos: ["exercicio", "carga", "repeticoes"], escopo: "todos" },
  { id: "calendario", titulo: "Calendário de treinos", descricao: "Dias feitos, faltas e descanso", href: "/treino/calendario", icone: "calendario", area: "Treino", termos: ["frequencia", "historico de treino", "dias"], escopo: "todos" },
  { id: "falta", titulo: "Registrar falta", descricao: "Marcar um treino que não aconteceu", href: "/treino/falta", icone: "falta", area: "Treino", termos: ["faltei", "perdi treino", "folga"], escopo: "todos" },
  { id: "treino-ia", titulo: "Criar ou importar plano", descricao: "Montar com IA ou ler um plano que você já tem", href: "/treino/ia", icone: "treino-ia", area: "Treino", termos: ["importar", "pdf", "personal", "inteligencia artificial", "gerar treino"], escopo: "proprio" },

  { id: "atividade", titulo: "Nível de atividade", descricao: "Quanto você se movimenta no dia a dia", href: "/ajustes/atividade", icone: "atividade", area: "Conta", termos: ["sedentario", "ativo", "perfil", "altura", "idade"], escopo: "todos" },
  { id: "passos", titulo: "Passos do iPhone", descricao: "Enviar os passos pelo app Atalhos", href: "/ajustes/passos", icone: "passos", area: "Conta", termos: ["passos", "atalhos", "saude", "caminhada"], escopo: "proprio" },
  { id: "lembretes", titulo: "Lembretes", descricao: "Avisos no celular nos horários que você escolher", href: "/ajustes/lembretes", icone: "lembretes", area: "Conta", termos: ["lembrete", "notificacao", "aviso", "alarme", "horario", "lembrar"], escopo: "proprio" },
  { id: "comecar", titulo: "Seu começo", descricao: "Cadastro guiado com o Kalu", href: "/comecar", icone: "conta", area: "Conta", termos: ["cadastro", "começar", "comecar", "kalu", "perfil", "objetivo", "tutorial"], escopo: "proprio" },
  { id: "acompanhamento", titulo: "Permissões de acompanhamento", descricao: "Quem pode ver ou editar seus dados", href: "/ajustes/acompanhamento", icone: "acompanhamento", area: "Conta", termos: ["permissao", "autorizar", "professor", "nutricionista", "revogar"], escopo: "proprio" },
  { id: "alunos", titulo: "Alunos", descricao: "Acompanhar contas aprovadas", href: "/ajustes/alunos", icone: "alunos", area: "Conta", termos: ["aluno", "acompanhar", "admin"], escopo: "admin" },
  { id: "conta", titulo: "Conta e aparência", descricao: "Perfil, tema claro ou escuro e sair", href: "/ajustes", icone: "conta", area: "Conta", termos: ["configuracoes", "ajustes", "tema", "modo escuro", "sair", "perfil"], escopo: "todos" },
];

export type ContextoBusca = { modo: "proprio" | "acompanhamento"; admin: boolean };

/** Funções que fazem sentido no contexto atual (conta própria/acompanhamento, administrador ou não). */
export function funcoesDisponiveis(ctx: ContextoBusca): Funcao[] {
  return FUNCOES.filter((f) => {
    if (f.escopo === "admin") return ctx.admin && ctx.modo === "proprio";
    if (f.escopo === "proprio") return ctx.modo === "proprio";
    return true;
  });
}

// Palavras que não ajudam a achar nada ("quero registrar o meu peso").
const VAZIAS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "um", "uma", "para", "pra", "com", "meu", "minha", "meus", "minhas", "quero", "como", "onde", "ver", "me", "eu", "fazer"]);

// A descrição não entra: palavras soltas nela ("projeção do peso") trariam resultados demais.
const textoDe = (f: Funcao) => normalizarBusca([f.titulo, ...f.termos].join(" "));

/**
 * Procura funções pelo que a pessoa digitou. Cada palavra precisa aparecer (como início de palavra) no título
 * ou nos sinônimos; o título pesa mais. Sem termo, devolve lista vazia.
 */
export function buscarFuncoes(termo: string, ctx: ContextoBusca, limite = 8): Funcao[] {
  const palavras = palavrasDaBusca(normalizarBusca(termo)).filter((p) => !VAZIAS.has(p));
  if (palavras.length === 0) return [];
  const pontuadas: Array<{ f: Funcao; pontos: number }> = [];
  for (const f of funcoesDisponiveis(ctx)) {
    const titulo = normalizarBusca(f.titulo);
    const palavrasTexto = textoDe(f).split(" ");
    const palavrasTitulo = titulo.split(" ");
    let pontos = 0;
    let todas = true;
    for (const p of palavras) {
      if (palavrasTitulo.some((w) => w.startsWith(p))) pontos += 3;
      else if (palavrasTexto.some((w) => w.startsWith(p))) pontos += 1;
      else {
        todas = false;
        break;
      }
    }
    if (!todas) continue;
    if (titulo.startsWith(palavras.join(" "))) pontos += 2;
    pontuadas.push({ f, pontos });
  }
  return pontuadas.sort((a, b) => b.pontos - a.pontos).slice(0, limite).map((x) => x.f);
}

/** Termo vindo da URL: texto curto e limpo, ou vazio. */
export function termoValido(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}
