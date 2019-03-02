/* global importScripts, io */

/** Class representing a web worker instance of a thread. */
class ThreadWorker {
  constructor() {
    this.jobs = [];

    /** List of chats in memory. */
    this.chats = [];

    /** List of users of the current chat in memory. */
    this.chatUsers = [];

    /**
     * List of users currently typing in memory.
     * @property {Object[]} typingUserWithTimeout
     * @property {Object} typingUserWithTimeout.user The user currently typing.
     * @property {Timeout} typingUserWithTimeout.timeout The user timeout that's going to remove the user from the list.
     */
    this.typingUsersWithTimeout = [];

    this.onMessage = this.onMessage.bind(this);
    addEventListener("message", this.onMessage);
  }

  /**
   * Called when the main thread passes a job to this worker.
   * Puts the worker to work.
   * @param {Event} e
   */
  onMessage(e) {
    let message = e.data;
    let op = message.op;
    this.work(op, message);
  }

  /**
   * Completes an operation.
   * First finds the registered job that matches the operation.
   * @param {String} op The operation's name.
   * @param {Object} message The main thread's payload.
   */
  work(op, message) {
    let id = message.id;
    let job = this.jobs.find(job => job.op === op);

    let result;
    try {
      result = job.callback(message);
    } catch (err) {
      console.error("worker error", err);
      return postMessage({ id, error: err.message });
    }

    Promise.resolve(result)
      .then(data =>
        postMessage({
          id,
          data
        })
      )
      .catch(error => postMessage({ id, error }));
  }

  /**
   * Registers a job with an operation name.
   * @param {String} op The operation's name.
   * @param {Function} callback The function to be called when done.
   */
  registerJob(op, callback) {
    this.jobs.push({ op, callback });
  }

