FROM node:11

# Copy package.json file to docker image.
COPY package.json /app/

# Define working directory.
WORKDIR /app

RUN npm install --production

COPY ./index.js /app/

CMD node index.js

EXPOSE 7070
