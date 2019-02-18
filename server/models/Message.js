/**
 * @typedef {import("mongoose").Mongoose} mongoose
 * @typedef {import("mongoose").Schema} mongooseSchema
 * @typedef {import("./User")} User
 */

/**
 * @const
 * @type {mongoose}
 */
const mongoose = require("mongoose");

/**
 * @const
 * @type {User}
 */
const User = require("./User");

/**
 * @const
 * @type {mongooseSchema}
 */
const messageSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Chat"
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User"
    }
  },
  { timestamps: { updatedAt: null } }
);

/**
 * Transform the output of `toObject` further, as to send to client only the info it needs.
 * @returns {Object} A `Chat` with the only info that we need to show to the client.
 */
messageSchema.methods.toClientObject = function() {
  return this.toObject({
    transform: function(doc, ret, options) {
      if (doc instanceof User) {
        return doc.toClientObject();
      }

      return {
        id: ret._id,
        content: ret.content,
        user: ret.user,
        createdAt: ret.createdAt
      };
    }
  });
};

/**
 * Make the output of the above `toClientObject` into JSON.
 * @returns {JSON}
 */
messageSchema.methods.toClientJSON = function() {
  return JSON.stringify(this.toClientObject());
};

/** Class representing our Message model. */
class Message extends mongoose.model {
  constructor() {
    super("Message", messageSchema);
  }
}

module.exports = new Message();
