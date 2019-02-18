const Mongoose = require("../Mongoose");

const User = require("./User");

const messageSchema = new Mongoose.Schema(
  {
    content: { type: String, required: true },
    chat: {
      type: Mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Chat"
    },
    user: {
      type: Mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User"
    }
  },
  { timestamps: { updatedAt: null } }
);

/**
 * Transform the output of `toObject` further, as to send to client only the info it needs.
 * @returns {Object} A Message with the only info that we need to show to the client.
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

const Message = Mongoose.model("Message", messageSchema);

module.exports = Message;
