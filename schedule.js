// Horário e validação partilhados pela página e por api/presencas.js.
// Dias: domingo, segunda, terca, quarta, quinta, sexta, sabado (com ou sem acento).

const DAY_KEYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_ALIASES = {
  domingo: "domingo",
  dom: "domingo",
  segunda: "segunda",
  seg: "segunda",
  terca: "terca",
  ter: "terca",
  quarta: "quarta",
  qua: "quarta",
  quinta: "quinta",
  qui: "quinta",
  sexta: "sexta",
  sex: "sexta",
  sabado: "sabado",
  sab: "sabado",
};

export const STATUSES = ["vou", "nao", "talvez"];
export const STATUS_LABELS = { vou: "Vou", nao: "Não vou", talvez: "Talvez" };
const MAX_NAMES = 120;

export function lisbonToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function weekdayIndex(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function normalizeDay(value) {
  const token = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z]+/)[0];
  return DAY_ALIASES[token] || null;
}

export function resolveSchedule(raw) {
  const source = raw && typeof raw === "object" && raw.treinos && typeof raw.treinos === "object" ? raw.treinos : raw || {};
  const dias = [...new Set((Array.isArray(source.dias) ? source.dias : ["terca", "quinta"]).map(normalizeDay).filter(Boolean))];
  const cancelados = [...new Set((Array.isArray(source.cancelados) ? source.cancelados : []).map((item) => String(item).trim()).filter(isIsoDate))];
  return { dias: dias.length ? dias : ["terca", "quinta"], cancelados };
}

export function formatSession(iso) {
  const [, month, day] = iso.split("-").map(Number);
  return `${DAY_LABELS[weekdayIndex(iso)]} ${day}/${month}`;
}

export function nextTrainings(schedule, today, count = 2) {
  const config = resolveSchedule(schedule);
  const wanted = new Set(config.dias);
  const cancelled = new Set(config.cancelados);
  const sessions = [];
  for (let i = 0; i < 400 && sessions.length < count; i += 1) {
    const iso = addDays(today, i);
    const key = DAY_KEYS[weekdayIndex(iso)];
    if (wanted.has(key) && !cancelled.has(iso)) sessions.push(iso);
  }
  return sessions;
}

export function isTrainingDate(schedule, iso, today) {
  if (!isIsoDate(iso) || !isIsoDate(today) || iso < today) return false;
  if (iso > addDays(today, 180)) return false;
  const config = resolveSchedule(schedule);
  if (config.cancelados.includes(iso)) return false;
  return config.dias.includes(DAY_KEYS[weekdayIndex(iso)]);
}

export function cleanName(input) {
  if (typeof input !== "string") return null;
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) return null;
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(name)) return null;
  if (!/\p{L}.*\p{L}/u.test(name)) return null;
  return name;
}

export function normalizeName(name) {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-PT").replace(/\s+/g, " ").trim();
}

export function cleanStatus(value) {
  return STATUSES.includes(value) ? value : null;
}

function readNames(record) {
  const names = Object.create(null);
  const source = record?.byName;
  if (!source || typeof source !== "object") return names;
  for (const value of Object.values(source)) {
    const name = cleanName(value?.name);
    const status = cleanStatus(value?.status);
    if (!name || !status) continue;
    names[normalizeName(name)] = {
      name,
      status,
      at: typeof value.at === "string" ? value.at : "",
    };
  }
  return names;
}

export function applyVote(record, date, name, status) {
  const cleaned = cleanName(name);
  const nextStatus = cleanStatus(status);
  if (!cleaned || !nextStatus) return { error: "invalid" };
  const names = readNames(record);
  const key = normalizeName(cleaned);
  if (!names[key] && Object.keys(names).length >= MAX_NAMES) return { error: "full" };
  const previous = names[key];
  if (previous && previous.name === cleaned && previous.status === nextStatus) {
    return { record: { date, byName: names }, unchanged: true };
  }
  names[key] = { name: cleaned, status: nextStatus, at: new Date().toISOString() };
  return { record: { date, byName: names }, unchanged: false };
}

export function present(date, record) {
  const people = Object.values(readNames(record))
    .map(({ name, status }) => ({ name, status }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const counts = { vou: 0, nao: 0, talvez: 0 };
  for (const person of people) counts[person.status] += 1;
  return { date, counts, people };
}
