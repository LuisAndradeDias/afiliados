import "dotenv/config";
import {
  MercadoLivreReautorizacaoNecessaria,
  obterTokenMercadoLivreValido
} from "../afiliados/mercadolivre-token.js";

try {
  await obterTokenMercadoLivreValido();
  console.log("MERCADOLIVRE_AUTH_OK: autorização disponível, sem expor tokens.");
} catch (error) {
  if (error instanceof MercadoLivreReautorizacaoNecessaria) {
    console.error("MERCADOLIVRE_RECONNECT_REQUIRED: " + error.message);
    process.exitCode = 3;
  } else {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.error("MERCADOLIVRE_AUTH_ERROR: " + mensagem);
    process.exitCode = 1;
  }
}
