/**
 * @typedef {import("fs")} fs
 * @typedef {import("path")} path
 * @typedef {import("formidable")} formidable
 * @typedef {import("formidable").Fields} formidableFields
 * @typedef {import("./Socket.js").Socket} Socket
 * @typedef {import("./Route.js").Route} Route
 * @typedef {import("./Route.js").routeCallback} routeCallback
 * @typedef {import("./models/User")} User
 * @typedef {import("./models/Chat")} Chat
 * @typedef {import("./models/Message")} Message
 */

/**
 * @typedef {Object} Router
 * @property {Socket} socket
 * @property {Route[]} routes
 */

/**
 * @const
 * @type {fs}
 */
const fs = require("fs");

/**
 * @const
 * @type {path}
 */
const path = require("path");

/**
 * @const
 * @type {formidable}
 */
const formidable = require("formidable");

/**
 * @const
 * @type {Route}
 */
const Route = require("./Route");

/**
 * @const
 * @type {mongoose}
 */
const mongoose = require("mongoose");

/**
 * @const
 * @type {User}
 */
const User = require("./models/User");

/**
 * @const
 * @type {Chat}
 */
const Chat = require("./models/Chat");

/**
 * @const
 * @type {Message}
 */
const Message = require("./models/Message");

/** Class representing our Router implementation. */
module.exports = class Router {
  /**
   * @param {Socket} socket
   */
  constructor(socket) {
    /**
     * Instance of Socket.
     * @type {Socket}
     */
    this.socket = socket;

    /**
     * @type {Route[]}
     */
    this.routes = [];

    this.registerRoutes();

    mongoose
      .connect("mongodb://localhost:27017/node-chat", {
        useNewUrlParser: true
      })
      .then(async () => {
        console.log("Connected to MongoDB");

        await Chat.createGeneralChatIfNotExists();
      });
  }

  /**
   * Register all the routes.
   * Home/index route needs to be registered last.
   */
  registerRoutes() {
    this.get(
      /^(\/(?:js|css|img)\/[^/].+\.(?:js|css|svg))$/i,
      (req, res, filename) => this.streamStaticFile(res, filename)
    );

    this.post(/^\/api\/auth\/register$/i, (req, res) =>
      this.registerUser(req, res)
    );

    this.post(/^\/api\/auth\/login$/i, (req, res) => this.loginUser(req, res));

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

    this.get(/^.*$/i, (req, res) => this.streamIndexFile(res));
  }

  /**
   * Register a new GET route.
   * @param {RegExp} regexpUrl A RegExp the request url should match.
   * @param {routeCallback} routeHandler The callback to run.
   */
  get(regexpUrl, routeHandler) {
    this.routes.push(new Route("get", regexpUrl, routeHandler));
  }

  /**
   * Register a new POST route.
   * @param {RegExp} regexpUrl A RegExp the request url should match.
   * @param {routeCallback} routeHandler The callback to run.
   */
  post(regexpUrl, routeHandler) {
    this.routes.push(new Route("post", regexpUrl, routeHandler));
  }

  /**
   * Iterate over the routes array while checking if the request url matches the RegExp.
   * If the request url matched, check first if the request method matches.
   * If the request method also matched, just run the route callback handler.
   * If the request method did not match, stream the home/index route instead.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   */
  resolveRouting(req, res) {
    for (let route of this.routes) {
      let regexpObj = route.regexpUrl.exec(req.url);
      if (!regexpObj) {
        continue;
      }

      if (!this.ensureRequestMethod(req, route.method)) {
        return this.streamIndexFile(res);
      }

      return route.routeHandler.call(this, req, res, regexpObj[1]);
    }
  }

  /**
   * Ensure that the expected HTTP `method` was used with a given request `req`.
   * @param {Request} req The HTTP request.
   * @param {String} method A HTTP method. Usually get or post.
   * @returns {boolean} True or false.
   */
  ensureRequestMethod(req, method) {
    return req.method.toLowerCase() === method.toLowerCase();
  }

  /**
   * Stream the home/index file.
   * @param {Response} res The HTTP response.
   */
  streamIndexFile(res) {
    let indexFile = path.join(__dirname, "..", "public", "index.html");

    this.streamFile(res, indexFile);
  }

  /**
   * Stream a static file.
   * @param {Response} res The HTTP response.
   * @param {String} filePath The file and its parent folder.
   */
  streamStaticFile(res, filePath) {
    let file = path.join(__dirname, "..", "public", filePath);

    this.streamFile(res, file);
  }

  /**
   * Stream a file by creating a stream to read the `file`,
   * and piping the `file` to the HTTP `res`.
   * @param {Response} res The HTTP response.
   * @param {String} file The full path of the file to serve.
   */
  streamFile(res, file) {
    let contentType = this.getContentType(file);
    res.writeHead(200, { "Content-Type": contentType });

    let stream = fs.createReadStream(file);

    stream.on("error", err => {
      /** If file was not found... */
      if (err.code === "ENOENT") {
        /** Just stream the home/index file. */
        this.streamIndexFile(res);
      }
    });

    /** End the response when there's no more input. */
    stream.on("end", () => {
      res.end();
    });

    stream.pipe(res);
  }

  /**
   * Get the correct content type based on the extension of the file.
   * @param {String} file The name of the file.
   * @returns {String} The content type.
   */
  getContentType(file) {
    let fileExtension = path.extname(file);

    switch (fileExtension.toLowerCase()) {
      case ".html":
        return "text/html";
      case ".js":
        return "application/javascript";
      case ".css":
        return "text/css";
      case ".svg":
        return "image/svg+xml";
      default:
        return "";
    }
  }

  /**
   * Use the IncomingForm class from the formidable library to parse the form data of a request.
   * @param {Request} req The HTTP request.
   * @returns {Promise<formidableFields>} A promise that is resolved with the parsed form data.
   */
  parseFormFields(req) {
    return new Promise((resolve, reject) => {
      new formidable.IncomingForm().parse(req, (error, fields) => {
        if (error) {
          reject(error);
        } else {
          resolve(fields);
        }
      });
    });
  }

  /**
   * Register a new user and respond with the said user.
   * If any form fields are missing, respond with 400 and any validation message(s).
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   */
  async registerUser(req, res) {
    let fields = await this.parseFormFields(req);
    let username = fields.username;

    if (!username) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ username: "This field is required" }));
      return;
    }

    let latestUser = await User.getLatestUser();

    let tag = latestUser ? latestUser.tag + 1 : 1;

    let user = new User({
      name: username,
      tag: tag
    });

    await user.save();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(user.toClientJSON());
  }

  /**
   * Log a user in to the API, after finding the user in the database.
   * If any form fields are missing, respond with 400.
   * If the user was not found in memory, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   */
  async loginUser(req, res) {
    let fields = await this.parseFormFields(req);
    let userId = fields.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.writeHead(400);
      res.end();
      return;
    }

    let user = await User.findById(userId);

    if (!user) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200);
    res.end();
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
    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
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
      options: { sort: { name: "asc" } }
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
    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
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
      !mongoose.Types.ObjectId.isValid(chatId) ||
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId) ||
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
      !mongoose.Types.ObjectId.isValid(chatId) ||
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId)
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

    if (!userId || !mongoose.Types.ObjectId.isValid(userId) || !chatName) {
      res.writeHead(400);
      res.end();
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
