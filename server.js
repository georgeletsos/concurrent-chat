"use strict";

/** Core Node module. */
const http = require("http");

/** Socket.io library. */
const socketio = require("socket.io");

/** Commander library, very helpful with parsing command line arguments. */
const commander = require("commander");

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
  [/^\/api\/chat\/(.*)\/users$/i, handlers.getChatUsers],
  [/^\/api\/chat\/(.*)\/messages$/i, handlers.getChatMessages],
  [/^\/api\/chat\/(.*)\/message$/i, handlers.postChatMessage],
  [/^\/api\/chat\/(.*)\/typing$/i, handlers.typing],
  [/^\/api\/chat\/create$/i, handlers.createChat],
  [/^\/(.+)\.(js|css|svg)$/i, handlers.staticFile],
  [/^\/(.*)$/i, handlers.index]
];

/** Add command line options using the commander library and parse them. */
commander
  .option(
    "-p, --port <port>",
    "The port to listen on",
    process.env.PORT || 8081
  )
  .parse(process.argv);

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

server.listen(commander.port, () => {
  console.log(`Listening at ${commander.port}`);
});

/** Initialize a new instance of socket.io by passing the above server. */
const io = socketio(server);

/** Listen on the websocket connect event */
io.on("connect", handlers.connectSocket);
