"use strict";

/** Core Node modules. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/** Formidable library. */
const formidable = require("formidable");

/** Global reference to socket.io instance. */
var io;

/** List of chats in memory. */
var chats = [];
chats.push({
  id: generateUuid(),
  name: "general-chat",
  owner: "",
  users: [],
  messages: [],
  createdAt: new Date().getTime()
});
chats.push({
  id: generateUuid(),
  name: "test-chat",
  owner: "",
  users: [],
  messages: [],
  createdAt: new Date().getTime()
});

/** List of users in memory. */
var users = [];

/** List of messages in memory. */
var messages = [];

/**
 * Use the IncomingForm class from the formidable library to parse the form data a request.
 * @param {Request} req The HTTP request.
 * @returns {Promise} A promise that is resolved with the parsed form data.
 */
function parseFormFields(req) {
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
 * Serve static files by creating a stream to read the `file`,
 * and piping the `file` to the HTTP `res`.
 * @param {Response} res The HTTP response.
 * @param {File} file The file to serve.
 */
function serveFile(res, file) {
  let stream = fs.createReadStream(file);

  /** End the response when there's no more input. */
  stream.on("end", () => {
    res.end();
  });

  stream.pipe(res);
}

/**
 * Ensure that the expected HTTP `method` was used with a given `request`.
 * @param {Request} req The HTTP request.
 * @param {string} method The HTTP method.
 * @returns {boolean} True or false.
 */
function ensureRequestMethod(req, method) {
  if (req.method === method) {
    return true;
  }

  return false;
}

/**
 * Set `statusCode` for `res` and respond with the stringified JSON `payload`, if there is any.
 * @param {Response} res The HTTP response.
 * @param {number} statusCode The HTTP status code.
 * @param {*} payload The payload to be sent along.
 */
function respondWith(res, statusCode, payload) {
  res.statusCode = statusCode;

  if (payload) {
    res.end(JSON.stringify(payload));
  } else {
    res.end();
  }
}

/**
 * Find a specific Chat in memory.
 * @param {string} chatId The specific chat id.
 * @returns {Object} The specific chat.
 */
function findChatById(chatId) {
  return chats.find(chat => chat.id === chatId);
}

/**
 * Find a specific user of a specific chat in memory.
 * @param {Object} chat The specific chat.
 * @param {string} userId The specific user id.
 * @returns {Object} The specific user of the specific chat.
 */
function findChatUserById(chat, userId) {
  return chat.users.find(user => user.id === userId);
}

/**
 * Find a specific user in memory.
 * @param {string} userId The specific user id.
 * @returns {Object} The specific user.
 */
function findUserById(userId) {
  return users.find(user => user.id === userId);
}

/**
 * Alphabetically sorting algorithm for an object that has a `name` property.
 * @param {Object} a
 * @param {string} a.name
 * @param {Object} b
 * @param {string} b.name
 */
function sortByName(a, b) {
  a = a.name.toLowerCase();
  b = b.name.toLowerCase();

  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

/**
 * Generate basic hex id.
 * @returns {string} A basic hex id.
 */
function generateUuid() {
  return crypto.randomBytes(10).toString("hex");
}

/**
 * Unique id generator function.
 * @yields {number} A unique id.
 */
function* generateId() {
  let id = 1;

  while (true) {
    yield id++;
  }
}

/** The user tag generator. */
const userTagGenerator = generateId();

/**
 * Register a new user and respond with the said user.
 * If the HTTP request method is wrong, respond with 405.
 * If any form fields are missing, respond with 400 and any validation message(s).
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 */
exports.registerUser = async function(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (!ensureRequestMethod(req, "POST")) {
    respondWith(res, 405);
    return;
  }

  let fields = await parseFormFields(req);

  if (!fields.username) {
    respondWith(res, 400, { username: "This field is required" });
    return;
  }

  let user = {
    id: generateUuid(),
    tag: userTagGenerator.next().value,
    name: fields.username,
    createdAt: new Date().getTime()
  };

  users.push(user);

  let pluckedUser = {
    id: user.id,
    tag: user.tag,
    name: user.name
  };

  respondWith(res, 200, pluckedUser);
};

/**
 * Log a user in to the API, after finding the user in memory.
 * If the HTTP request method is wrong, respond with 405.
 * If any form fields are missing, respond with 400.
 * If the user was not found in memory, respond with 404.
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 */
exports.loginUser = async function(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (!ensureRequestMethod(req, "POST")) {
    respondWith(res, 405);
    return;
  }

  let fields = await parseFormFields(req);

  if (!fields.userId) {
    respondWith(res, 400);
    return;
  }

  let user = findUserById(fields.userId);

  if (!user) {
    respondWith(res, 404);
    return;
  }

  respondWith(res, 200);
};

/**
 * Get the list of chats in memory and respond with the said list.
 * If the HTTP request method is wrong, respond with 405.
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 */
exports.getChats = function(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (!ensureRequestMethod(req, "GET")) {
    respondWith(res, 405);
    return;
  }

  let pluckedChats = chats.map(chat => {
    return { id: chat.id, name: chat.name };
  });

  respondWith(res, 200, pluckedChats);
};

/**
 * Get the list of users of a specific chat, after finding the chat in memory
 * and respond with the said list.
 * If the HTTP request method is wrong, respond with 405.
 * If any form fields are missing, respond with 400.
 * If the chat was not found in memory, respond with 404.
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 * @param {string} chatId The id of the specific chat.
 */
exports.getChatUsers = function(req, res, chatId) {
  res.setHeader("Content-Type", "application/json");

  if (!ensureRequestMethod(req, "GET")) {
    respondWith(res, 405);
    return;
  }

  if (!chatId) {
    respondWith(res, 400);
    return;
  }

  let chat = findChatById(chatId);

  if (!chat) {
    respondWith(res, 404);
    return;
  }

  let pluckedChatUsers = chat.users.map(user => {
    return { id: user.id, tag: user.tag, name: user.name };
  });

  respondWith(res, 200, pluckedChatUsers);
};

/**
 * Get the list of messages of a specific chat, after finding the chat in memory
 * and respond with the said list.
 * If the HTTP request method is wrong, respond with 405.
 * If any form fields are missing, respond with 400.
 * If the chat was not found in memory, respond with 404.
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 * @param {string} chatId The id of the specific chat.
 */
exports.getChatMessages = function(req, res, chatId) {
  res.setHeader("Content-Type", "application/json");

  if (!ensureRequestMethod(req, "GET")) {
    respondWith(res, 405);
    return;
  }

  if (!chatId) {
    respondWith(res, 400);
    return;
  }

  let chat = findChatById(chatId);

  if (!chat) {
    respondWith(res, 404);
    return;
  }

  respondWith(res, 200, chat.messages);
};

/**
 * Post a message of a specific user in a specific chat, after finding the chat and the user in memory
 * and respond with the said message.
 * Emit to every websocket in the chat room that a message was just posted,
 * along with the said message.
 * Finish by emitting to every websocket in the chat room that a user has stopped typing,
 * along with the said user.
 * If the HTTP request method is wrong, respond with 405.
 * If any form fields are missing, respond with 400.
 * If the chat or the user was not found in memory, respond with 404.
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 * @param {string} chatId The id of the specific chat.
 */
exports.postChatMessage = async function(req, res, chatId) {
  res.setHeader("Content-Type", "application/json");

  if (!ensureRequestMethod(req, "POST")) {
    respondWith(res, 405);
    return;
  }

  let fields = await parseFormFields(req);

  if (!chatId || !fields.userId || !fields.messageContent) {
    respondWith(res, 400);
    return;
  }

  let chat = findChatById(chatId);

  if (!chat) {
    respondWith(res, 404);
    return;
  }

  let chatUser = findChatUserById(chat, fields.userId);

  if (!chatUser) {
    respondWith(res, 404);
    return;
  }

  let message = {
    id: generateUuid(),
    user: chatUser,
    content: fields.messageContent,
    sentAt: new Date().getTime()
  };

  messages.push(message);

  chat.messages.push(message);

  respondWith(res, 200, message);

  /** Emit to every websocket in the chat room that a message was just posted. */
  io.to(chatId).emit("chatMessage", message);

  /** Emit to every websocket in the chat room that a user has stopped typing. */
  io.to(chatId).emit("userStoppedTyping", chatUser);
};

/**
 * After finding the specific chat and the specific user in memory, respond successfully
 * and emit to every websocket in the chat room that a user has started typing,
 * along with the said user.
 * If the HTTP request method is wrong, respond with 405.
 * If any form fields are missing, respond with 400.
 * If the chat or the user was not found in memory, respond with 404.
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 * @param {string} chatId The id of the specific chat.
 */
exports.typing = async function(req, res, chatId) {
  if (!ensureRequestMethod(req, "POST")) {
    respondWith(res, 405);
    return;
  }

  let fields = await parseFormFields(req);

  if (!chatId || !fields.userId) {
    respondWith(res, 400);
    return;
  }

  let chat = findChatById(chatId);

  if (!chat) {
    respondWith(res, 404);
    return;
  }

  let chatUser = findChatUserById(chat, fields.userId);

  if (!chatUser) {
    respondWith(res, 404);
    return;
  }

  respondWith(res, 204);

  /** Emit to every websocket in the chat room that a user has started typing. */
  io.to(chatId).emit("userStartedTyping", chatUser);
};

/**
 * Serve the requested path as a static file.
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 */
exports.staticFile = function(req, res) {
  serveFile(res, path.join(`${__dirname}/public`, req.url));
};

/**
 * Serve the index.html static file.
 * @param {Request} req The HTTP request.
 * @param {Response} res The HTTP response.
 */
exports.index = function(req, res) {
  res.setHeader("ContentType", "text/html");

  serveFile(res, path.join(`${__dirname}/public`, "index.html"));
};

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
exports.connectSocket = function(socket) {
  let chatId = socket.handshake.query.chatId,
    userId = socket.handshake.query.userId,
    now = new Date().getTime();

  io = this;

  let chat = findChatById(chatId);
  if (!chat) {
    return;
  }

  let user = findUserById(userId);
  if (!user) {
    return;
  }

  let chatUser = findChatUserById(chat, user.id);
  if (chatUser) {
    chatUser.joinedAt = now;
  } else {
    chat.users.push(user);

    chat.users.sort(sortByName);
  }

  /** Add the websocket to the room of the chat. */
  socket.join(chatId);

  /** Emit to every websocket in the chat room, that the user has been connected. */
  io.to(chatId).emit("userConnected", user);

  /** Listen to the websocket disconnect event. */
  socket.on("disconnect", function() {
    /** Remove the user from the list of users of the chat. */
    let userIndex = chat.users.findIndex(el => el.id === user.id);
    if (userIndex > -1) {
      chat.users.splice(userIndex, 1);
    }

    /** Emit to every websocket in the chat room, that the user has been disconnected. */
    io.to(chatId).emit("userDisconnected", user);
  });
};
