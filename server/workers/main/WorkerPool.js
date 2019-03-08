const cp = require("child_process");
const numCPUs = require("os").cpus().length || 1;

/** Class representing a pool of child processes/workers of the main thread. */
module.exports = class WorkerPool {
  /**
   * @param {String} modulePath
   */
  constructor(modulePath) {
    this.workers = [];
    this.callbacks = [];
    this.onMessage = this.onMessage.bind(this);
    this.generateId = this.idGenerator();
    this.getNextWorker = this.workerCircularSequence();

    for (let i = 0; i < numCPUs; i++) {
      this.workers.push(cp.fork(modulePath));
      this.workers[i].on("message", this.onMessage);
    }
  }

  /**
   * Unique id generator function.
   * @yields {Number} A unique id.
   */
  *idGenerator() {
    let id = 0;

    while (true) {
      yield id++;
    }
  }

  /**
   * Infinite circular sequence of workers.
   * @yields {ChildProcess} A child process/worker.
   */
  *workerCircularSequence() {
    while (true) {
      for (let i = 0; i < this.workers.length; i++) {
        yield this.workers[i];
      }
    }
  }

  /**
   * Called when the worker thread passes the result of a completed job
   * back to the main thread.
   * Finds and runs the right callback, based on the message id.
   * @param {Object} message
   */
  onMessage(message) {
    let id = message.id;
    let error = message.error;
    let result = message.data;

    let callbackIndex = this.callbacks.findIndex(
      callback => callback.id === id
    );
    let callback = this.callbacks[callbackIndex];
    if (!callback) {
      return;
    }

    this.callbacks.splice(callbackIndex, 1);
    callback.fn(error, result);
  }

  /**
   * Passes a job to a worker thread.
   * Saves a callback, matched to an id,
   * so that it knows what to do when the worker thread passes back the result.
   * @param {Object} message
   * @returns {Promise} A promise that is resolved with the result or rejected with an error.
   */
  send(message) {
    let worker = this.getNextWorker.next().value;

    let id = this.generateId.next().value;
    message.id = id;

    return new Promise((resolve, reject) => {
      this.callbacks.push({
        id,
        fn: (error, result) => {
          if (error) {
            return reject(new Error(error));
          }
          resolve(result);
        }
      });

      worker.send(message);
    });
  }
};
