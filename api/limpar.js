import { openStore } from "./presencas.js";
import { normalizeName } from "../schedule.js";

const DATE = "2026-11-19";
const TEST_NAMES = new Set(["verificacao agente", "teste fresco"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function isConflict(error) {
  if (!error) return false;
  if (error.name === "BlobPreconditionFailedError") return true;
  const message = String(error.message || "").toLowerCase();
  return message.includes("already exists") || message.includes("precondition") || message.includes("condition");
}

export async function POST() {
  const store = await openStore();
  if (!store.configured) return json({ error: "As presenças ainda não estão disponíveis." }, 503);
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await store.read(DATE);
      const byName = Object.create(null);
      let removed = false;
      for (const value of Object.values(current.record?.byName || {})) {
        if (!value || typeof value.name !== "string") continue;
        if (TEST_NAMES.has(normalizeName(value.name))) {
          removed = true;
          continue;
        }
        byName[normalizeName(value.name)] = value;
      }
      if (!removed) return json({ removed: false });
      try {
        await store.write(DATE, { date: DATE, byName }, current.etag);
        return json({ removed: true, remaining: Object.keys(byName).length });
      } catch (error) {
        if (isConflict(error) && attempt < 4) continue;
        throw error;
      }
    }
  } catch (error) {
    console.error("limpar", error?.name || "error");
    return json({ error: "Não foi possível guardar." }, 500);
  }
  return json({ error: "Não foi possível guardar." }, 500);
}
