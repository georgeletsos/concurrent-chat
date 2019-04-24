/* global importScripts, App, TypingUser, ThreadWorker, io */

/**
 * Create the app state manager, the worker thread
 * and register jobs below.
 */
importScripts("./App.js", "./TypingUser.js", "./ThreadWorker.js", "./Job.js");
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
   * Informs the main thread that a user has just been connected, along with who that user
   * and the next user are.
   */
  socket.on("userConnected", function(user) {
    app.addUser(user);

    app.sortUsers(App.sortByNameAndTag);

    let nextUser = app.findNextUser(user.id);

    postMessage({
      event: "userConnected",
      user: user,
      nextUser: nextUser
    });
  });

  /**
   * Called when a user has been disconnected.
   * Removes the user from the memory.
   * Informs the main thread that a user has just been disconnected, along with who that user is.
   */
  socket.on("userDisconnected", function(user) {
    app.removeUserById(user.id);

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
   * If that user isn't the current one, adds the user to the list of users currently typing
   * along with that user timeout (that's going to remove that user from the list after some time).
   * Informs the main thread that a user has started typing, along with the updated list of users currently typing.
   */
  socket.on("userStartedTyping", function(user) {
    if (app.currentUser.id === user.id) {
      return;
    }

    let typingUser = new TypingUser(
      user,
      setTimeout(() => {
        app.removeTypingUserById(user.id);

        postMessage({
          event: "userTyping",
          typingUsers: app.getTypingUsers()
        });
      }, 10e3)
    );

    app.addTypingUser(typingUser);

    postMessage({
      event: "userTyping",
      typingUsers: app.getTypingUsers()
    });
  });

  /**
   * Called when a user has stopped typing.
   * If that user isn't the current one, removes the user from the list of typing users in memory.
   * Also clears the user timeout (that was going to remove the user from the list after some time).
   * Informs the main thread that a user has stopped typing, along with the updated list of users currently typing.
   */
  socket.on("userStoppedTyping", function(user) {
    if (app.currentUser.id === user.id) {
      return;
    }

    let removedTypingUser = app.removeTypingUserById(user.id);

    if (removedTypingUser) {
      clearTimeout(removedTypingUser.timeout);
    }

    postMessage({
      event: "userTyping",
      typingUsers: app.getTypingUsers()
    });
  });
});
