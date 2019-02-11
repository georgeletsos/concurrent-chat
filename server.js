"use strict";

/** Core Node module. */
const http = require("http");

/** The port for the server to listen to. */
const PORT = process.env.PORT || 8080;

/** Socket.io library. */
const socketio = require("socket.io");

/** Our request handler functions that respond to various requests. */
const handlers = require("./handlers");

/**
 * Route-handler pairings.
 * When a given route RegExp matches against the request URL, the associated handler function is called.
 */
const routes = [
  [/^\/api\/auth\/register$/i, handlers.registerUser],
  [/^\/api\/auth\/login$/i, handlers.loginUser],
  [/^\/api\/chats$/i, handlers.getChats],
  [/^\/api\/chats\/(.*)\/users$/i, handlers.getChatUsers],
  [/^\/api\/chats\/(.*)\/messages$/i, handlers.getChatMessages],
  [/^\/api\/chats\/(.*)\/message$/i, handlers.postChatMessage],
  [/^\/api\/chats\/(.*)\/typing$/i, handlers.typing],
  [/^\/api\/chats\/create$/i, handlers.createChat],
  [/^\/(.+)\.(js|css|svg)$/i, handlers.staticFile],
  [/^\/(.*)$/i, handlers.index]
];

/**
 * Create an HTTP server.
 * This handler will iterate over our routes array, and test for a match.
 * If found the handler is called with the request, the response, and the regular expression result.
 */
const server = http.createServer((req, res) => {
  for (let route of routes) {
    let result = route[0].exec(req.url);
    if (result) {
      route[1](req, res, result[1]);
      break;
    }
  }
});

server.listen(PORT, () => {
  console.log(`Listening at ${PORT}`);
});

/** Initialize a new instance of socket.io by passing the above server. */
const io = socketio(server);

/** Listen on the websocket connect event */
io.on("connect", handlers.connectSocket);
