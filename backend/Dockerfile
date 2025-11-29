FROM node:20-alpine

# Install ffmpeg and required codecs
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-libs \
    x264 \
    x265

WORKDIR /app

# Create directories
RUN mkdir -p /app/public/sprites /app/logs

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]