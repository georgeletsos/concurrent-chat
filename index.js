const Server = require("./server/Server");
const PORT = process.env.PORT || 8080;
const server = new Server(PORT);

server.start();
