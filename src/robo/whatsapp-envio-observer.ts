import type { Page } from "playwright";

export interface WhatsappOutgoingMessage {
  id: string;
  text: string;
}

export interface WhatsappSendBaseline {
  outgoingCount: number;
  outgoingIds: string[];
  references: string[];
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s*_~]+/g, " ")
    .trim()
    .toLowerCase();
}

function extractUrlReferences(value: string): string[] {
  const result = [value];

  try {
    const url = new URL(value);
    result.push(`${url.hostname}${url.pathname}`);

    const segments = url.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    for (const segment of segments) {
      if (
        segment.length >= 7 &&
        /^[a-z0-9_-]+$/i.test(segment)
      ) {
        result.push(segment);
      }
    }
  } catch {
    // Mantém a URL recebida como referência textual.
  }

  const identifiers = value.match(
    /\b(?:MLB\d{6,}|B0[A-Z0-9]{8}|[A-Z0-9]{10})\b/gi
  );

  if (identifiers) result.push(...identifiers);

  return result;
}

function extractReferences(
  message: string,
  title?: string,
  productId?: string
): string[] {
  const urls = [
    ...message.matchAll(/https?:\/\/[^\s*]+/gi)
  ].map((match) => match[0].replace(/[),.;]+$/g, ""));

  const references = [
    title?.trim() ?? "",
    productId?.trim() ?? "",
    ...urls.flatMap(extractUrlReferences)
  ]
    .map(normalizeText)
    .filter((value) => value.length >= 7);

  return [...new Set(references)];
}

export async function readOutgoingMessages(
  page: Page
): Promise<WhatsappOutgoingMessage[]> {
  return page.evaluate(() => {
    const root = document.querySelector("#main") ?? document.body;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>(
        ".message-out, [data-id^='true_']"
      )
    );

    const seen = new Set<string>();
    const result: Array<{ id: string; text: string }> = [];

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const parentWithId =
        node.closest<HTMLElement>("[data-id]") ??
        node.querySelector<HTMLElement>("[data-id]");

      const id =
        node.getAttribute("data-id") ??
        parentWithId?.getAttribute("data-id") ??
        "";

      const text = (node.innerText || node.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

      const key = id || `${index}:${text}`;
      if (seen.has(key)) continue;

      seen.add(key);
      result.push({ id, text });
    }

    return result;
  });
}

export async function captureSendBaseline(
  page: Page,
  message: string,
  title?: string,
  productId?: string
): Promise<WhatsappSendBaseline> {
  const outgoing = await readOutgoingMessages(page);

  return {
    outgoingCount: outgoing.length,
    outgoingIds: outgoing
      .map((item) => item.id)
      .filter(Boolean),
    references: extractReferences(message, title, productId)
  };
}

export async function detectManualSend(
  page: Page,
  baseline: WhatsappSendBaseline
): Promise<boolean> {
  const outgoing = await readOutgoingMessages(page);

  if (outgoing.length === 0) return false;

  const knownIds = new Set(baseline.outgoingIds);
  const newMessages = outgoing.filter((item, index) => {
    if (item.id) return !knownIds.has(item.id);
    return index >= baseline.outgoingCount;
  });

  if (newMessages.length === 0) return false;

  if (baseline.references.length === 0) {
    return outgoing.length > baseline.outgoingCount;
  }

  return newMessages.some((item) => {
    const text = normalizeText(item.text);
    return baseline.references.some((reference) =>
      text.includes(reference)
    );
  });
}
