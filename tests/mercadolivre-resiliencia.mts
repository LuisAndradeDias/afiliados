import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";
import { avaliarQualidadeOferta } from "../src/ofertas/qualidade.js";

const protectedEnv = [
  "MERCADOLIVRE_CATALOG_404_CACHE_PATH", "MIN_DISCOUNT_PERCENT",
  "MERCADOLIVRE_SEARCH_PAGES_PER_QUERY", "MERCADOLIVRE_MAX_OFFERS_PER_QUERY",
  "MERCADOLIVRE_REQUEST_INTERVAL_MS", "MERCADOLIVRE_SELLER_CHECKS_PER_PRODUCT"
];
function reply(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", ...extra }
  });
}
async function mocked(
  fetchMock: typeof fetch,
  run: (cache: string) => Promise<void>
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "cpv-ml47-"));
  const cache = join(root, "404-catalogo.json");
  const oldFetch = globalThis.fetch;
  const oldEnv = Object.fromEntries(protectedEnv.map(n => [n, process.env[n]]));
  try {
    process.env.MERCADOLIVRE_CATALOG_404_CACHE_PATH = cache;
    process.env.MIN_DISCOUNT_PERCENT = "25";
    process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY = "1";
    process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY = "2";
    process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS = "250";
    process.env.MERCADOLIVRE_SELLER_CHECKS_PER_PRODUCT = "5";
    globalThis.fetch = fetchMock;
    await run(cache);
  } finally {
    globalThis.fetch = oldFetch;
    for (const name of protectedEnv) {
      if (oldEnv[name] === undefined) delete process.env[name];
      else process.env[name] = oldEnv[name];
    }
    await rm(root, { recursive: true, force: true });
  }
}
function products(ids: string[]) {
  return reply({ paging: { total: ids.length }, results: ids.map(id => ({
    id, name: "Air fryer teste", status: "active"
  })) });
}
function greenSeller(id: number, green = true) {
  return reply([{ status_code: 200, body: { id, seller_reputation: {
    level_id: green ? "5_green" : "2_yellow"
  } } }]);
}

test("404 is cached across search processes and expires after 30 minutes", async () => {
  let negatives = 0;
  const mock = (async (url: URL | string) => {
    const str = String(url);
    if (str.includes("/products/search")) return products(["MLBTEST404", "MLBTESTOK"]);
    if (str.includes("/products/MLBTEST404/items")) { negatives++; return reply({}, 404); }
    if (str.includes("/products/MLBTESTOK/items")) return reply({ results: [{
      item_id: "MLBTESTITEM", seller_id: 10, price: 700,
      original_price: 1000, condition: "new", available_quantity: 7
    }] });
    if (str.endsWith("/products/MLBTESTOK")) return reply({
      id: "MLBTESTOK", status: "active",
      buy_box_winner: { item_id: "MLBTESTITEM", seller_id: 10,
        price: 700, available_quantity: 7 }
    });
    if (str.includes("/users/bulk")) return greenSeller(10);
    throw new Error("Unexpected mocked URL path");
  }) as typeof fetch;
  await mocked(mock, async cache => {
    const first = await new MercadoLivreApiFonte("air fryer", 10, "mock-token").buscar();
    assert.equal(first.length, 1);
    assert.equal(first[0]?.descontoPercentual, 30);
    assert.equal(avaliarQualidadeOferta(first[0]).elegivel, true);
    const second = await new MercadoLivreApiFonte("air fryer", 10, "mock-token").buscar();
    assert.equal(second.length, 1, "404 cache must not hide valid offers");
    assert.equal(negatives, 1, "repeat run should skip explicit HTTP 404 catalog");
    const contents = JSON.parse(await readFile(cache, "utf8")) as { entries: Record<string, number> };
    assert.equal(Object.keys(contents.entries).length, 1);
    contents.entries.MLBTEST404 = Date.now() - 31 * 60_000;
    await writeFile(cache, JSON.stringify(contents), "utf8");
    const third = await new MercadoLivreApiFonte("air fryer", 10, "mock-token").buscar();
    assert.equal(third.length, 1);
    assert.equal(negatives, 2, "expired 404 must be retried");
  });
});

test("HTTP 429 on catalog item aborts this round immediately without retry", async () => {
  let itemRequests = 0;
  let otherRequests = 0;
  await mocked((async (url: URL | string) => {
    const str = String(url);
    if (str.includes("/products/search")) return products(["MLBRATELIMIT", "MLBNEXT"]);
    if (str.includes("/products/MLBRATELIMIT/items")) {
      itemRequests++;
      if (itemRequests === 1) return reply({ error: "too_many_requests" }, 429);
      return reply({ results: [] });
    }
    otherRequests++;
    return reply({ results: [] });
  }) as typeof fetch, async () => {
    await assert.rejects(
      new MercadoLivreApiFonte("teste", 10, "mock-token").buscar(),
      (error: unknown) => (error as { code?: string }).code === "MERCADOLIVRE_LIMITE_REQUISICOES"
    );
    assert.equal(itemRequests, 1, "HTTP 429 may not be retried in same round");
    assert.equal(otherRequests, 0, "next catalog must not be queried after 429");
  });
});

