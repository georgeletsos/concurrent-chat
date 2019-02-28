/* global importScripts io */

/** List of chats in memory. */
let chats;

/** List of users of the current chat in memory. */
let chatUsers;

/**
 * List of users currently typing in memory.
 * @property {Object[]} typingUserWithTimeout
 * @property {Object} typingUserWithTimeout.user The user currently typing.
 * @property {Timeout} typingUserWithTimeout.timeout The user timeout that's going to remove the user from the list.
 */
let typingUsersWithTimeout = [];

/**
 * Find a specific chat in memory.
 * @param {String} chatId The id of the specific chat.
 * @returns {Object} The specific chat.
 */
function findChatById(chatId) {
  return chats.find(chat => chat.id === chatId);
}

/**
 * Find the index of a specific user in memory.
 * @param {String} userId The id of the specific user.
 * @returns {Number} The index of the specific user.
 */
function findChatUserIndexById(userId) {
  return chatUsers.findIndex(el => el.id === userId);
}

/**
 * Find the index of a specific user currently typing in memory.
 * @param {String} userId The id of the specific user.
 * @returns {Number} The index of the specific user.
 */
function findTypingUserIndexById(userId) {
  return typingUsersWithTimeout.findIndex(el => el.user.id === userId);
}

/**
 * Extract the typing users from the `typingUsersWithTimeout` array.
 * @returns {Object[]} An array of users currently typing.
 */
function getTypingUsers() {
  return typingUsersWithTimeout.map(el => el.user);
}

/**
 * Alphabetically sorting algorithm for an object that has a `name`.
 * If the name is the same then it sorts by the `tag` property instead.
 * @param {Object} a
 * @param {String} a.name
 * @param {Number} a.tag
 * @param {Object} b
 * @param {String} b.name
 * @param {Number} b.tag
 */
function sortByNameAndTag(a, b) {
  let aName = a.name.toLowerCase();
  let aTag = a.tag;
  let bName = b.name.toLowerCase();
  let bTag = b.tag;

  if (aName < bName) {
    return -1;
  }

  if (aName > bName) {
    return 1;
  }

  if (aTag < bTag) {
    return -1;
  }

  if (aTag > bTag) {
    return 1;
  }

  return 0;
}

/**
 * Send HTTP requests to the API.
 * @param {String} method The HTTP method.
 * @param {String} path The request path.
 * @param {Object} data Optional request payload.
 * @returns {Promise} A promise that is resolved or rejected depending on the HTTP status code of the response.
 */
function api(method, path, data) {
  return new Promise((resolve, reject) => {
    let request = new XMLHttpRequest();

    /**
     * Resolve when status code is 200.
     * Reject when status code is 400, 404 or 405.
     * Payload is the parsed JSON.
     */
    request.addEventListener("load", e => {
      console.log("XHR onload", e);

      let responseStatus = e.target.status,
        responseStatusText = e.target.statusText,
        responseText = e.target.responseText,
        response = responseText ? JSON.parse(responseText) : null,
        responseStatuses = [400, 404, 405];
      console.log("XHR onload response", response);

      if (responseStatuses.indexOf(responseStatus) > -1) {
        console.error("XHR onload responseText", responseStatusText);

        if (response) {
          reject(response);
        } else {
          reject();
        }
      }

      if (responseStatus === 200) {
        if (response) {
          resolve(response);
        } else {
          resolve();
        }
      }
    });

    request.addEventListener("error", e => {
      console.error("XHR onerror", e, e.target.statusText || "unknown error");
    });

    request.addEventListener("abort", e => {
      console.error("XHR onabort", e, e.target.statusText || "unknown error");
    });

    request.open(method, path);

    /**
     * If there's no optional request payload `data`, simply send the request.
     * Otherwise, create a new FormData instance to properly encode the form data for the request.
     */
    if (Object.is(data, undefined)) {
      request.send();
    } else {
      let form = new FormData();

      Object.keys(data).forEach(key => {
        form.append(key, data[key]);
      });

      request.send(form);
    }
  });
}

/**
 * Register a new user, using the api function.
 * @param {String} [username=""] The username of the new user.
 * @returns {Promise<Object>} A promise that is resolved with the new user, or rejected with validation message(s).
 */
function registerUser(username = "") {
  return api("post", `/api/auth/register`, {
    username: username
  });
}

/**
 * Log in a user, using the api function.
 * @param {String} [userId=""] The id of the user.
 * @returns {Promise} A promise that is resolved or rejected with no payload.
 */
function logInUser(userId = "") {
  return api("post", `/api/auth/login`, {
    userId: userId
  });
}

/**
 * Get the list of chats, using the api function.
 * @returns {Promise<Object[]>} A promise that is resolved with the list of chats.
 */
