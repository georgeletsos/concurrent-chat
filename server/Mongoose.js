const mongoose = require("mongoose").Mongoose;
const mongoUrl = process.env.MONGODB_URI || "mongodb://localhost:27017/node-chat";

/** Class representing our mongoose implementation. */
class Mongoose extends mongoose {
  constructor() {
    super();
  }

  /**
   * Opens the default mongoose connection.
   * Options passed take precedence over options included in connection strings.
   * @returns pseudo-promise wrapper around this
   */
  connect() {
    return super.connect(mongoUrl, {
      useNewUrlParser: true
    });
  }

  /**
   * Check if given `id` is a valid MongoDB ObjectId.
   * @param {String} id
   * @returns {Boolean}
   */
  isValidObjectId(id) {
    return this.Types.ObjectId.isValid(id);
  }
}

module.exports = new Mongoose();