test("HTTP 429 during seller reputation also aborts rather than declaring non-green", async () => {
  let reputations = 0;
  await mocked((async (url: URL | string) => {
    const str = String(url);
    if (str.includes("/products/search")) return products(["MLBRATESELLER"]);
    if (str.includes("/products/MLBRATESELLER/items")) return reply({ results: [{
      item_id: "MLB1", seller_id: 20, price: 50,
      original_price: 100, condition: "new", available_quantity: 1
    }] });
    if (str.includes("/users/bulk")) {
      reputations++;
      if (reputations === 1) return reply({ error: "too_many_requests" }, 429);
      return greenSeller(20);
    }
    throw new Error("Unexpected mock URL");
  }) as typeof fetch, async () => {
    await assert.rejects(
      new MercadoLivreApiFonte("teste", 10, "mock-token").buscar(),
      (error: unknown) => (error as { code?: string }).code === "MERCADOLIVRE_LIMITE_REQUISICOES"
    );
    assert.equal(reputations, 1);
  });
});

test("two search instances share request pacing rather than burst simultaneously", async () => {
  const timestamps: number[] = [];
  await mocked((async (url: URL | string) => {
    assert.match(String(url), /products\/search/);
    timestamps.push(Date.now());
    return products([]);
  }) as typeof fetch, async () => {
    await Promise.all([
      new MercadoLivreApiFonte("fone", 10, "mock-token").buscar(),
      new MercadoLivreApiFonte("cozinha", 10, "mock-token").buscar()
    ]);
    assert.equal(timestamps.length, 2);
    assert.ok(timestamps[1] - timestamps[0] >= 180,
      "global limiter should pace two independent sources by >= 250 ms");
  });
});

test("HTTP 429 on second catalog page does not return partial search as success", async () => {
  let searchPages = 0;
  await mocked((async (url: URL | string) => {
    const str = String(url);
    if (str.includes("/products/search")) {
      searchPages++;
      const offset = new URL(str).searchParams.get("offset");
      if (offset === "0") return reply({
        paging: { total: 2 },
        results: [{ id: "MLBNOITEMS", name: "Air fryer teste", status: "active" }]
      });
      return reply({ error: "too_many_requests" }, 429);
    }
    if (str.includes("/products/MLBNOITEMS/items")) return reply({}, 404);
    throw new Error("Unexpected mocked request");
  }) as typeof fetch, async () => {
    process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY = "2";
    await assert.rejects(
      new MercadoLivreApiFonte("cozinha", 1, "mock-token").buscar(),
      (error: unknown) => (error as { code?: string }).code === "MERCADOLIVRE_LIMITE_REQUISICOES"
    );
    assert.equal(searchPages, 2);
  });
});

test("HTTP 200 with zero listings is not treated as an explicit catalog 404", async () => {
  let emptyFetches = 0;
  await mocked((async (url: URL | string) => {
    const str = String(url);
    if (str.includes("/products/search")) return products(["MLBEMPTY"]);
    if (str.includes("/products/MLBEMPTY/items")) {
      emptyFetches++;
      return reply({ results: [] });
    }
    throw new Error("Unexpected request");
  }) as typeof fetch, async () => {
    await new MercadoLivreApiFonte("teste", 10, "mock-token").buscar();
    await new MercadoLivreApiFonte("teste", 10, "mock-token").buscar();
    assert.equal(emptyFetches, 2, "only explicit 404 responses may be cached");
  });
});

test("unwritable 404 cache does not block the API search", async () => {
  let requested = 0;
  await mocked((async (url: URL | string) => {
    const str = String(url);
    if (str.includes("/products/search")) return products(["MLBNOPUBLICATION"]);
    if (str.includes("/products/MLBNOPUBLICATION/items")) {
      requested++;
      return reply({}, 404);
    }
    throw new Error("Unexpected request");
  }) as typeof fetch, async cache => {
    await writeFile(cache + ".parent", "not-a-directory", "utf8");
    process.env.MERCADOLIVRE_CATALOG_404_CACHE_PATH =
      join(cache + ".parent", "cache.json");
    const result = await new MercadoLivreApiFonte("teste", 10, "mock-token").buscar();
    assert.equal(result.length, 0);
    assert.equal(requested, 1);
  });
});

test("corrupted cache is ignored; non-green sellers never pass", async () => {
  await mocked((async (url: URL | string) => {
    const str = String(url);
    if (str.includes("/products/search")) return products(["MLBUNTRUSTED"]);
    if (str.includes("/products/MLBUNTRUSTED/items")) return reply({ results: [{
      item_id: "MLBNOTGREEN", seller_id: 90, price: 50, original_price: 100,
      condition: "new"
    }] });
    if (str.includes("/users/bulk")) return greenSeller(90, false);
    throw new Error("Unexpected mock URL");
  }) as typeof fetch, async cache => {
    await writeFile(cache, "{corrupted", "utf8");
    const offres = await new MercadoLivreApiFonte("teste", 10, "mock-token").buscar();
    assert.equal(offres.length, 0, "untrusted seller cannot become an offer");
  });
});
