# Site da equipa de voleibol — Clube Sportivo de Pedrouços

Site estático (sem build, sem backend). Projeto Vercel: `pedroucos-volley` (`prj_d5J8lbUzlq42BOKYbzjjLYLeIanl`), equipa `coding-team4` (`team_RVK2ZfigXSWU92b2cyysatgT`).

URL pública: https://pedroucos-volley.vercel.app (Vercel Authentication desligada no projeto).

## Ficheiros
- `index.html` — página (HTML + CSS + JS inline). Normalmente não é preciso mexer.
- `data.json` — **todos os conteúdos**: `equipa`, `proximos_jogos`, `resultados`.
  - Datas `AAAA-MM-DD`, horas `HH:MM`; `casa`: `true` (casa) / `false` (fora).
  - `proximos_jogos[]`: `data`, `hora`, `local`, `adversario`, `casa`. Jogos passados escondem-se sozinhos.
  - `resultados[]`: `data`, `adversario`, `casa`, `sets` como `"nós-eles"`, ex. `["25-20","22-25"]` — o resultado final (3–1) e vitória/derrota são calculados.
  - `"exemplo": true` mostra a etiqueta "Exemplo" — apagar as entradas de exemplo quando houver dados reais.
- `logo.png` (original 500x500), `logo-180.png` (usado no site), `vercel.json` (cache do data.json), `preview.png` (captura do site em telemóvel).
- `deploy.py` — gera o payload da deployment (`/tmp/volley-deploy.json`).

## Como voltar a publicar
1. Editar `data.json` (validar: `python3 -m json.tool data.json`).
2. Pré-visualizar: `python3 -m http.server 8765` e abrir http://localhost:8765.
3. Publicar com o conector Vercel (MCP `user-Vercel`):
   - `python3 deploy.py` → escreve `/tmp/volley-deploy.json` com todos os ficheiros inline (base64).
   - `create_deployment` com esse `requestBody` (`name: "pedroucos-volley"`, `project: "pedroucos-volley"`, `target: "production"`, `projectSettings.framework: null`) e o `teamId` da conta.
   - A produção fica em https://pedroucos-volley.vercel.app. Para o logo grande, usar `upload_file` + referência por sha (máx. 4 argumentos `$file:` por chamada).
   - Alternativa com CLI: `npx vercel deploy --prod` nesta pasta (precisa de login).
4. Confirmar: `curl -sI https://<alias>/data.json` → 200.

Pedidos de alteração chegam por email a `einstein.rochaemelo+volley@mail.grokbot.com`.
