/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "TypingUser" }] */

/** Class representing a user who is currently typing. */
class TypingUser {
  /**
   * @param {Object} user A user who is currently typing.
   * @param {Timeout} timeout The user's timeout.
   */
  constructor(user, timeout) {
    this.user = user;
    this.timeout = timeout;
  }
}
