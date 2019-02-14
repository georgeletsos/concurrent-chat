/**
 * @typedef {import("http")} http
 * @typedef {import("http").Server} httpServer
 * @typedef {import("./Api.js").Api} Api
 * @typedef {import("./Socket.js").Socket} Socket
 * @typedef {import("./Router.js").Router} Router
 */

/**
 * @const
 * @type {http}
 */
const http = require("http");

/**
 * @const
 * @type {Api}
 */
const Api = require("./Api");

/**
 * @const
 * @type {Socket}
 */
const Socket = require("./Socket");

/**
 * @const
 * @type {Router}
 */
const Router = require("./Router");

/** Class representing our Server implementation. */
module.exports = class Server {
  /**
   * @param {Number} port
   */
  constructor(port) {
    /**
     * The port for the server to run on.
     * @type {Number}
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
     * @type {httpServer}
     */
    this.server = http.createServer((req, res) =>
      this.router.resolveRouting(req, res)
    );

    this.socket.connect(this.server);
  }

  /** Start the server listening for connections. */
  start() {
    this.server.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
    });
  }
};
