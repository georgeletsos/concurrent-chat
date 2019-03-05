/* global importScripts, App, ThreadWorker, io */

/**
 * Create the app state manager, the worker thread
 * and register jobs below.
 */
importScripts("./App.js", "./ThreadWorker.js");
const app = new App();
const threadWorker = new ThreadWorker();

/**
 * Attempt to register a new user.
 * @param {Object} message
 * @param {String} message.username
 * @returns {Promise<Object>} A promise that is resolved with the new user, or with validation message(s).
 */
threadWorker.registerJob("registerUser", message => {
  let username = message.username;
  return App.api("post", "/api/auth/register", {
    username: username
  });
});

/**
 * Attempt to log in a user.
 * If successful, store the user in memory before continuing.
 * @param {Object} message
 * @param {String} message.userId
 * @returns {Promise}
 */
threadWorker.registerJob("logInUser", message => {
  let user = message.user;
  return App.api("post", "/api/auth/login", {
    userId: user.id
  }).then(res => {
    app.currentUser = user;
    return res;
  });
});

/**
 * Get the list of chats.
 * If successful, store the response chats in memory before continuing.
 * @returns {Promise<Object[]>} A promise that is resolved with the list of chats.
 */
threadWorker.registerJob("getChats", () => {
  return App.api("get", "/api/chats").then(chats => {
    app.chats = chats;
    return chats;
  });
});

/**
 * Create a new chat with a unique name.
 * @param {Object} message
 * @param {String} message.userId
 * @param {String} message.chatName
 * @returns {Promise<Object>} A promise that is resolved with the new chat or with validation message(s).
 */
threadWorker.registerJob("createChat", message => {
  let userId = message.userId;
  let chatName = message.chatName;
  return App.api("post", "/api/chats/create", {
    userId: userId,
    chatName: chatName
  });
});

/**
 * Get the list of users of a specific chat.
 * If successful, store the response chat users in memory before continuing.
 * @param {Object} message
 * @param {String} message.chatId
 * @returns {Promise<Object[]>} A promise that is resolved with the list of users.
 */
threadWorker.registerJob("getChatUsers", message => {
  let chatId = message.chatId;
  return App.api("get", `/api/chats/${chatId}/users`).then(chatUsers => {
    app.users = chatUsers;
    return chatUsers;
  });
});

/**
 * Get the list of messages of a specific chat.
 * @param {String} message.chatId
 * @returns {Promise<Object[]>} A promise that is resolved with the list of messages.
 */
threadWorker.registerJob("getChatMessages", message => {
  let chatId = message.chatId;
  return App.api("get", `/api/chats/${chatId}/messages`);
});

/**
 * Post a message of a specific user in a specific chat.
 * @param {Object} message
 * @param {String} message.chatId
 * @param {String} message.userId
 * @param {String} message.messageContent
 * @returns {Promise<Object>} A promise that is resolved with the message.
 */
threadWorker.registerJob("postChatMessage", message => {
  let chatId = message.chatId;
  let userId = message.userId;
  let messageContent = message.messageContent;
  return App.api("post", `/api/chats/${chatId}/message`, {
    userId: userId,
    messageContent: messageContent
  });
});

/**
 * Inform that a specific user has started typing in a specific chat.
 * @param {Object} message
 * @param {String} message.chatId
 * @param {String} message.userId
 * @returns {Promise}
 */
threadWorker.registerJob("userTyping", message => {
  let chatId = message.chatId;
  let userId = message.userId;
  return App.api("post", `/api/chats/${chatId}/typing`, {
    userId: userId
  });
});

/**
 * Check if a given chat exists in the list of chats.
 * If exists, store that as the current chat in memory before continuing.
 * @param {Object} message
 * @param {String} message.chatId
 */
threadWorker.registerJob("chatExists?", message => {
  let chatId = message.chatId;
  let chat = app.findChatById(chatId);
  if (chat) {
    app.currentChat = chat;
  }

  return !!chat;
});

/**
 * Open a websocket connection between the user and the chat of the `App`,
 * also set any websocket event listeners.
 */
