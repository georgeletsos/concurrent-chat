const mongoose = require("mongoose").Mongoose;
const mongoUrl = "mongodb://localhost:27017/node-chat";

/** Class representing our mongoose implementation. */
class Mongoose extends mongoose {
  constructor() {
    super();
  }

  /**
   * Connect to MongoDB
   * @async
   */
  async connect() {
    super.connect(mongoUrl, {
      useNewUrlParser: true
    });
  }

  /**
   * Check if given id is a valid MongoDB ObjectId.
   * @param {String} id
   * @returns {Boolean}
   */
  isValidObjectId(id) {
    return this.Types.ObjectId.isValid(id);
  }
}

module.exports = new Mongoose();
