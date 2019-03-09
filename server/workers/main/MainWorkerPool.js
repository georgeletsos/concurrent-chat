const cp = require("child_process");
const numCPUs = require("os").cpus().length || 1;

const SCHED_DEFAULT = 1;
const SCHED_RR = 2;

/** Class representing a pool of child processes/workers of the main thread. */
module.exports = class MainWorkerPool {
  /**
   * @param {String} modulePath The module to run in the child.
   * @param {Number} schedulingPolicy Default = 1 (Available workers/round-robin) or Round-robin = 2.
   */
  constructor(modulePath, schedulingPolicy = SCHED_DEFAULT) {
    this.schedulingPolicy = schedulingPolicy;
    this.workers = [];
    this.callbacks = [];
    this.generateId = this.idGenerator();
    this.getNextWorker = this.workerCircularSequence();

    for (let i = 0; i < numCPUs; i++) {
      let worker = cp.fork(modulePath);
      worker.busy = false;
      worker.on("message", message => this.onMessage(message, worker));

      this.workers.push(worker);
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
   * Looks for an available worker in the pool of workers.
   * @returns {ChildProcess}
   */
  getAvailableWorker() {
    for (let i = 0; i < this.workers.length; i++) {
      let worker = this.workers[i];
      if (!worker.busy) {
        return worker;
      }
    }

    return;
  }

  /**
   * Called when the worker thread passes the result of a completed job
   * back to the main thread.
   * Sets the worker as available.
   * Finds and runs the right callback, based on the message id.
   * @param {Object} message
   * @param {ChildProcess} worker The child that listened on this message.
   */
  onMessage(message, worker) {
    if (this.schedulingPolicy === SCHED_DEFAULT) {
      worker.busy = false;
    }

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
   * Depending on the scheduling policy:
   *   1. Picks an available worker thread, while falling back to round-robin if all the worker threads are busy.
   *   2. Picks a worker thread by round-robin fashion.
   * Saves a callback, matched to an id,
   * so that it knows what to do when the worker thread passes back the result.
   * @param {Object} message
   * @returns {Promise} A promise that is resolved with the result or rejected with an error.
   */
  send(message) {
    let worker;
    switch (this.schedulingPolicy) {
      case SCHED_DEFAULT: {
        worker = this.getAvailableWorker();
        if (!worker) {
          worker = this.getNextWorker.next().value;
        }
        break;
      }

      case SCHED_RR: {
        worker = this.getNextWorker.next().value;
        break;
      }
    }

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

      worker.busy = true;
      worker.send(message);
    });
  }
};
