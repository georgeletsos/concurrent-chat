const Mongoose = require("../Mongoose");

const User = require("./User");

const chatSchema = new Mongoose.Schema(
  {
    name: { type: String, required: true },
    users: [
      {
        type: Mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: { updatedAt: null } }
);

/**
 * Transform the output of `toObject` further, as to send to client only the info it needs.
 * @returns {Object} A Chat with the only info that we need to show to the client.
 */
chatSchema.methods.toClientObject = function() {
  return this.toObject({
    transform: function(doc, ret, options) {
      return {
        id: ret._id,
        name: ret.name
      };
    }
  });
};

/**
 * Make the output of the above `toClientObject` into JSON.
 * @returns {JSON}
 */
chatSchema.methods.toClientJSON = function() {
  return JSON.stringify(this.toClientObject());
};

/**
 * Transform the output of `toObject` further, as to send to client only the info it needs.
 * Include the users this time.
 * @returns {Object} A Chat with the only info that we need to show to the client, including the users this time.
 */
chatSchema.methods.toClientObjectWithUsers = function() {
  return this.toObject({
    transform: function(doc, ret, options) {
      if (doc instanceof User) {
        return doc.toClientObject();
      }

      return {
        id: ret._id,
        name: ret.name,
        users: ret.users
      };
    }
  });
};

/**
 * Make the output of the above `toClientObjectWithUsers` into JSON.
 * @returns {JSON}
 */
chatSchema.methods.toClientJSONWithUsers = function() {
  return JSON.stringify(this.toClientObjectWithUsers());
};

/**
 * Try creating the `#general-chat` after determining if it already exists first.
 * @async
 */
chatSchema.statics.createGeneralChatIfNotExists = async function() {
  let existingGeneralChat = await this.findOne({ name: "general-chat" });
  if (!existingGeneralChat) {
    let generalChat = new this({
      name: "general-chat"
    });

    await generalChat.save();

    console.log("Added #general-chat");
  } else {
    console.log("A #general-chat already exists");
  }
};

const Chat = Mongoose.model("Chat", chatSchema);

module.exports = Chat;
