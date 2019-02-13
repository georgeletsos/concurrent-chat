/**
 * @typedef {import("./Api.js").Api} Api
 * @typedef {import("./Socket.js").Socket} Socket
 */

/**
 * @typedef {Object} Router
 * @property {Api} api
 * @property {Socket} socket
 * @property {Route[]} routes
 */

/**
 * @typedef {Object} Route
 * @property {String} method
 * @property {RegExp} regexpUrl
 * @property {Function} routeHandler
 */

/** Core Node module. */
const fs = require("fs");
const path = require("path");

/** Formidable library. */
const formidable = require("formidable");

/** Class representing our Router implementation. */
module.exports = class Router {
  /**
   * @param {Api} api
   * @param {Socket} socket
   * @constructor
   */
  constructor(api, socket) {
    /**
     * Instance of Api.
     * @type {Api}
     */
    this.api = api;

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
  }

  /**
   * Register all the routes.
   * Home/index route needs to be registered last.
   */
  registerRoutes() {
    this.get(/^(?:\/.*\/)*(.+\.(?:js|css|svg))$/i, (req, res, filename) =>
      this.streamStaticFile(res, filename)
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
   * @param {Function} routeHandler The callback to run.
   */
  get(regexpUrl, routeHandler) {
    this.routes.push({ method: "get", regexpUrl, routeHandler });
  }

  /**
   * Register a new POST route.
   * @param {RegExp} regexpUrl A RegExp the request url should match.
   * @param {Function} routeHandler The callback to run.
   */
  post(regexpUrl, routeHandler) {
    this.routes.push({ method: "post", regexpUrl, routeHandler });
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
   * @param {string} method A HTTP method. Usually get or post.
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
   * @param {String} filename The name of the file.
   */
  streamStaticFile(res, filename) {
    let staticFolder = this.getStaticFolder(filename);
    let file = path.join(__dirname, "..", "public", staticFolder, filename);

    this.streamFile(res, file);
  }

  /**
   * Stream a file by creating a stream to read the `file`,
   * and piping the `file` to the HTTP `res`.
   * @param {Response} res The HTTP response.
   * @param {string} file The full path of the file to serve.
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
   * Get the name of the static folder based on the extension of the file.
   * @param {String} file The name of the file.
   * @returns {String} The name of the static folder.
   */
  getStaticFolder(file) {
    let fileExtension = path.extname(file);

    switch (fileExtension.toLowerCase()) {
      case ".js":
        return "js";
      case ".css":
        return "css";
      case ".svg":
        return "img";
      default:
        return "";
    }
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
   * @returns {Promise} A promise that is resolved with the parsed form data.
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

    if (!fields.username) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ username: "This field is required" }));
      return;
    }

    let user = {
      id: this.api.generateUuid(),
      tag: this.api.userTagGenerator.next().value,
      name: fields.username,
      createdAt: new Date().getTime()
    };

    this.api.users.push(user);

    let pluckedUser = {
      id: user.id,
      tag: user.tag,
      name: user.name
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(pluckedUser));
  }

  /**
   * Log a user in to the API, after finding the user in memory.
   * If any form fields are missing, respond with 400.
   * If the user was not found in memory, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   */
  async loginUser(req, res) {
    let fields = await this.parseFormFields(req);

    if (!fields.userId) {
      res.writeHead(400);
      res.end();
      return;
    }

    let user = this.api.findUserById(fields.userId);

    if (!user) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200);
    res.end();
  }

  /**
   * Get the list of chats in memory and respond with the said list.
   * @param {Response} res The HTTP response.
   */
  async getChats(res) {
    let pluckedChats = this.api.chats.map(chat => {
      return { id: chat.id, name: chat.name };
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(pluckedChats));
  }

  /**
   * Get the list of users of a specific chat, after finding the chat in memory
   * and respond with the said list.
   * If any form fields are missing, respond with 400.
   * If the chat was not found in memory, respond with 404.
   * @param {Response} res The HTTP response.
   * @param {string} chatId The id of the specific chat.
   */
  async getChatUsers(res, chatId) {
    if (!chatId) {
      res.writeHead(400);
      res.end();
      return;
    }

    let chat = this.api.findChatById(chatId);

    if (!chat) {
      res.writeHead(404);
      res.end();
      return;
    }

    let pluckedChatUsers = chat.users.map(user => {
      return { id: user.id, tag: user.tag, name: user.name };
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(pluckedChatUsers));
  }

  /**
   * Get the list of messages of a specific chat, after finding the chat in memory
   * and respond with the said list.
   * If any form fields are missing, respond with 400.
   * If the chat was not found in memory, respond with 404.
   * @param {Response} res The HTTP response.
   * @param {string} chatId The id of the specific chat.
   */
  async getChatMessages(res, chatId) {
    if (!chatId) {
      res.writeHead(400);
      res.end();
      return;
    }

    let chat = this.api.findChatById(chatId);

    if (!chat) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(chat.messages));
  }

  /**
   * Post a message of a specific user in a specific chat, after finding the chat and the user in memory
   * and respond with the said message.
   * Emit to every websocket in the chat room that a message has just been posted,
   * along with the said message.
   * Finish by emitting to every websocket in the chat room that a user has stopped typing,
   * along with the said user.
   * If any form fields are missing, respond with 400.
   * If the chat or the user was not found in memory, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {string} chatId The id of the specific chat.
   */
  async postChatMessage(req, res, chatId) {
    let fields = await this.parseFormFields(req);

    if (!chatId || !fields.userId || !fields.messageContent) {
      res.writeHead(400);
      res.end();
      return;
    }

    let chat = this.api.findChatById(chatId);

    if (!chat) {
      res.writeHead(404);
      res.end();
      return;
    }

    let chatUser = this.api.findChatUserById(chat, fields.userId);

    if (!chatUser) {
      res.writeHead(404);
      res.end();
      return;
    }

    let message = {
      id: this.api.generateUuid(),
      user: chatUser,
      content: fields.messageContent,
      sentAt: new Date().getTime()
    };

    this.api.messages.push(message);

    chat.messages.push(message);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(message));

    /** Emit to every websocket in the chat room that a message has just been posted. */
    this.socket.io.to(chatId).emit("chatMessage", message);

    /** Emit to every websocket in the chat room that a user has stopped typing. */
    this.socket.io.to(chatId).emit("userStoppedTyping", chatUser);
  }

  /**
   * After finding the specific chat and the specific user in memory, respond successfully
   * and emit to every websocket in the chat room that a user has started typing,
   * along with the said user.
   * If any form fields are missing, respond with 400.
   * If the chat or the user was not found in memory, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {string} chatId The id of the specific chat.
   */
  async postChatUserTyping(req, res, chatId) {
    let fields = await this.parseFormFields(req);

    if (!chatId || !fields.userId) {
      res.writeHead(400);
      res.end();
      return;
    }

    let chat = this.api.findChatById(chatId);

    if (!chat) {
      res.writeHead(404);
      res.end();
      return;
    }

    let chatUser = this.api.findChatUserById(chat, fields.userId);

    if (!chatUser) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(204);
    res.end();

    /** Emit to every websocket in the chat room that a user has started typing. */
    this.socket.io.to(chatId).emit("userStartedTyping", chatUser);
  }

  /**
   * Create a new chat with a specific user as the owner, after finding the user in memory
   * and respond with the said chat.
   * Finish by emitting to every websocket that a new chat has just been created, along with the said chat.
   * If any form fields are missing, respond with 400.
   * If the user was not found in memory, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @param {string} chatId The id of the specific chat.
   */
  async createChat(req, res) {
    let fields = await this.parseFormFields(req);

    if (!fields.userId || !fields.chatName) {
      res.writeHead(400);
      res.end();
      return;
    }

    let user = this.api.findUserById(fields.userId);

    if (!user) {
      res.writeHead(404);
      res.end();
      return;
    }

    let chat = {
      id: this.api.generateUuid(),
      name: fields.chatName,
      owner: user,
      users: [],
      messages: [],
      createdAt: new Date().getTime()
    };

    this.api.chats.push(chat);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(chat));

    /** Emit to every websocket that a new chat has been created. */
    this.socket.io.emit("chatCreated", chat);
  }
};
