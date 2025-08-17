FROM node:24-alpine3.22

# working directory 
WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm install --production

COPY . .

EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
