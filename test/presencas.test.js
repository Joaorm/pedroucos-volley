import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatch, GET } from "../api/presencas.js";
import {
  applyVote,
  formatSession,
  isTrainingDate,
  lisbonToday,
  nextTrainings,
  normalizeName,
  present,
  resolveSchedule,
} from "../schedule.js";

const fixed = resolveSchedule({
  treinos: { dias: ["terça", "quinta"], cancelados: ["2026-11-19"] },
});

test("próximos treinos a partir de uma quarta são quinta e terça", () => {
  assert.deepEqual(nextTrainings({ treinos: { dias: ["terca", "quinta"], cancelados: [] } }, "2026-11-18", 2), [
    "2026-11-19",
    "2026-11-24",
  ]);
  assert.equal(formatSession("2026-11-19"), "Qui 19/11");
  assert.equal(formatSession("2026-11-24"), "Ter 24/11");
});

test("hoje conta e um cancelamento salta para o treino seguinte", () => {
  assert.deepEqual(nextTrainings({ treinos: { dias: ["terca", "quinta"], cancelados: [] } }, "2026-11-19", 2), [
    "2026-11-19",
    "2026-11-24",
  ]);
  assert.deepEqual(nextTrainings(fixed, "2026-11-18", 2), ["2026-11-24", "2026-11-26"]);
  assert.equal(isTrainingDate(fixed, "2026-11-19", "2026-11-18"), false);
  assert.equal(isTrainingDate(fixed, "2026-11-18", "2026-11-18"), false);
});

test("o mesmo nome com acentos é uma só pessoa e a resposta muda", () => {
  assert.equal(normalizeName("João Silva"), normalizeName("joao silva"));
  const first = applyVote(null, "2026-11-24", "João Silva", "vou");
  const second = applyVote(first.record, "2026-11-24", "joao silva", "nao");
  const view = present("2026-11-24", second.record);
  assert.equal(view.people.length, 1);
  assert.equal(view.people[0].status, "nao");
  assert.equal(view.counts.nao, 1);
  assert.equal(applyVote(null, "2026-11-24", "A", "vou").error, "invalid");
  assert.equal(applyVote(null, "2026-11-24", "Ana", "sim").error, "invalid");
});

test("sem token a API explica que as presenças não estão disponíveis", async () => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const response = await GET(new Request("http://localhost/api/presencas?date=2026-11-19"));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, "storage_unconfigured");
    assert.match(body.error, /presenças/i);
  } finally {
    if (previous) process.env.BLOB_READ_WRITE_TOKEN = previous;
  }
});

function memoryStore(seed = null) {
  return {
    configured: true,
    etag: seed ? "1" : null,
    record: seed,
    async read() {
      return { etag: this.etag, record: this.record };
    },
    async write(_date, record, etag) {
      assert.equal(etag, this.etag);
      this.record = record;
      this.etag = String(Number(this.etag || 0) + 1);
    },
  };
}

async function post(store, body) {
  return dispatch(new Request("http://localhost/api/presencas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), store);
}

test("marcar, mudar e rejeitar respostas fora do horário", async () => {
  const today = lisbonToday();
  const [first] = nextTrainings(resolveSchedule(JSON.parse(readFileSync(new URL("../data.json", import.meta.url), "utf8"))), today, 2);
  const store = memoryStore();
  const going = await post(store, { date: first, name: "Ana Costa", status: "vou" });
  assert.equal(going.status, 200);
  assert.equal((await going.json()).counts.vou, 1);

  const changed = await post(store, { date: first, name: "ana costa", status: "nao" });
  const body = await changed.json();
  assert.equal(changed.status, 200);
  assert.deepEqual(body.people, [{ name: "ana costa", status: "nao" }]);

  const badDay = await post(store, { date: "2026-11-18", name: "Ana Costa", status: "vou" });
  assert.equal(badDay.status, 400);

  const badName = await post(store, { date: first, name: "A", status: "talvez" });
  assert.equal(badName.status, 400);
  assert.match((await badName.json()).error, /Nome/);
});

test("um conflito de escrita relê e não apaga os outros nomes", async () => {
  const today = lisbonToday();
  const [first] = nextTrainings({ treinos: { dias: ["terca", "quinta"], cancelados: [] } }, today, 2);
  let writes = 0;
  const store = {
    configured: true,
    etag: "1",
    record: { date: first, byName: { "ana costa": { name: "Ana Costa", status: "vou", at: "t" } } },
    async read() {
      return { etag: this.etag, record: this.record };
    },
    async write(date, record, etag) {
      writes += 1;
      if (writes === 1) {
        assert.equal(etag, "1");
        this.etag = "2";
        this.record = {
          date,
          byName: {
            "ana costa": { name: "Ana Costa", status: "vou", at: "t" },
            "rui dias": { name: "Rui Dias", status: "nao", at: "t2" },
          },
        };
        const error = new Error("precondition failed");
        error.name = "BlobPreconditionFailedError";
        throw error;
      }
      assert.equal(etag, "2");
      this.record = record;
      this.etag = "3";
    },
  };
  const response = await post(store, { date: first, name: "João Silva", status: "talvez" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.people.map((person) => person.name), ["Ana Costa", "João Silva", "Rui Dias"]);
  assert.equal(writes, 2);
});

test("a página de presenças não mostra hora nem local e os jogos mantêm o calendário", () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const jogos = readFileSync(new URL("../jogos.html", import.meta.url), "utf8");
  const data = JSON.parse(readFileSync(new URL("../data.json", import.meta.url), "utf8"));
  assert.match(index, /Vou/);
  assert.match(index, /Não vou/);
  assert.doesNotMatch(index, /Pavilhão|21:00|hora|local do treino/i);
  assert.match(jogos, /Resultado por confirmar/);
  assert.match(jogos, />Vídeo</);
  assert.match(jogos, /href="\.\/"/);
  assert.match(jogos, /einstein\.rochaemelo\+volley@(?:<wbr>)?mail\.grokbot\.com/);
  assert.deepEqual(data.treinos, { dias: ["terca", "quinta"], cancelados: [] });
  assert.deepEqual(data.proximos_jogos.map((game) => game.adversario), [
    "C. D. R. Ramalha",
    "ADCEO - ATP",
  ]);
  assert.deepEqual(
    data.resultados.map((game) => ({
      data: game.data,
      adversario: game.adversario,
      casa: game.casa,
      resultado: game.resultado,
      sets: game.sets,
    })),
    [
      { data: "2026-11-23", adversario: "C. D. Cova da Piedade", casa: false, resultado: null, sets: [] },
      { data: "2026-11-20", adversario: "Bairro São João A. C.", casa: true, resultado: "0-3", sets: [] },
      { data: "2026-11-09", adversario: "Odivelas Sports Club", casa: false, resultado: "0-3", sets: [] },
      { data: "2026-11-06", adversario: "R. C. Vale de Cavala", casa: true, resultado: "1-3", sets: [] },
    ],
  );
});
