export type Aparencia = "sistema" | "claro" | "escuro";
export const CHAVE_APARENCIA = "kalyft-aparencia";

export function normalizarAparencia(valor: unknown): Aparencia {
  return valor === "claro" || valor === "escuro" ? valor : "sistema";
}

export function resolverTema(preferencia: Aparencia, sistemaEscuro: boolean): "claro" | "escuro" {
  return preferencia === "sistema" ? (sistemaEscuro ? "escuro" : "claro") : preferencia;
}

// Executado com o nonce da requisição antes do conteúdo, sem depender de rede.
export const SCRIPT_APARENCIA = `(function(){var p='sistema';try{var v=localStorage.getItem('${CHAVE_APARENCIA}');if(v==='claro'||v==='escuro')p=v}catch(e){}document.documentElement.dataset.aparencia=p})()`;
