FROM node:alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production=false

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
