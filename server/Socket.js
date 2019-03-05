const SocketIo = require("socket.io");
const User = require("./models/User");
const Chat = require("./models/Chat");

/** Class representing our Socket implementation. */
module.exports = class Socket {
  /**
   * @param {Mongoose} mongoose Our mongoose instance.
   */
  constructor(mongoose) {
    this.mongoose = mongoose;

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
   * Filters a list of users by another user, to get any duplicates.
   * @param {User[]} users
   * @param {User} filterUser
   * @returns {User[]} A list of duplicated users.
   */
  static getMatchedUsers(users, filterUser) {
    return users.filter(user => user._id.equals(filterUser._id));
  }

  /**
   * Called when a socket connects.
   * Handles a socket connection between a specific chat and a specific user.
   * Finds the specific chat and the specific user in the database.
   * Adds the socket to the room of the specific chat.
   * Afterwards, if there aren't any duplicate users in the chat:
   *   Emits to every websocket in the chat room that the user has been connected.
   * Finally listen to the disconnection event.
   * @param {Object} socket The connected socket.
   * @param {String} socket.chatId The specific chat id.
   * @param {String} socket.userId The specific user id.
   * @async
   */
  async onConnect(socket) {
    let chatId = socket.handshake.query.chatId;
    let userId = socket.handshake.query.userId;

    if (
      !this.mongoose.isValidObjectId(chatId) ||
      !this.mongoose.isValidObjectId(userId)
    ) {
      return;
    }

    let chat = await Chat.findById(chatId).populate("users");
    if (!chat) {
      return;
    }

    let user = await User.findById(userId);
    if (!user) {
      return;
    }

    chat.users.push(user);
    await chat.save();

    /** Add the websocket to the room of the chat. */
    socket.join(chatId);

    if (Socket.getMatchedUsers(chat.users, user).length === 1) {
      /** Emit to every websocket in the chat room that the user has been connected. */
      this.io.to(chatId).emit("userConnected", user.toClientObject());
    }

    /** Listen to the disconnection event. */
    socket.on("disconnect", () => {
      this.onDisconnect(chatId, user);
    });
  }

  /**
   * Called when a socket disconnects.
   * Finds the user in the chat and removes him.
   * Afterwards, if there aren't any duplicate users in the chat:
   *   Emits to every websocket in the chat room that the user has been disconnected.
   * @param {String} chatId
   * @param {User} user
   * @async
   */
  async onDisconnect(chatId, user) {
    let chat = await Chat.findById(chatId).populate("users");
    if (!chat) {
      return;
    }

    /** Remove the user from the chat. */
    let chatUserIndex = chat.users.findIndex(chatUser =>
      chatUser._id.equals(user._id)
    );
    if (chatUserIndex === -1) {
      return;
    }

    chat.users.splice(chatUserIndex, 1);
    await chat.save();

    if (Socket.getMatchedUsers(chat.users, user).length === 0) {
      /** Emit to every websocket in the chat room that the user has been disconnected. */
      this.io.to(chatId).emit("userDisconnected", user.toClientObject());
    }
  }
};