threadWorker.registerJob("connectSocket", () => {
  /** Load the Socket.io script into the worker. */
  importScripts(
    "https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.2.0/socket.io.js"
  );

  /** Send along the id of the chat and the id of the user. */
  let socket = io({
    query: { chatId: app.currentChat.id, userId: app.currentUser.id }
  });

  /**
   * Called upon successful connection.
   * Informs the main thread that the connection was successful,
   * along with the name of the chat.
   */
  socket.on("connect", function() {
    postMessage({
      event: "socketConnected",
      chatName: app.currentChat.name
    });
  });

  /**
   * Called when a user has been connected to the chat.
   * Adds the user to the list of users in memory and sorts the list alphabetically, followed by tag.
   * Afterwards finds the index of the user in memory and proceeds to find the next user in line.
   * Informs the main thread that a user has just been connected, along with who that user
   * and the next user are.
   */
  socket.on("userConnected", function(user) {
    app.addUser(user);

    let users = app.sortUsers(App.sortByNameAndTag);

    let userIndex = app.findUserIndexById(user.id);
    let nextUser;
    if (userIndex > -1) {
      nextUser = users[userIndex + 1];
    }

    postMessage({
      event: "userConnected",
      user: user,
      nextUser: nextUser
    });
  });

  /**
   * Called when a user has been disconnected.
   * Finds the index of the user in memory and removes the user from the memory.
   * Informs the main thread that a user has just been disconnected, along with who that user is.
   */
  socket.on("userDisconnected", function(user) {
    let userIndex = app.findUserIndexById(user.id);
    if (userIndex > -1) {
      app.removeUser(userIndex);
    }

    postMessage({
      event: "userDisconnected",
      user: user
    });
  });

  /**
   * Called when a new chat has been created.
   * Adds the new chat to the list of chats in memory
   * and informs the main thread that a new chat has just been created,
   * along with the new chat.
   */
  socket.on("chatCreated", function(chat) {
    app.addChat(chat);

    postMessage({
      event: "chatCreated",
      chat: chat
    });
  });

  /**
   * Called when a message has been posted.
   * Informs the main thread know that a message has just been posted,
   * along with what that message is.
   */
  socket.on("messagePosted", function(message) {
    postMessage({
      event: "messagePosted",
      message: message
    });
  });

  /**
   * Called when a user has started typing.
   * If that user isn't the current one,
   * adds the user to the list of users currently typing,
   * along with that user timeout (that's going to remove that user from the list after some time).
   * Informs the main thread that a user has started typing, along with the list of users currently typing.
   */
  socket.on("userStartedTyping", function(user) {
    if (app.currentUser.id === user.id) {
      return;
    }

    /**
     * @property {Object} user The user currently typing.
     * @property {Timeout} timeout The user timeout that's going to remove the user from the list after some time.
     */
    let typingUserWithTimeout = {
      user: user,
      timeout: setTimeout(() => {
        let typingUserIndex = app.findTypingUserIndexById(user.id);
        if (typingUserIndex === -1) {
          return;
        }

        app.removeTypingUser(typingUserIndex);

        postMessage({
          event: "userTyping",
          typingUsers: app.getTypingUsers()
        });
      }, 10e3)
    };

    app.addTypingUser(typingUserWithTimeout);

    postMessage({
      event: "userTyping",
      typingUsers: app.getTypingUsers()
    });
  });

  /**
   * Called when a user has stopped typing.
   * Finds the index of the user in memory and removes the user from the memory.
   * Also clears the user timeout (that was going to remove the user from the list after some time).
   * Informs the main thread that a user has stopped typing, along with the list of users currently typing.
   */
  socket.on("userStoppedTyping", function(user) {
    let typingUserIndex = app.findTypingUserIndexById(user.id);
    if (typingUserIndex === -1) {
      return;
    }

    let removedTypingUserWithTimeout = app.removeTypingUser(typingUserIndex);

    clearTimeout(removedTypingUserWithTimeout.timeout);

    postMessage({
      event: "userTyping",
      typingUsers: app.getTypingUsers()
    });
  });
});
