const http = require("http");
const Socket = require("./Socket");
const Router = require("./Router");
const Mongoose = require("./Mongoose");
const Chat = require("./models/Chat");

/** Class representing our Server implementation. */
module.exports = class Server {
  constructor() {
    /**
     * The port for the server to run on.
     * @type {Number}
     */
    this.port = process.env.PORT || 8080;

    Mongoose.connect().then(async () => {
      console.log("Connected to MongoDB");

      await Chat.createGeneralChatIfNotExists();

      this.socket = new Socket(Mongoose);
      this.router = new Router(Mongoose, this.socket);

      this.server = http.createServer((req, res) =>
        this.router.resolveRouting(req, res)
      );

      /** Connect socket to this server. */
      await this.socket.connect(this.server);

      /** Start the server listening for connections. */
      this.server.listen(this.port, () => {
        console.log(`Server running on port ${this.port}`);
      });
    });
  }
};
