import "dotenv/config";

const token = process.env.MERCADOLIVRE_ACCESS_TOKEN?.trim();
if (!token) throw new Error("Mercado Livre API nao conectada.");

const headers = {
  accept: "application/json",
  authorization: `Bearer ${token}`
};

const produtoId = process.argv[2] ?? "MLB46932978";
const resposta = await fetch(
  `https://api.mercadolibre.com/products/${encodeURIComponent(produtoId)}/items`,
  { headers }
);

console.log(`Produto ${produtoId}: HTTP ${resposta.status}`);
if (!resposta.ok) {
  console.log((await resposta.text()).slice(0, 250));
  process.exit(1);
}

const dados = (await resposta.json()) as {
  results?: Array<{
    seller_id: number;
    condition?: string;
    price: number;
    original_price?: number | null;
  }>;
};
const itens = dados.results ?? [];
const novos = itens.filter((item) => item.condition === "new");
console.log(`Publicacoes: total=${itens.length}, novas=${novos.length}`);

const vendedores = [...new Set(novos.map((item) => item.seller_id))].slice(0, 20);
if (vendedores.length === 0) process.exit(0);

const usuarios = await fetch(
  `https://api.mercadolibre.com/users/bulk?ids=${vendedores.join(",")}`,
  { headers }
);
console.log(`Reputacao em lote: HTTP ${usuarios.status}`);
if (!usuarios.ok) {
  console.log((await usuarios.text()).slice(0, 250));
  process.exit(1);
}

const lista = (await usuarios.json()) as Array<{
  body?: { seller_reputation?: { level_id?: string | null } };
}>;
const niveis = lista.map((x) => x.body?.seller_reputation?.level_id ?? null);
console.log(
  JSON.stringify({
    verdes: niveis.filter((x) => x === "4_light_green" || x === "5_green").length,
    semNivel: niveis.filter((x) => x === null).length,
    outros: niveis.filter((x) => x && x !== "4_light_green" && x !== "5_green").length
  })
);
