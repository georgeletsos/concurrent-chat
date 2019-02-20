"use strict";

const http = require("http");
const Socket = require("./Socket");
const mongoose = require("./Mongoose");
const StaticRouteManager = require("./routes/StaticRouteManager");
const AuthRouteManager = require("./routes/AuthRouteManager");
const ChatRouteManager = require("./routes/api/ChatRouteManager");
const Chat = require("./models/Chat");
const Message = require("./models/Message");

/** Class representing our Server implementation. */
module.exports = class Server {
  constructor() {
    mongoose.connect().then(async () => {
      console.log("Connected to MongoDB");

      await Promise.all([
        Chat.createGeneralChatIfNotExists(),
        Chat.clearChatsFromUsers()
      ]);

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

      let now = new Date().getTime();
      /** Day(s) * Hour(s) * Minute(s) * Second(s) * 1000 */
      let twoWeeksInmSeconds = 14 * 24 * 60 * 60 * 1e3;
      let twoWeeksAgo = new Date(now - twoWeeksInmSeconds);
      await this.deleteMessagesAndUnusedChatsSince(twoWeeksAgo);

      /**
       * Setup the mechanism to delete Messages and unused Chats
       * every 2 weeks.
       */
      setInterval(() => {
        this.deleteMessagesAndUnusedChatsSince();
      }, twoWeeksInmSeconds);

      this.port = process.env.PORT || 8080;

      /** Start the server listening for connections. */
      this.server.listen(this.port, () => {
        console.log(`Server running on port ${this.port}`);
      });
    });
  }

  /**
   * Delete Messages and unused Chats that are older than `sinceDate`, except #general-chat.
   *   Start by deleting Messages that are older than `sinceDate`.
   *   Then count the remaining Messages for every Chat, other than #general-chat.
   *   If any Chat doesn't have Messages anymore, look up whether that Chat was created before `sinceDate`.
   *   If so, then delete that Chat.
   *   Otherwise, leave it be.
   * @param {Date} sinceDate
   */
  async deleteMessagesAndUnusedChatsSince(sinceDate) {
    let chats = await Chat.find();
    for (let chat of chats) {
      /** Delete Messages of Chat that are old. */
      let { n, ok } = await Message.deleteMany({
        chat: chat.id,
        createdAt: { $lte: sinceDate }
      });

      if (ok !== 1) {
        console.log("Deleting old messages of Chat", chat.name, "error", ok);
        continue;
      }

      if (n > 0) {
        console.log(
          "Deleted",
          n,
          "old messages of Chat",
          chat.name,
          "successfully!"
        );
      }

      /** If #general-chat, stop here. */
      if (chat.name === "general-chat") {
        continue;
      }

      /** Otherwise, count the remaining Messages of Chat. */
      Message.countDocuments({
        chat: chat.id
      }).then((count, err) => {
        if (err) {
          console.log(
            "Count remaining Messages of Chat",
            chat.name,
            "error",
            err
          );
          return;
        }

        if (count > 0) {
          console.log(
            "Chat",
            chat.name,
            "still has",
            count,
            "Messages remaining!"
          );
          return;
        }

        /**
         * If the Chat has no Messages now:
         *   Look up whether the Chat is old.
         *   And if so, delete that Chat.
         */
        let chatCreationTimestamp = new Date(chat.createdAt).getTime();
        if (chatCreationTimestamp > sinceDate.getTime()) {
          return;
        }

        chat.remove(function(err, chat) {
          if (err) {
            console.log(
              "Deleting old Chat",
              chat.name,
              "without messages error",
              err
            );
          }
          console.log(
            "Deleted old Chat",
            chat.name,
            "without messages successfully!"
          );
        });
      });
    }
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
