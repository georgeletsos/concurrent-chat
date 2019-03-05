/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "App" }] */

/** Class representing the application state and exposes an xhr wrapper. */
class App {
  constructor() {
    this.currentUser;
    this.currentChat;
    this.chats = [];
    this.users = [];

    /**
     * List of users currently typing in memory.
     * @property {Object[]} typingUserWithTimeout
     * @property {Object} typingUserWithTimeout.user The user currently typing.
     * @property {Timeout} typingUserWithTimeout.timeout The user timeout that's going to remove the user from the list.
     */
    this.typingUsersWithTimeout = [];
  }

  /**
   * XHR wrapper.
   * Promisifies XHR requests.
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

  /**
   * Adds a user.
   * @param {Object} user
   */
  addUser(user) {
    this.users.push(user);
  }

  /**
   * Removes a user.
   * @param {number} userIndex The index of the user.
   * @returns {Object} The removed user.
   */
  removeUser(userIndex) {
    return this.users.splice(userIndex, 1)[0];
  }

  /**
   * Sorts users array using a compare function.
   * @param {Function} compareFn
   * @returns {Object[]} The sorted users array.
   */
  sortUsers(compareFn) {
    return this.users.sort(compareFn);
  }

  /**
   * Adds a chat.
   * @param {Object} chat
   */
  addChat(chat) {
    this.chats.push(chat);
  }

  /**
   * Adds a user currently typing.
   * @param {Object} typingUser
   */
  addTypingUser(typingUser) {
    this.typingUsersWithTimeout.push(typingUser);
  }

  /**
   * Removes a user currently typing.
   * @param {number} typingUserIndex The index of the typing user.
   * @returns {Object} The removed typing user.
   */
  removeTypingUser(typingUserIndex) {
    return this.typingUsersWithTimeout.splice(typingUserIndex, 1)[0];
  }

  /**
   * Finds a specific chat.
   * @param {String} chatId The id of the specific chat.
   * @returns {Object} The specific chat.
   */
  findChatById(chatId) {
    return this.chats.find(chat => chat.id === chatId);
  }

  /**
   * Finds the index of a specific user.
   * @param {String} userId The id of the specific user.
   * @returns {Number} The index of the specific user.
   */
  findUserIndexById(userId) {
    return this.users.findIndex(el => el.id === userId);
  }

  /**
   * Finds the index of a specific user currently typing.
   * @param {String} userId The id of the specific user.
   * @returns {Number} The index of the specific user.
   */
  findTypingUserIndexById(userId) {
    return this.typingUsersWithTimeout.findIndex(el => el.user.id === userId);
  }

  /**
   * Extracts only the typing users, ignore the timeouts.
   * @returns {Object[]} A list of typing users.
   */
  getTypingUsers() {
    return this.typingUsersWithTimeout.map(el => el.user);
  }
}
