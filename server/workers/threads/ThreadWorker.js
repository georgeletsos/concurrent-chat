const Job = require("./Job");

/** Class representing a web worker instance of a thread. */
module.exports = class ThreadWorker {
  constructor() {
    this.jobs = [];

    this.onMessage = this.onMessage.bind(this);
    process.on("message", this.onMessage);
  }

  /**
   * Called when the main thread passes a job to this worker.
   * Puts the worker to work.
   * @param {Object} message
   */
  onMessage(message) {
    let op = message.op;
    this.work(op, message);
  }

  /**
   * Registers a job with an operation name.
   * @param {String} op The operation name.
   * @param {Function} callback The function to be called when done.
   */
  registerJob(op, callback) {
    this.jobs.push(new Job(op, callback));
  }

  /**
   * Completes an operation.
   * Finds the registered job that matches the operation
   * and completes it.
   * @param {String} op The operation name.
   * @param {Object} message The main thread payload.
   */
  work(op, message) {
    let id = message.id;
    let job = this.jobs.find(job => job.op === op);

    let result;
    try {
      result = job.callback(message);
    } catch (err) {
      console.error("worker error", err);
      return process.send({ id, error: err.message });
    }

    Promise.resolve(result)
      .then(data => process.send({ id, data }))
      .catch(error => process.send({ id, error }));
  }
};
