const WorkerPool = require("./WorkerPool");

/** Class representing our implementaion of MainWorkerPool. */
module.exports = class MainWorkerPool extends WorkerPool {
  /**
   * @param {String} modulePath
   */
  constructor(modulePath) {
    super(modulePath);
  }

  /**
   * Connects every child process/worker to MongoDB.
   * @returns {Promise} A promise after every worker has been connected.
   */
  connectMongo() {
    let mongoConnections = [];
    for (let i = 0; i < this.workers.length; i++) {
      mongoConnections.push(this.send({ op: "connectMongo" }));
    }

    return Promise.all(mongoConnections);
  }
};
