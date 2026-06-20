FROM node:18-alpine

WORKDIR /workspace

# Install system dependencies if needed (e.g., for native addons)
RUN apk add --no-cache libc6-compat

# Copiamos solo los archivos de dependencias primero para optimizar la cache de Docker
COPY package.json package-lock.json* ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 3000

# Iniciar la app en modo desarrollo
CMD ["npm", "run", "dev"]
