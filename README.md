# Voleibol — Clube Sportivo de Pedrouços

Site estático com uma função para as presenças. Projeto Vercel: `cspedroucos-volley` (`prj_Kqb31uJBB1JDavFAm287nQAiOoAS`), equipa `coding-team4` (`team_RVK2ZfigXSWU92b2cyysatgT`).

URL pública: https://cspedroucos-volley.vercel.app

O deploy de produção faz-se pelo git (`main`). A função `api/presencas.js` precisa do `npm install` da Vercel.

## Páginas

- `index.html` — presenças do próximo treino e do seguinte. Terças e quintas, sem hora nem local.
- `jogos.html` — resultados e próximos jogos.
- `data.json` — jogos e horário. Em `treinos`: `dias` (`terca`, `quinta`) e `cancelados` (datas `AAAA-MM-DD`).
- `schedule.js` — geração das datas e validação dos nomes, usado pela página e pela API.

## Presenças

Cada treino fica num blob `presencas/AAAA-MM-DD.json` na store `cspedroucos-presencas`.

Variável obrigatória no projeto (Production, Preview e Development):

- `BLOB_READ_WRITE_TOKEN`

Sem esta variável, `GET` e `POST /api/presencas` respondem 503 e a página mostra que as presenças ainda não estão disponíveis.

## Como pré-visualizar

```bash
npm install
npm test
python3 -m http.server 8765
```

O servidor estático não responde a `/api/presencas`. Para experimentar o botão, usa `vercel dev` com o token, ou um servidor local que chame `dispatch` em `api/presencas.js`.

Pedidos de alteração: `einstein.rochaemelo+volley@mail.grokbot.com`.
