FROM node:18-slim

# Instalar FFmpeg y dependencias necesarias
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar código fuente y prisma
COPY . .

# Generar cliente Prisma
RUN npx prisma generate

# Crear directorios necesarios
RUN mkdir -p media/live recordings

# Exponer puerto
EXPOSE 3000

# Script de inicio
CMD ["npm", "start"]
