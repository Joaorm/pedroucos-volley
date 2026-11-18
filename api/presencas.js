import { createRequire } from "node:module";
import { applyVote, cleanName, cleanStatus, isTrainingDate, lisbonToday, present, resolveSchedule } from "../schedule.js";

const require = createRequire(import.meta.url);
const CACHE_MAX_AGE = 60;

function loadSiteData() {
  return require("../data.json");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function pathnameFor(date) {
  return `presencas/${date}.json`;
}

function isConflict(error) {
  if (!error) return false;
  if (error.name === "BlobPreconditionFailedError") return true;
  const status = error.status || error.statusCode;
  if (status === 409 || status === 412) return true;
  const message = String(error.message || "").toLowerCase();
  return message.includes("already exists") || message.includes("precondition") || message.includes("condition");
}

export async function openStore() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { configured: false };
  const { list, put } = await import("@vercel/blob");
  return {
    configured: true,
    async read(date) {
      const pathname = pathnameFor(date);
      const { blobs } = await list({ prefix: pathname, limit: 10 });
      const blob = blobs.find((item) => item.pathname === pathname);
      if (!blob) return { etag: null, record: null };
      const url = new URL(blob.url);
      // Unique query so a public blob is not served from the 60s CDN cache after an overwrite.
      url.searchParams.set("v", `${blob.etag || "0"}-${Date.now()}`);
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      if (response.status === 404) return { etag: null, record: null };
      if (!response.ok) throw new Error("blob_read");
      const record = await response.json();
      if (!record || typeof record !== "object" || Array.isArray(record) || !record.byName || typeof record.byName !== "object" || Array.isArray(record.byName)) {
        throw new Error("blob_shape");
      }
      return { etag: blob.etag || null, record };
    },
    async write(date, record, etag) {
      await put(pathnameFor(date), JSON.stringify(record), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: Boolean(etag),
        cacheControlMaxAge: CACHE_MAX_AGE,
        contentType: "application/json",
        ...(etag ? { ifMatch: etag } : {}),
      });
    },
  };
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > 2000) return { error: json({ error: "Pedido inválido." }, 400) };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: json({ error: "Pedido inválido." }, 400) };
    return { body };
  } catch {
    return { error: json({ error: "Pedido inválido." }, 400) };
  }
}

export async function dispatch(request, store) {
  if (!store?.configured) {
    return json({ error: "As presenças ainda não estão disponíveis.", code: "storage_unconfigured" }, 503);
  }

  const url = new URL(request.url);
  let data;
  try {
    data = loadSiteData();
  } catch (error) {
    console.error("presencas", error?.name || "data");
    return json({ error: "Não foi possível carregar as presenças." }, 500);
  }
  const schedule = resolveSchedule(data);
  const today = lisbonToday();

  if (request.method === "GET") {
    const date = url.searchParams.get("date") || "";
    if (!isTrainingDate(schedule, date, today)) return json({ error: "Data inválida." }, 400);
    try {
      const { record } = await store.read(date);
      return json(present(date, record));
    } catch (error) {
      console.error("presencas", error?.name || "read");
      return json({ error: "Não foi possível carregar as presenças." }, 500);
    }
  }

  if (request.method === "POST") {
    const type = request.headers.get("content-type") || "";
    if (!type.includes("application/json")) return json({ error: "Pedido inválido." }, 400);
    const parsed = await readBody(request);
    if (parsed.error) return parsed.error;
    const date = typeof parsed.body.date === "string" ? parsed.body.date : "";
    if (!isTrainingDate(schedule, date, today)) return json({ error: "Data inválida." }, 400);
    if (!cleanName(parsed.body.name)) return json({ error: "Nome inválido." }, 400);
    if (!cleanStatus(parsed.body.status)) return json({ error: "Resposta inválida." }, 400);

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = await store.read(date);
        const next = applyVote(current.record, date, parsed.body.name, parsed.body.status);
        if (next.error === "full") return json({ error: "Lista cheia." }, 400);
        if (next.error) return json({ error: "Nome inválido." }, 400);
        if (next.unchanged) return json(present(date, next.record));
        try {
          await store.write(date, next.record, current.etag);
          return json(present(date, next.record));
        } catch (error) {
          if (isConflict(error) && attempt < 4) continue;
          throw error;
        }
      }
    } catch (error) {
      console.error("presencas", error?.name || "write");
      return json({ error: "Não foi possível guardar." }, 500);
    }
  }

  return json({ error: "Método inválido." }, 405);
}

async function handle(request) {
  try {
    return await dispatch(request, await openStore());
  } catch (error) {
    console.error("presencas", error?.name || "handler");
    return json({ error: "Não foi possível carregar as presenças." }, 500);
  }
}

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
