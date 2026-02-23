FROM node:24:13.1

RUN mkdir /usr/app
WORKDIR /usr/app

COPY package.json .
COPY package-lock.json .

RUN npm ci
COPY . .
EXPOSE 3000 8000
CMD ["npm", "start"]