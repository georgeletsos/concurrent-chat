/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "ThreadWorker" }] */

/** Class representing a web worker instance of a thread. */
class ThreadWorker {
  constructor() {
    this.jobs = [];

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
   * @param {String} op The operation name.
   * @param {Function} callback The function to be called when done.
   */
  registerJob(op, callback) {
    this.jobs.push({ op, callback });
  }
}
