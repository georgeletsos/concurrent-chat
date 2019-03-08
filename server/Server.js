"use strict";

const http = require("http");
const path = require("path");
const MainWorkerPool = require("./workers/main/MainWorkerPool");
const Socket = require("./Socket");
const StaticRouteManager = require("./routes/StaticRouteManager");
const AuthRouteManager = require("./routes/AuthRouteManager");
const ChatRouteManager = require("./routes/api/ChatRouteManager");

/** Class representing our Server implementation. */
module.exports = class Server {
  constructor() {
    let workerPath = path.join(__dirname, "workers", "threads", "index.js");
    this.mainWorkerPool = new MainWorkerPool(workerPath);

    this.mainWorkerPool.connectMongo().then(async () => {
      console.log("Everyone is connected to MongoDB");

      /** Day(s) * Hour(s) * Minute(s) * Second(s) * 1000 */
      let twoWeeksInMilliSeconds = 14 * 24 * 60 * 60 * 1e3;

      await Promise.all([
        this.mainWorkerPool.send({ op: "createGeneralChatIfNotExists" }),
        this.mainWorkerPool.send({ op: "clearChatsFromUsers" }),
        this.mainWorkerPool.send({
          op: "deleteMessagesAndUnusedChatsSince",
          sinceTime: twoWeeksInMilliSeconds
        })
      ]);

      /**
       * Setup the mechanism to delete messages and unused chats
       * every 2 weeks.
       */
      setInterval(() => {
        this.mainWorkerPool.send({
          op: "deleteMessagesAndUnusedChatsSince",
          sinceTime: twoWeeksInMilliSeconds
        });
      }, twoWeeksInMilliSeconds);

      this.socket = new Socket(this.mainWorkerPool);

      /** Register the auth routes. */
      let authRouteManager = new AuthRouteManager(this.mainWorkerPool);
      let authRoutes = authRouteManager.routes;

      /** Register the api chat routes. */
      let chatRouteManager = new ChatRouteManager(
        this.mainWorkerPool,
        this.socket
      );
      let chatRoutes = chatRouteManager.routes;

      /** Register the static routes. */
      let staticRouteManager = new StaticRouteManager();
      let staticRoutes = staticRouteManager.routes;

      /** Keep all of the routes here. */
      this.routes = [...authRoutes, ...chatRoutes, ...staticRoutes];

      /**
       * Create the server.
       * The callback iterates over the `routes` array while checking if the request url matches the RegExp.
       * If the request url matched, check first if the request method matches:
       *   If the request method also matched, simply run the route handler.
       *   Otherwise, stream the home/index route instead.
       */
      this.server = http.createServer((req, res) => {
        for (let route of this.routes) {
          let regexpObj = route.regexpUrl.exec(req.url);
          if (!regexpObj) {
            continue;
          }

          if (!this.ensureRequestMethod(req, route.method)) {
            staticRouteManager.streamIndexFile(res);
            break;
          }

          route.routeHandler.call(this, req, res, regexpObj[1]);
          break;
        }
      });

      /** Connect the socket to this server. */
      await this.socket.connect(this.server);

      this.port = process.env.PORT || 8080;

      /** Start the server listening for connections. */
      this.server.listen(this.port, () => {
        console.log(`Server running on port ${this.port}`);
      });
    });
  }

  /**
   * Ensure that the expected HTTP `method` was used with a given request `req`.
   * @param {Request} req The HTTP request.
   * @param {String} method A HTTP method. Usually get or post.
   * @returns {Boolean}
   */
  ensureRequestMethod(req, method) {
    return req.method.toLowerCase() === method.toLowerCase();
  }
};
