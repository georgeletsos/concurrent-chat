/**
 * @typedef {import("./Api.js").Api} Api
 * @typedef {import("./Socket.js").Socket} Socket
 * @typedef {import("./Router.js").Router} Router
 */

/** Core Node module. */
const http = require("http");

const Router = require("./Router");
const Api = require("./Api");
const Socket = require("./Socket");

/** Class representing our Server implementation. */
module.exports = class Server {
  /**
   * @param {number} port
   * @constructor
   */
  constructor(port) {
    /**
     * The port for the server to run on.
     * @type {number}
     */
    this.port = port;

    /**
     * Instance of Api.
     * @type {Api}
     */
    this.api = new Api();

    /**
     * Instance of Socket.
     * @type {Socket}
     */
    this.socket = new Socket(this.api);

    /**
     * Instance of Router.
     * @type {Router}
     */
    this.router = new Router(this.api, this.socket);

    /**
     * Instance of http Server.
     * @type {http.Server}
     */
    this.server = http.createServer((req, res) =>
      this.router.resolveRouting(req, res)
    );

    this.socket.connect(this.server);
  }

  /**
   * Start the server listening for connections.
   */
  start() {
    this.server.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
    });
  }
};