function getChats() {
  return api("get", `/api/chats`);
}

/**
 * Create a new chat with a unique name, using the api function.
 * @param {String} [userId=""] The id of the specific user.
 * @param {String} [chatName=""] The name of the chat.
 * @returns {Promise<Object>} A promise that is resolved with the new chat or rejected with validation message(s).
 */
function createChat(userId = "", chatName = "") {
  return api("post", `/api/chats/create`, {
    userId: userId,
    chatName: chatName
  });
}

/**
 * Get the list of users for a specific chat, using the api function.
 * @param {String} [chatId=""] The id of the specific chat.
 * @returns {Promise<Object[]>} A promise that is resolved with the list of users.
 */
function getChatUsers(chatId = "") {
  return api("get", `/api/chats/${chatId}/users`);
}

/**
 * Get the list of messages for a specific chat, using the api function.
 * @param {String} [chatId=""] The id of the specific chat.
 * @returns {Promise<Object[]>} A promise that is resolved with the list of messages.
 */
function getChatMessages(chatId = "") {
  return api("get", `/api/chats/${chatId}/messages`);
}

/**
 * Post a message of a specific user in a specific chat, using the api function.
 * @param {String} [chatId=""] The id of the specific chat.
 * @param {String} [userId=""] The id of the specific user.
 * @param {String} [messageContent=""] The message content.
 * @returns {Promise<Object>} A promise that is resolved with the message.
 */
function postChatMessage(chatId = "", userId = "", messageContent = "") {
  return api("post", `/api/chats/${chatId}/message`, {
    userId: userId,
    messageContent: messageContent
  });
}

/**
 * Send a signal that a specific user has started typing in a specific chat, using the api function.
 * @param {String} [chatId=""] The id of the specific chat.
 * @param {String} [userId=""] The id of the specific user.
 * @returns {Promise} A promise that is resolved or rejected with no payload.
 */
function userTyping(chatId = "", userId = "") {
  return api("post", `/api/chats/${chatId}/typing`, {
    userId: userId
  });
}

/**
 * Checks if a chat id exists in the list of chats.
 * @param {String} chatId
 */
function checkIfChatExists(chatId) {
  let chat = findChatById(chatId);
  return Promise.resolve(chat ? true : false);
}

/**
 * Open a websocket connection between the user and the chat.
 * Also set any websocket event listeners.
 * @param {String} chatId The id of the chat.
 * @param {String} userId The id of the user.
 */
