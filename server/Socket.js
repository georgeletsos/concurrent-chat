const SocketIo = require("socket.io");

/** Class representing our Socket implementation. */
module.exports = class Socket {
  /**
   * @param {MainWorkerPool} mainWorkerPool Our mainWorkerPool instance.
   */
  constructor(mainWorkerPool) {
    this.mainWorkerPool = mainWorkerPool;

    this.onConnect = this.onConnect.bind(this);
    this.onDisconnect = this.onDisconnect.bind(this);
  }

  /**
   * Initialize a new instance of socket.io with the given server.
   * Listen on the connection event for incoming sockets.
   * @param {Server} server The given server.
   */
  connect(server) {
    this.io = SocketIo(server);

    this.io.on("connect", this.onConnect);
  }

  /**
   * Called when a socket connects.
   * Passes the job to a worker.
   * After the worker has responded successfully with a user:
   *   Adds the socket to the room of the specific chat.
   *   Emits to every websocket in the chat room that the user has been connected.
   *   Finally listens to the disconnection event.
   * @param {Object} socket The connected socket.
   * @param {String} socket.chatId The specific chat id.
   * @param {String} socket.userId The specific user id.
   */
  onConnect(socket) {
    let chatId = socket.handshake.query.chatId;
    let userId = socket.handshake.query.userId;

    this.mainWorkerPool
      .send({ op: "socketOnConnect", chatId, userId })
      .then(message => {
        /** Add the websocket to the room of the chat. */
        socket.join(chatId);

        let user = message.user;
        if (user) {
          /** Emit to every websocket in the chat room that the user has been connected. */
          this.io.to(chatId).emit("userConnected", user);
        }

        /** Listen to the disconnection event. */
        socket.on("disconnect", () => {
          this.onDisconnect(chatId, userId);
        });
      });
  }

  /**
   * Called when a socket disconnects.
   * Passes the job to a worker.
   * After the worker has responded successfully with a user:
   *   Emits to every websocket in the chat room that the user has been disconnected.
   * @param {String} chatId
   * @param {User} userId
   */
  onDisconnect(chatId, userId) {
    this.mainWorkerPool
      .send({ op: "socketOnDisconnect", chatId, userId })
      .then(message => {
        let user = message.user;
        if (user) {
          /** Emit to every websocket in the chat room that the user has been disconnected. */
          this.io.to(chatId).emit("userDisconnected", user);
        }
      });
  }
};