  /**
   * Send HTTP requests to the API.
   * @param {String} method The HTTP method.
   * @param {String} path The request path.
   * @param {Object} data Optional request payload.
   * @returns {Promise}
   */
  static api(method, path, data) {
    return new Promise((resolve, reject) => {
      let request = new XMLHttpRequest();

      /** Resolve the promise with the JSON, if there is one. */
      request.addEventListener("load", e => {
        try {
          let response = JSON.parse(e.target.responseText);
          resolve(response);
        } catch (error) {
          resolve();
        }
      });

      /** Reject the promise on error. */
      request.addEventListener("error", e => {
        console.error(
          "worker XHR onerror",
          e,
          e.target.statusText || "unknown api error"
        );
        reject(e.target.statusText || "unknown api error");
      });

      /** Reject the promise on abort. */
      request.addEventListener("abort", e => {
        console.error(
          "worker XHR onabort",
          e,
          e.target.statusText || "unknown error"
        );
        reject(e.target.statusText || "unknown api error");
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
   * Find a specific chat in a list of chats.
   * @param {Object[]} chats The list of chats.
   * @param {String} chatId The id of the specific chat.
   * @returns {Object} The specific chat.
   */
  static findChatById(chats, chatId) {
    return chats.find(chat => chat.id === chatId);
  }

  /**
   * Find the index of a specific user in a list of chat users.
   * @param {Object[]} chatUsers The list of chat users.
   * @param {String} userId The id of the specific user.
   * @returns {Number} The index of the specific user.
   */
  static findChatUserIndexById(chatUsers, userId) {
    return chatUsers.findIndex(el => el.id === userId);
  }

  /**
   * Find the index of a specific user currently typing in a list of typing users with their timeouts.
   * @param {Object[]} typingUsersWithTimeout The list of typing users with their timeouts.
   * @param {String} userId The id of the specific user.
   * @returns {Number} The index of the specific user.
   */
  static findTypingUserIndexById(typingUsersWithTimeout, userId) {
    return typingUsersWithTimeout.findIndex(el => el.user.id === userId);
  }

  /**
   * Extract only the typing users from a list of typing users with their timeouts.
   * @param {Object[]} typingUsersWithTimeout The list of typing users with their timeouts.
   * @returns {Object[]} A list of typing users.
   */
  static getTypingUsers(typingUsersWithTimeout) {
    return typingUsersWithTimeout.map(el => el.user);
  }

  /**
   * Alphabetically sorting algorithm for an object that has a `name` and a `tag` property.
   * If the name is the same then it sorts by the `tag` property instead.
   * @param {Object} a
   * @param {String} a.name
   * @param {Number} a.tag
   * @param {Object} b
   * @param {String} b.name
   * @param {Number} b.tag
   */
  static sortByNameAndTag(a, b) {
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
}

/**
 * Create the worker thread and register jobs below.
 */
const threadWorker = new ThreadWorker();

/**
 * Attempt to register a new user.
 * @param {Object} message
 * @param {String} message.username
 * @returns {Promise<Object>} A promise that is resolved with the new user, or with validation message(s).
 */
threadWorker.registerJob("registerUser", message => {
  let username = message.username;
  return ThreadWorker.api("post", "/api/auth/register", {
    username: username
  });
});

/**
 * Attempt to log in a user.
 * @param {Object} message
 * @param {String} message.userId
 * @returns {Promise}
 */
threadWorker.registerJob("logInUser", message => {
  let userId = message.userId;
  return ThreadWorker.api("post", "/api/auth/login", {
    userId: userId
  });
});

/**
 * Get the list of chats.
 * Store the response chats in memory before continuing.
 * @returns {Promise<Object[]>} A promise that is resolved with the list of chats.
 */
threadWorker.registerJob("getChats", () => {
  return ThreadWorker.api("get", "/api/chats").then(chats => {
    threadWorker.chats = chats;
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
  return ThreadWorker.api("post", "/api/chats/create", {
    userId: userId,
    chatName: chatName
  });
});

/**
 * Get the list of users of a specific chat.
 * Store the response chat users in memory before continuing.
 * @param {Object} message
 * @param {String} message.chatId
 * @returns {Promise<Object[]>} A promise that is resolved with the list of users.
 */
threadWorker.registerJob("getChatUsers", message => {
  let chatId = message.chatId;
  return ThreadWorker.api("get", `/api/chats/${chatId}/users`).then(
    chatUsers => {
      threadWorker.chatUsers = chatUsers;
      return chatUsers;
    }
  );
});

/**
 * Get the list of messages of a specific chat.
 * @param {String} message.chatId
 * @returns {Promise<Object[]>} A promise that is resolved with the list of messages.
 */
threadWorker.registerJob("getChatMessages", message => {
  let chatId = message.chatId;
  return ThreadWorker.api("get", `/api/chats/${chatId}/messages`);
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
  return ThreadWorker.api("post", `/api/chats/${chatId}/message`, {
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
  return ThreadWorker.api("post", `/api/chats/${chatId}/typing`, {
    userId: userId
  });
});

/**
 * Check if a given chat exists in the list of chats.
 * @param {Object} message
 * @param {String} message.chatId
 */
threadWorker.registerJob("chatExists?", message => {
  let chatId = message.chatId;
  let chat = ThreadWorker.findChatById(threadWorker.chats, chatId);
  return !!chat;
});

/**
 * Open a websocket connection between the user and the chat,
 * and set any websocket event listeners.
 * @param {Object} message
 * @param {String} chatId
 * @param {String} userId
 */
threadWorker.registerJob("connectSocket", message => {
  /** Load the Socket.io script into the worker. */
  importScripts(
    "https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.2.0/socket.io.js"
  );

  let chatId = message.chatId;
  let userId = message.userId;

  /** Send along the id of the chat and the id of the user. */
  let socket = io({ query: { chatId: chatId, userId: userId } });

  let chats = threadWorker.chats;
  let chatUsers = threadWorker.chatUsers;
  let typingUsersWithTimeout = threadWorker.typingUsersWithTimeout;

  /**
   * Called upon successful connection.
   * Finds the chat in the list of chats in memory
   * and informs the main thread that the connection was successful,
   * along with the name of the chat.
   */
  socket.on("connect", function() {
    let currentChat = ThreadWorker.findChatById(chats, chatId);

    if (!currentChat) {
      return;
    }

    postMessage({
      event: "socketConnected",
      chatName: currentChat.name
    });
  });

  /**
   * Called when a user has been connected to the chat.
   * If the user isn't already in the list of chat users in memory (in case of multiple tabs),
   * then adds the user to the list of users in memory and sorts the list alphabetically, followed by tag.
   * Afterwards finds the index of the user in memory and proceeds to find the next user in line.
   * Informs the main thread that a user has just been connected, along with who that user
   * and the next user are.
   */
  socket.on("userConnected", function(user) {
    if (ThreadWorker.findChatUserIndexById(chatUsers, user.id) > -1) {
      return;
    }

    chatUsers.push(user);

    chatUsers.sort(ThreadWorker.sortByNameAndTag);

    let userIndex = ThreadWorker.findChatUserIndexById(chatUsers, user.id),
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
   * Called when a user has been disconnected.
   * Find the index of the user in memory and removes the user from the memory.
   * Informs the main thread that a user has just been disconnected, along with who that user is.
   */
  socket.on("userDisconnected", function(user) {
    let userIndex = ThreadWorker.findChatUserIndexById(chatUsers, user.id);

    if (userIndex > -1) {
      chatUsers.splice(userIndex, 1);
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
    chats.push(chat);

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
   * and if that user isn't already in the list of users currently typing (in case of multiple tabs),
   * adds the user to the list of users currently typing,
   * along with that user timeout (that's going to remove that user from the list after some time).
   * Informs the main thread that a user has started typing, along with the list of users currently typing.
   */
  socket.on("userStartedTyping", function(user) {
    if (userId === user.id) {
      return;
    }

    if (
      ThreadWorker.findTypingUserIndexById(typingUsersWithTimeout, user.id) > -1
    ) {
      return;
    }

    /**
     * @property {Object} user The user currently typing.
     * @property {Timeout} timeout The user timeout that's going to remove the user from the list after some time.
     */
    let typingUserWithTimeout = {
      user: user,
      timeout: setTimeout(() => {
        let typingUserIndex = ThreadWorker.findTypingUserIndexById(
          typingUsersWithTimeout,
          user.id
        );
        if (typingUserIndex === -1) {
          return;
        }

        typingUsersWithTimeout.splice(typingUserIndex, 1);

        postMessage({
          event: "userTyping",
          typingUsers: ThreadWorker.getTypingUsers(typingUsersWithTimeout)
        });
      }, 10e3)
    };

    typingUsersWithTimeout.push(typingUserWithTimeout);

    postMessage({
      event: "userTyping",
      typingUsers: ThreadWorker.getTypingUsers(typingUsersWithTimeout)
    });
  });

  /**
   * Called when a user has stopped typing.
   * Finds the index of the user in memory and removes the user from the memory.
   * Also clears the user timeout (that was going to remove the user from the list after some time).
   * Informs the main thread that a user has stopped typing, along with the list of users currently typing.
   */
  socket.on("userStoppedTyping", function(user) {
    let typingUserIndex = ThreadWorker.findTypingUserIndexById(
      typingUsersWithTimeout,
      user.id
    );
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
      typingUsers: ThreadWorker.getTypingUsers(typingUsersWithTimeout)
    });
  });
});
