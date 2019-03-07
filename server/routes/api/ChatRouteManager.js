const RouteManager = require("../RouteManager");

/** Class that registers all the api chat routes and handlers. */
module.exports = class ChatRouteManager extends RouteManager {
  /**
   * @param {MainWorker} mainWorker Our mainWorker instance.
   * @param {Socket} socket Our socket instance.
   */
  constructor(mainWorker, socket) {
    super(mainWorker, socket);

    this.registerRoutes();
  }

  /**
   * Register all the api chat routes here.
   */
  registerRoutes() {
    this.get(/^\/api\/chats$/i, (req, res) => this.getChats(res));

    this.get(/^\/api\/chats\/(.*)\/users$/i, (req, res, chatId) =>
      this.getChatUsers(res, chatId)
    );

    this.get(/^\/api\/chats\/(.*)\/messages$/i, (req, res, chatId) =>
      this.getChatMessages(res, chatId)
    );

    this.post(/^\/api\/chats\/create$/i, (req, res) =>
      this.createChat(req, res)
    );

    this.post(/^\/api\/chats\/(.*)\/typing$/i, (req, res, chatId) =>
      this.postChatUserTyping(req, res, chatId)
    );

    this.post(/^\/api\/chats\/(.*)\/message$/i, (req, res, chatId) =>
      this.postChatMessage(req, res, chatId)
    );
  }

  /**
   * Passes the job of retrieving the list of chats to a worker.
   * @param {Response} res The HTTP response.
   */
  getChats(res) {
    this.mainWorker
      .send({
        op: "getChats"
      })
      .then(message => {
        res.writeHead(message.statusCode, message.contentType);
        res.end(message.payload);
      });
  }

  /**
   * Passes the job of retrieving the list of users of a specific chat to a worker.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   */
  getChatUsers(res, chatId) {
    this.mainWorker
      .send({
        op: "getChatUsers",
        chatId
      })
      .then(message => {
        res.writeHead(message.statusCode, message.contentType);
        res.end(message.payload);
      });
  }

  /**
   * Passes the job of retrieving the list of messages of a specific chat to a worker.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   */
  getChatMessages(res, chatId) {
    this.mainWorker
      .send({
        op: "getChatMessages",
        chatId
      })
      .then(message => {
        res.writeHead(message.statusCode, message.contentType);
        res.end(message.payload);
      });
  }

  /**
   * Passes the job of posting a message of a specific user in a specific chat to a worker.
   * Emits to every websocket in the chat room that a message has just been posted,
   * along with the said message.
   * Also emits to every websocket in the chat room that a user has stopped typing,
   * along with the said user.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   * @async
   */
  async postChatMessage(req, res, chatId) {
    let fields = await this.parseFormFields(req);

    this.mainWorker
      .send({
        op: "postChatMessage",
        chatId,
        userId: fields.userId,
        messageContent: fields.messageContent
      })
      .then(message => {
        res.writeHead(message.statusCode, message.contentType);
        res.end(message.payload);

        let chatMessage = message.chatMessage;
        if (chatMessage) {
          /** Emit to every websocket in the chat room that a message has just been posted. */
          this.socket.io.to(chatId).emit("messagePosted", chatMessage);
        }

        let user = message.user;
        if (user) {
          /** Emit to every websocket in the chat room that a user has stopped typing. */
          this.socket.io.to(chatId).emit("userStoppedTyping", user);
        }
      });
  }

  /**
   * Passes the job of confirming that a user who is currently typing, exists in the chat, to a worker.
   * Emits to every websocket in the chat room that a user has started typing, along with the said user.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   * @async
   */
  async postChatUserTyping(req, res, chatId) {
    let fields = await this.parseFormFields(req);

    this.mainWorker
      .send({
        op: "postChatUserTyping",
        chatId,
        userId: fields.userId
      })
      .then(message => {
        res.writeHead(message.statusCode);
        res.end();

        let user = message.user;
        if (user) {
          /** Emit to every websocket in the chat room that a user has started typing. */
          this.socket.io.to(chatId).emit("userStartedTyping", user);
        }
      });
  }

  /**
   * Passes the job of creating a new chat with a unique name to a worker.
   * Emits to every websocket that a new chat has just been created, along with the said chat.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   * @async
   */
  async createChat(req, res) {
    let fields = await this.parseFormFields(req);

    this.mainWorker
      .send({
        op: "createChat",
        userId: fields.userId,
        chatName: fields.chatName
      })
      .then(message => {
        res.writeHead(message.statusCode, message.contentType);
        res.end(message.payload);

        let chat = message.chat;
        if (chat) {
          /** Emit to every websocket that a new chat has been created. */
          this.socket.io.emit("chatCreated", chat);
        }
      });
  }
};
