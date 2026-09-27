# Estágio 1: Base com Node.js
FROM node:18-slim

# Instalar Python e dependências matemáticas para o script de Leontief
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install numpy --break-system-packages

# Definir diretório de trabalho
WORKDIR /app

# Copiar dependências do Node.js
COPY backend/package*.json ./
RUN npm install

# Copiar o restante do código
COPY . .

# Expor a porta do servidor Express
EXPOSE 3000

# Comando para iniciar
CMD ["node", "backend/server.js"]