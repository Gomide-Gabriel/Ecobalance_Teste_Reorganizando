# O que eu mudei em relação aos arquivos originais

Só reorganizar não bastava — havia bugs que impediam o backend de rodar.
Lista completa, para você saber exatamente o que foi tocado:

1. **`##nome_do_arquivo` no topo de todo arquivo mobile** (`App.js` e todos os
   arquivos em `mobile/src/`). Isso é sintaxe inválida em JavaScript — o app
   quebraria com erro de sintaxe na primeira linha. Removido.

2. **`backend/package.json` não existia.** O Dockerfile espera
   `COPY backend/package*.json ./`, mas esse arquivo nunca foi criado no
   projeto original. Criei um com as dependências que o `server.js`
   realmente usa (`express`, `express-handlebars`, `jsonwebtoken`,
   `mysql2`, `twilio`, `dotenv`).

3. **`spawn('python', ...)`** — a imagem Docker (`node:18-slim`) só tem o
   binário `python3`, não `python`. Corrigido para `python3`.

4. **Faltava `app.use(express.json())`** — sem isso, `req.body` chegaria
   `undefined` na rota `/api/calculate-equilibrium`.

5. **Credenciais Twilio hardcoded** (`'ACCOUNT_SID', 'AUTH_TOKEN'` como
   strings literais) em vez de ler do `.env`. Corrigido para usar
   `process.env.TWILIO_SID` / `TWILIO_TOKEN`, e só dispara o alerta se
   as variáveis existirem.

6. **`docker-compose.yml` passava `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`**
   para o container, mas o código lê `TWILIO_SID`/`TWILIO_TOKEN` — nomes
   não batiam. Alinhado.

7. **Nada servia o frontend.** O `server.js` original só expunha a rota de
   API; não havia como abrir o dashboard através do servidor. Adicionei
   `express.static` apontando para `frontend/`.

8. **`seed.sql` só rodava parcialmente**: o `docker-compose.yml` original só
   montava `schema.sql` em `docker-entrypoint-initdb.d`; os dados de exemplo
   (`seed.sql`) nunca eram inseridos automaticamente. Agora os dois são
   montados, em ordem (`01_schema.sql`, `02_seed.sql`).

## O que eu NÃO mudei

- A lógica de cálculo de Leontief (`leontief_calc.py`) — matemática está correta.
- O dashboard (`frontend/index.html`) — está funcional como veio.
- `monitoramentoGRI.js` — existe no projeto mas nunca é chamado por
  `server.js`; deixei como está porque não quis adivinhar como você
  pretende integrá-lo (poderia ser chamado dentro da rota de cálculo, por
  exemplo). Me avise se quiser que eu conecte isso.
