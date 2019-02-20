const Mongoose = require("../Mongoose");

const userSchema = new Mongoose.Schema(
  {
    name: { type: String, required: true },
    tag: { type: Number, required: true }
  },
  { timestamps: { updatedAt: null } }
);

/**
 * Transform the output of `toObject` further, as to send to client only the info it needs.
 * @returns {Object} A User with the only info that we need to show to the client.
 */
userSchema.methods.toClientObject = function() {
  return this.toObject({
    transform: function(doc, ret, options) {
      return {
        id: ret._id,
        name: ret.name,
        tag: ret.tag
      };
    }
  });
};

/**
 * Make the output of the above `toClientObject` into JSON.
 * @returns {JSON}
 */
userSchema.methods.toClientJSON = function() {
  return JSON.stringify(this.toClientObject());
};

/**
 * Find the most recently added User.
 * @returns {User}
 */
userSchema.statics.getLatestUser = function() {
  return this.findOne().sort({ createdAt: "desc" });
};

const User = Mongoose.model("User", userSchema);

module.exports = User;
