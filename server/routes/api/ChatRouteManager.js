const RouteManager = require("../RouteManager");
const User = require("../../models/User");
const Chat = require("../../models/Chat");
const Message = require("../../models/Message");

/** Class that registers all the api chat routes and handlers. */
module.exports = class ChatRouteManager extends RouteManager {
  /**
   * @param {Mongoose} mongoose Our mongoose instance.
   * @param {Socket} socket Our socket instance.
   */
  constructor(mongoose, socket) {
    super(mongoose, socket);

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
   * Get the list of chats from the database and respond with the said list.
   * @param {Response} res The HTTP response.
   */
  async getChats(res) {
    let chats = await Chat.find();

    chats = chats.map(chat => chat.toClientObject());

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(chats));
  }

  /**
   * Get the list of users of a specific chat, after finding the chat in the database
   * and respond with the said list.
   * If any form fields are missing, respond with 400.
   * If the chat was not found in memory, respond with 404.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   */
  async getChatUsers(res, chatId) {
    if (!chatId || !this.mongoose.isValidObjectId(chatId)) {
      res.writeHead(400);
      res.end();
      return;
    }

    /**
     * Find the specific chat in the database, with all its users.
     * Also sort the users alphabetically.
     */
    let chat = await Chat.findById(chatId).populate({
      path: "users",
      options: { sort: { name: "asc", tag: "asc" } }
    });

    if (!chat) {
      res.writeHead(404);
      res.end();
      return;
    }

    let users = chat.users.map(user => user.toClientObject());

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(users));
  }

  /**
   * Get the list of messages of a specific chat, after finding the chat in the database
   * and respond with the said list.
   * If any form fields are missing, respond with 400.
   * If the chat was not found in memory, respond with 404.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   */
  async getChatMessages(res, chatId) {
    if (!chatId || !this.mongoose.isValidObjectId(chatId)) {
      res.writeHead(400);
      res.end();
      return;
    }

    /**
     * Find all the messages of the specific chats,
     * along with the users.
     */
    let messages = await Message.find({ chat: chatId }).populate("user");

    messages = messages.map(message => message.toClientObject());

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(messages));
  }

  /**
   * Post a message of a specific user in a specific chat, after finding the chat and the user in the database
   * and respond with the said message.
   * Emit to every websocket in the chat room that a message has just been posted,
   * along with the said message.
   * Finish by emitting to every websocket in the chat room that a user has stopped typing,
   * along with the said user.
   * If any form fields are missing, respond with 400.
   * If the chat or the user was not found in memory, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   */
  async postChatMessage(req, res, chatId) {
    let fields = await this.parseFormFields(req);
    let userId = fields.userId;
    let messageContent = fields.messageContent;

    if (
      !chatId ||
      !this.mongoose.isValidObjectId(chatId) ||
      !userId ||
      !this.mongoose.isValidObjectId(userId) ||
      !messageContent
    ) {
      res.writeHead(400);
      res.end();
      return;
    }

    /**
     * Find the specific chat in the database,
     * with all its users.
     */
    let chat = await Chat.findById(chatId).populate("users");

    if (!chat) {
      res.writeHead(404);
      res.end();
      return;
    }

    /**
     * Check whether the specific user
     * is in the chat.
     */
    let user = chat.users.find(user => user._id.toString() === userId);

    if (!user) {
      res.writeHead(404);
      res.end();
      return;
    }

    let message = new Message({
      content: messageContent,
      chat: chat._id,
      user: user._id
    });

    await message.save();

    message.user = user;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(message.toClientJSON());

    /** Emit to every websocket in the chat room that a message has just been posted. */
    this.socket.io.to(chatId).emit("chatMessage", message.toClientObject());

    /** Emit to every websocket in the chat room that a user has stopped typing. */
    this.socket.io.to(chatId).emit("userStoppedTyping", user.toClientObject());
  }

  /**
   * After finding the specific chat and the specific user in the database, respond successfully
   * and emit to every websocket in the chat room that a user has started typing,
   * along with the said user.
   * If any form fields are missing, respond with 400.
   * If the chat or the user was not found in memory, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   */
  async postChatUserTyping(req, res, chatId) {
    let fields = await this.parseFormFields(req);
    let userId = fields.userId;

    if (
      !chatId ||
      !this.mongoose.isValidObjectId(chatId) ||
      !userId ||
      !this.mongoose.isValidObjectId(userId)
    ) {
      res.writeHead(400);
      res.end();
      return;
    }

    /**
     * Find the specific chat in the database,
     * with all its users.
     */
    let chat = await Chat.findById(chatId).populate("users");

    if (!chat) {
      res.writeHead(404);
      res.end();
      return;
    }

    /**
     * Check whether the specific user
     * is in the chat.
     */
    let user = chat.users.find(user => user._id.toString() === userId);

    if (!user) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(204);
    res.end();

    /** Emit to every websocket in the chat room that a user has started typing. */
    this.socket.io.to(chatId).emit("userStartedTyping", user.toClientObject());
  }

  /**
   * Create a new chat, after finding the user in the database
   * and respond with the said chat.
   * Finish by emitting to every websocket that a new chat has just been created, along with the said chat.
   * If any form fields are missing, respond with 400.
   * If the user was not found in memory, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {String} chatId The id of the specific chat.
   */
  async createChat(req, res) {
    let fields = await this.parseFormFields(req);
    let userId = fields.userId;
    let chatName = fields.chatName;

    if (!userId || !this.mongoose.isValidObjectId(userId) || !chatName) {
      res.writeHead(400);
      res.end();
      return;
    }

    let existingChat = await Chat.findOne({ name: chatName });
    if (existingChat) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ chatName: "Chat already exists" }));
      return;
    }

    let user = await User.findById(userId);

    if (!user) {
      res.writeHead(404);
      res.end();
      return;
    }

    let chat = new Chat({
      name: chatName
    });

    await chat.save();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(chat.toClientJSON());

    /** Emit to every websocket that a new chat has been created. */
    this.socket.io.emit("chatCreated", chat.toClientObject());
  }
};
