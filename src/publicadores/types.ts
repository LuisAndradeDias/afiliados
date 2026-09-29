export interface Publicador {
  nome: string;
  publicar(mensagem: string): Promise<void>;
}
