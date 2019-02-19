"use strict";

/* global importScripts io */

/** List of chats in memory. */
let chats;

/** List of users of the current chat in memory. */
let chatUsers;

/**
 * List of users currently typing in memory.
 * @property {Object[]} typingUser
 * @property {Object} typingUser.user The user currently typing.
 * @property {timeout} typingUser.timeout The user timeout that's going to remove the user from the list.
 */
let typingUsers = [];

/**
 * Find a specific chat in memory.
 * @param {string} chatId The id of the specific chat.
 * @returns {Object} The specific chat.
 */
function findChatById(chatId) {
  return chats.find(chat => chat.id === chatId);
}

/**
 * Find the index of a specific user in memory.
 * @param {string} userId The id of the specific user.
 * @returns {number} The index of the specific user.
 */
function findChatUserIndexById(userId) {
  return chatUsers.findIndex(el => el.id === userId);
}

/**
 * Find the index of a specific user currently typing in memory.
 * @param {string} userId The id of the specific user.
 * @returns {number} The index of the specific user.
 */
function findTypingUserIndexById(userId) {
  return typingUsers.findIndex(el => el.user.id === userId);
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
 * Send HTTP requests to the API.
 * @param {string} method The HTTP method.
 * @param {string} path The request path.
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
     * If there's no optional request payload `data`, we can simply send the request.
     * Otherwise, we have to create a new FormData instance to properly encode the form data for the request.
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
 * @param {string} [username=""] The username of the new user.
 * @returns {Promise} A promise that is resolved with the new user, or rejected with validation message(s).
 */
function registerUser(username = "") {
  return api("post", `/api/auth/register`, {
    username: username
  });
}

/**
 * Login a user, using the api function.
 * @param {string} [userId=""] The id of the user.
 * @returns {Promise} A promise that is resolved or rejected with no payload.
 */
function loginUser(userId = "") {
  return api("post", `/api/auth/login`, {
    userId: userId
  });
}

/**
 * Get the list of chats, using the api function.
 * @returns {Promise} A promise that is resolved with the list of Chats.
 */
function getChats() {
  return api("get", `/api/chats`);
}

/**
 * Create a new chat with a specific user as the owner, using the api function.
 * @param {string} [userId=""] The id of the specific user.
 * @param {string} [chatName=""] The name of the chat.
 * @returns {Promise} A promise that is resolved with the new chat.
 */
function createChat(userId = "", chatName = "") {
  return api("post", `/api/chats/create`, {
    userId: userId,
    chatName: chatName
  });
}

/**
 * Get the list of users for a specific chat, using the api function.
 * @param {string} [chatId=""] The id of the specific chat.
 * @returns {Promise} A promise that is resolved with the list of users.
 */
function getChatUsers(chatId = "") {
  return api("get", `/api/chats/${chatId}/users`);
}

/**
 * Get the list of messages for a specific chat, using the api function.
 * @param {string} [chatId=""] The id of the specific chat.
 * @returns {Promise} A promise that is resolved with the list of messages.
 */
function getChatMessages(chatId = "") {
  return api("get", `/api/chats/${chatId}/messages`);
}

/**
 * Post a message of a specific user in a specific chat, using the api function.
 * @param {string} [chatId=""] The id of the specific chat.
 * @param {string} [userId=""] The id of the specific user.
 * @param {string} [messageContent=""] The message content.
 * @returns {Promise} A promise that is resolved with the message.
 */
function postChatMessage(chatId = "", userId = "", messageContent = "") {
  return api("post", `/api/chats/${chatId}/message`, {
    userId: userId,
    messageContent: messageContent
  });
}

/**
 * Send a signal that a specific user has started typing in a specific chat, using the api function.
 * @param {string} [chatId=""] The id of the specific chat.
 * @param {string} [userId=""] The id of the specific user.
 * @returns {Promise} A promise that is resolved or rejected with no payload.
 */
function typing(chatId = "", userId = "") {
  return api("post", `/api/chats/${chatId}/typing`, {
    userId: userId
  });
}

/**
 * Open a websocket connection between the user and the chat.
 * Also set any websocket event listeners.
 * @param {string} chatId The id of the chat.
 * @param {string} userId The id of the user.
 */
function connectWebsocket(chatId, userId) {
  /** Load the Socket.io script into the worker. */
  importScripts(
    "https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.2.0/socket.io.js"
  );

  /** Send along the id of the chat and the id of the user. */
  let socket = io({ query: { chatId: chatId, userId: userId } });

  /**
   * Upon connection, find the chat from the list of chats in memory
   * and let the main thread know that the connection was successful,
   * along with the name of the chat.
   */
  socket.on("connect", function() {
    let currentChat = findChatById(chatId);

    if (!currentChat) {
      return;
    }

    postMessage({
      socketEvent: "connect",
      chatName: currentChat.name
    });
  });

  /**
   * When a user connects, add the user to the list of users in memory
   * and sort the list alphabetically.
   * Then find the index of the user in memory to help find the next User in line.
   * Let the main thread know a user has just been connected, along with who that user
   * and the next user are.
   */
  socket.on("userConnected", function(user) {
    chatUsers.push(user);

    chatUsers.sort(sortByName);

    let userIndex = findChatUserIndexById(user.id),
      nextUser;
    if (userIndex > -1) {
      nextUser = chatUsers[userIndex + 1];
    }

    postMessage({
      socketEvent: "userConnected",
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
      socketEvent: "userDisconnected",
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
      socketEvent: "chatCreated",
      chat: chat
    });
  });

  /**
   * When a message is received, let the main thread know that a message has just been received,
   * along with what that message is.
   */
  socket.on("chatMessage", function(message) {
    postMessage({
      socketEvent: "chatMessage",
      message: message
    });
  });

  /**
   * When a user has started typing, if that user isn't the current one,
   * add the user to the list of users currently typing, along with the user timeout (that's going to remove the user from the list).
   * Let the main thread know a user has started typing, along with the list of users currently typing.
   */
  socket.on("userStartedTyping", function(user) {
    /** Check if current user is the one who's typing. */
    if (userId === user.id) {
      return;
    }

    /**
     * @property {Object} user The user currently typing.
     * @property {timeout} timeout The user timeout that's going to remove the user from the list.
     */
    let typingUser = {
      user: user,
      timeout: setTimeout(() => {
        let typingUserIndex = findTypingUserIndexById(user.id);

        if (typingUserIndex > -1) {
          typingUsers.splice(typingUserIndex, 1);

          postMessage({
            socketEvent: "userTyping",
            typingUsers: typingUsers.map(el => el.user)
          });
        }
      }, 10e3)
    };

    typingUsers.push(typingUser);

    postMessage({
      socketEvent: "userTyping",
      typingUsers: typingUsers.map(el => el.user)
    });
  });

  /**
   * When a user has stopped typing, find the index of the user in memory and remove the user from the memory.
   * Also clear the user timeout (that was going to remove the user from the list).
   * Let the main thread know a user has stopped typing, along with the list of users currently typing.
   */
  socket.on("userStoppedTyping", function(user) {
    let typingUserIndex = findTypingUserIndexById(user.id);

    if (typingUserIndex > -1) {
      let removedTypingUser = typingUsers.splice(typingUserIndex, 1)[0];

      clearTimeout(removedTypingUser.timeout);

      postMessage({
        socketEvent: "userTyping",
        typingUsers: typingUsers.map(el => el.user)
      });
    }
  });
}

/** Listen for messages coming from the main thread. */
addEventListener("message", e => {
  /**
   * The generic promise resolver function.
   * Its job is to post data back to the main thread using postMessage().
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
   * Its job is to post data back to the main thread using postMessage().
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
   * The above resolve() and reject() functions are passed to each returned promise.
   */
  switch (e.data.action) {
    case "connectWebsocket":
      connectWebsocket(e.data.chatId, e.data.userId);
      break;
    case "registerUser":
      registerUser(e.data.username).then(resolve, reject);
      break;
    case "loginUser":
      loginUser(e.data.userId).then(resolve, reject);
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
    case "typing":
      typing(e.data.chatId, e.data.userId).then(resolve, reject);
      break;
  }
});
