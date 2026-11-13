export type TipoAutorizacao = "edicao" | "fotos";
export type EstadoAutorizacao = "pendente" | "aceita" | "recusada" | "revogada";
export type Concessao = { estado: EstadoAutorizacao; expiraEm: Date | null };
export type ContextoDados = {
  atorId: string;
  titularId: string;
  contextoId: string;
  modo: "proprio" | "acompanhamento";
  podeEditar: boolean;
  podeVerFotos: boolean;
  edicaoAte: Date | null;
};

export function concessaoAtiva(tipo: TipoAutorizacao, concessao: Concessao | null, agora: Date): boolean {
  if (concessao?.estado !== "aceita") return false;
  if (concessao.expiraEm) return concessao.expiraEm.getTime() > agora.getTime();
  return tipo === "fotos";
}

export function contextoConfere(renderizado: unknown, atual: string): boolean {
  return typeof renderizado === "string" && renderizado.length > 0 && renderizado === atual;
}
