/**
 * @typedef {Object} Api
 * @property {Chat[]} chats
 * @property {User[]} users
 * @property {Message[]} messages
 * @property {Generator} userTagGenerator
 */

/**
 * @typedef {Object} Chat
 * @property {String} id
 * @property {String} name
 * @property {User} owner
 * @property {User[]} users
 * @property {Message[]} messages
 * @property {number} createdAt
 */

/**
 * @typedef {Object} User
 * @property {String} id
 * @property {number} tag
 * @property {String} name
 * @property {number} createdAt
 */

/**
 * @typedef {Object} Message
 * @property {String} id
 * @property {User} user
 * @property {String} content
 * @property {number} sentAt
 */

/** Core Node modules. */
const crypto = require("crypto");

/** Class representing our Api implementation. */
module.exports = class Api {
  /**
   * @constructor
   */
  constructor() {
    /**
     * List of chats in memory.
     * @type {Chat[]}
     */
    this.chats = [];
    this.chats.push({
      id: this.generateUuid(),
      name: "general-chat",
      owner: "",
      users: [],
      messages: [],
      createdAt: new Date().getTime()
    });
    this.chats.push({
      id: this.generateUuid(),
      name: "test-chat",
      owner: "",
      users: [],
      messages: [],
      createdAt: new Date().getTime()
    });

    /**
     * List of users in memory.
     * @type {User[]}
     */
    this.users = [];

    /**
     * List of messages in memory.
     * @type {Message[]}
     */
    this.messages = [];

    /** The user tag generator. */
    this.userTagGenerator = this.generateId();
  }

  /**
   * Find a specific Chat in memory.
   * @param {string} chatId The specific chat id.
   * @returns {Object} The specific chat.
   */
  findChatById(chatId) {
    return this.chats.find(chat => chat.id === chatId);
  }

  /**
   * Find a specific user of a specific chat in memory.
   * @param {Object} chat The specific chat.
   * @param {string} userId The specific user id.
   * @returns {Object} The specific user of the specific chat.
   */
  findChatUserById(chat, userId) {
    return chat.users.find(user => user.id === userId);
  }

  /**
   * Find a specific user in memory.
   * @param {string} userId The specific user id.
   * @returns {Object} The specific user.
   */
  findUserById(userId) {
    return this.users.find(user => user.id === userId);
  }

  /**
   * Generate basic hex id.
   * @returns {string} A basic hex id.
   */
  generateUuid() {
    return crypto.randomBytes(10).toString("hex");
  }

  /**
   * Unique id generator function.
   * @yields {number} A unique id.
   */
  *generateId() {
    let id = 1;

    while (true) {
      yield id++;
    }
  }
};
