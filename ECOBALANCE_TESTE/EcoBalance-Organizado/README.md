# EcoBalance Ledger — versão organizada

Reorganização do projeto original (que veio com ~40 arquivos soltos, nomeados
tipo `ecobalance08_JSintegrNodeJS_2026.js`, com extensões que não batem com o
conteúdo real). Nada de lógica foi reescrito — só reorganizado, mais alguns
bugs de integração corrigidos (ver `NOTAS_CORRECOES.md`).

## Estrutura

```
.
├── backend/
│   ├── server.js          # API Express (rota /api/calculate-equilibrium)
│   ├── leontief_calc.py   # Cálculo da Inversa de Leontief (NumPy)
│   ├── test_leontief.py   # Testes unitários do cálculo
│   ├── monitoramentoGRI.js# Lógica de alerta Twilio (não usada pelo server.js ainda)
│   └── package.json
├── frontend/
│   └── index.html         # Dashboard completo (Vue + Tailwind + Chart.js + Leaflet), servido pelo Express
├── db/
│   ├── schema.sql          # Estrutura das tabelas
│   └── seed.sql             # Dados de exemplo (setores, coeficientes, transações)
├── mobile/                 # App React Native / Expo (projeto separado, não entra no Docker)
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Como rodar (Web + API + banco, via Docker)

1. Instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Copie `.env.example` para `.env` e preencha as chaves (pode deixar os
   valores fictícios se só quiser testar sem alertas via Twilio).
3. Na raiz do projeto:
   ```bash
   docker-compose up --build -d
   ```
4. Acesse **http://localhost:3000** — o Express já serve o `frontend/index.html`.
5. Ver logs: `docker logs -f ecobalance_app`
6. Parar tudo: `docker-compose down` (adicione `-v` para apagar também os dados do MySQL).

## Como rodar só o frontend (sem Docker, sem backend)

Abra `frontend/index.html` direto no navegador. Os cálculos de exemplo rodam
no próprio JavaScript da página; não precisa de servidor para visualizar.

## Como rodar o app mobile (Expo)

```bash
cd mobile
npm install
npx expo start
```
Escaneie o QR code com o app **Expo Go** (Android/iOS) ou rode `npx expo start --web`.

## Rodando os testes do backend Python

```bash
cd backend
pip install numpy
python3 -m unittest test_leontief.py
```
