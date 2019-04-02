/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "Job" }] */

/** Class representing a job of a web worker instance of a thread. */
class Job {
  /**
   * @param {String} op The operation name.
   * @param {Function} callback The function to be called when done.
   */
  constructor(op, callback) {
    this.op = op;
    this.callback = callback;
  }
}
