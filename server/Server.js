const http = require("http");
const Socket = require("./Socket");
const mongoose = require("./Mongoose");
const StaticRouteManager = require("./routes/StaticRouteManager");
const AuthRouteManager = require("./routes/AuthRouteManager");
const ChatRouteManager = require("./routes/api/ChatRouteManager");
const Chat = require("./models/Chat");

/** Class representing our Server implementation. */
module.exports = class Server {
  constructor() {
    mongoose.connect().then(async () => {
      console.log("Connected to MongoDB");

      await Chat.createGeneralChatIfNotExists();

      this.socket = new Socket(mongoose);

      /** Register the auth routes. */
      let authRouteManager = new AuthRouteManager(mongoose);
      let authRoutes = authRouteManager.routes;

      /** Register the api chat routes. */
      let chatRouteManager = new ChatRouteManager(mongoose, this.socket);
      let chatRoutes = chatRouteManager.routes;

      /** Register the static routes. */
      let staticRouteManager = new StaticRouteManager();
      let staticRoutes = staticRouteManager.routes;

      /** Keep all of the routes here. */
      this.routes = [...authRoutes, ...chatRoutes, ...staticRoutes];

      /**
       * Create the server.
       * The callback iterates over the `routes` array while checking if the request url matches the RegExp.
       * If the request url matched, check first if the request method matches.
       * If the request method also matched, just run the route handler.
       * Otherwise, stream the home/index route instead.
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