function connectSocket(chatId, userId) {
  /** Load the Socket.io script into the worker. */
  importScripts(
    "https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.2.0/socket.io.js"
  );

  /** Send along the id of the chat and the id of the user. */
  let socket = io({ query: { chatId: chatId, userId: userId } });

  /**
   * Upon connection, find the chat in the list of chats in memory
   * and let the main thread know that the connection was successful,
   * along with the name of the chat.
   */
  socket.on("connect", function() {
    let currentChat = findChatById(chatId);

    if (!currentChat) {
      return;
    }

    postMessage({
      event: "socketConnected",
      chatName: currentChat.name
    });
  });

  /**
   * When a user connects, if the user isn't already in the list of users in memory (in case of multiple tabs),
   * then add the user to the list of users in memory and sort the list alphabetically, followed by tag.
   * After that find the index of the user in memory to help find the next user in line.
   * Let the main thread know a user has just been connected, along with who that user
   * and the next user are.
   */
  socket.on("userConnected", function(user) {
    /** Check if the user is already in the list of users in memory (in case of multiple tabs). */
    if (findChatUserIndexById(user.id) > -1) {
      return;
    }

    chatUsers.push(user);

    chatUsers.sort(sortByNameAndTag);

    let userIndex = findChatUserIndexById(user.id),
      nextUser;
    if (userIndex > -1) {
      nextUser = chatUsers[userIndex + 1];
    }

    postMessage({
      event: "userConnected",
      user: user,
      nextUser: nextUser
    });
  });

  /**
   * When a user disconnects, find the index of the user in memory and remove the user from the memory.
   * Let the main thread know a user has just been disconnected, along with who that user is.
   */
  socket.on("userDisconnected", function(user) {
    let userIndex = findChatUserIndexById(user.id);

    if (userIndex > -1) {
      chatUsers.splice(userIndex, 1);
    }

    postMessage({
      event: "userDisconnected",
      user: user
    });
  });

  /**
   * When a new chat has been created, add the new chat to the list of chats in memory
   * and let the main thread know that a new chat has just been created,
   * along with the new chat.
   */
  socket.on("chatCreated", function(chat) {
    chats.push(chat);

    postMessage({
      event: "chatCreated",
      chat: chat
    });
  });

  /**
   * When a message is received, let the main thread know that a message has just been received,
   * along with what that message is.
   */
  socket.on("chatMessage", function(message) {
    postMessage({
      event: "messagePosted",
      message: message
    });
  });

  /**
   * When a user has started typing, if that user isn't the current one,
   * and if that user isn't already in the list of users currently typing (in case of multiple tabs),
   * add the user to the list of users currently typing,
   * along with the user timeout (that's going to remove the user from the list after some time).
   * Let the main thread know a user has started typing, along with the list of users currently typing.
   */
  socket.on("userStartedTyping", function(user) {
    /** Check if current user is the one who's typing. */
    if (userId === user.id) {
      return;
    }

    /** Check if the user is already in the list of users currently typing (in case of multiple tabs). */
    if (findTypingUserIndexById(user.id) > -1) {
      return;
    }

    /**
     * @property {Object} user The user currently typing.
     * @property {Timeout} timeout The user timeout that's going to remove the user from the list after some time.
     */
    let typingUserWithTimeout = {
      user: user,
      timeout: setTimeout(() => {
        let typingUserIndex = findTypingUserIndexById(user.id);
        if (typingUserIndex === -1) {
          return;
        }

        typingUsersWithTimeout.splice(typingUserIndex, 1);

        postMessage({
          event: "userTyping",
          typingUsers: getTypingUsers()
        });
      }, 10e3)
    };

    typingUsersWithTimeout.push(typingUserWithTimeout);

    postMessage({
      event: "userTyping",
      typingUsers: getTypingUsers()
    });
  });

  /**
   * When a user has stopped typing, find the index of the user in memory and remove the user from memory.
   * Also clear the user timeout (that was going to remove the user from the list after some time).
   * Let the main thread know a user has stopped typing, along with the list of users currently typing.
   */
  socket.on("userStoppedTyping", function(user) {
    let typingUserIndex = findTypingUserIndexById(user.id);
    if (typingUserIndex === -1) {
      return;
    }

    let removedTypingUserWithTimeout = typingUsersWithTimeout.splice(
      typingUserIndex,
      1
    )[0];

    clearTimeout(removedTypingUserWithTimeout.timeout);

    postMessage({
      event: "userTyping",
      typingUsers: getTypingUsers()
    });
  });
}

/** Listen for messages coming from the main thread. */
addEventListener("message", e => {
  /**
   * The generic promise resolver function.
   * Its job is to post data back to the main thread using `postMessage()`.
   * Also returns the `data` payload so that it may be used further down
   * in the promise resolution chain.
   * @param {*} data Payload.
   * @returns {*} The `data` payload.
   */
  function resolve(data) {
    postMessage({
      msgId: e.data.msgId,
      data: data
    });

    return data;
  }

  /**
   * The generic promise rejector function.
   * Its job is to post data back to the main thread using `postMessage()`.
   * Also returns the `error` payload so that it may be used further down
   * in the promise rejection chain.
   * @param {*} error Payload.
   * @returns {*} The `error` payload.
   */
  function reject(error) {
    postMessage({
      msgId: e.data.msgId,
      error: error
    });

    return error;
  }

  /**
   * This switch decides which function to call based on the action property of the message.
   * The above `resolve()` and `reject()` functions are passed to each returned promise.
   */
  switch (e.data.action) {
    case "connectSocket":
      connectSocket(e.data.chatId, e.data.userId);
      break;
    case "registerUser":
      registerUser(e.data.username).then(resolve, reject);
      break;
    case "logInUser":
      logInUser(e.data.userId).then(resolve, reject);
      break;
    case "getChats":
      getChats()
        /** Store the response chats in memory before continuing. */
        .then(currentChats => {
          chats = currentChats;

          return currentChats;
        })
        .then(resolve, reject);
      break;
    case "checkIfChatExists":
      checkIfChatExists(e.data.chatId).then(resolve, reject);
      break;
    case "createChat":
      createChat(e.data.userId, e.data.chatName).then(resolve, reject);
      break;
    case "getChatUsers":
      getChatUsers(e.data.chatId)
        /** Store the response users in memory before continuing. */
        .then(currentChatUsers => {
          chatUsers = currentChatUsers;

          return currentChatUsers;
        })
        .then(resolve, reject);
      break;
    case "getChatMessages":
      getChatMessages(e.data.chatId).then(resolve, reject);
      break;
    case "postChatMessage":
      postChatMessage(e.data.chatId, e.data.userId, e.data.messageContent).then(
        resolve,
        reject
      );
      break;
    case "userTyping":
      userTyping(e.data.chatId, e.data.userId).then(resolve, reject);
      break;
  }
});
