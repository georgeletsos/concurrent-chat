/**
 * @typedef {import("./Api.js").Api} Api
 */

/**
 * @typedef {Object} Socket
 * @property {Api} api
 * @property {Socket.io} io
 */

/** Socket.io library. */
const socketio = require("socket.io");

/** Class representing our Socket implementation. */
module.exports = class Socket {
  /**
   * @param {Api} api
   * @constructor
   */
  constructor(api) {
    /**
     * Instance of Api.
     * @type {Api}
     */
    this.api = api;
  }

  /**
   * Initialize a new instance of socket.io with the `server`.
   * Listen on the websocket connect event.
   * @param {http.Server} server
   */
  connect(server) {
    this.io = socketio(server).on("connect", socket => this.onConnect(socket));
  }

  /**
   * Handle a websocket connection between a specific chat and a specific user.
   * Start by finding the specific chat and the specific user in memory.
   * If the user is already in the chat, just update the time the user joined.
   * Otherwise add the user in the chat, and sort the users alphabetically.
   * Add the websocket to the room of the specific chat.
   * Emit to every websocket in the chat room that the user has just been connected.
   * Finally listen to the websocket disconnect event,
   * when the user has been disconnected, remove the user from the list of users of the chat
   * and emit to every websocket in chat the room that the user has been disconnected.
   * @param {Object} socket The connected websocket.
   * @param {string} socket.chatId The specific chat id.
   * @param {string} socket.userId The specific user id.
   */
  onConnect(socket) {
    let chatId = socket.handshake.query.chatId,
      userId = socket.handshake.query.userId,
      now = new Date().getTime();

    let chat = this.api.findChatById(chatId);
    if (!chat) {
      return;
    }

    let user = this.api.findUserById(userId);
    if (!user) {
      return;
    }

    let chatUser = this.api.findChatUserById(chat, user.id);
    if (chatUser) {
      chatUser.joinedAt = now;
    } else {
      chat.users.push(user);

      chat.users.sort(this.api.sortByName);
    }

    /** Add the websocket to the room of the chat. */
    socket.join(chatId);

    /** Emit to every websocket in the chat room, that the user has been connected. */
    this.io.to(chatId).emit("userConnected", user);

    /** Listen to the websocket disconnect event. */
    socket.on("disconnect", () => {
      /** Remove the user from the list of users of the chat. */
      let userIndex = chat.users.findIndex(el => el.id === user.id);
      if (userIndex > -1) {
        chat.users.splice(userIndex, 1);
      }

      /** Emit to every websocket in the chat room, that the user has been disconnected. */
      this.io.to(chatId).emit("userDisconnected", user);
    });
  }
};
