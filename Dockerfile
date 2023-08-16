FROM node:16

RUN mkdir /usr/app
WORKDIR /usr/app

# Copy these files first to optimize cache
COPY package.json .
COPY yarn.lock .

RUN yarn install
COPY . .
EXPOSE 3000 8000
CMD ["yarn", "start"]