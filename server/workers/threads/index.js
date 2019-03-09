const mongoose = require("../../Mongoose");
const User = require("../../models/User");
const Chat = require("../../models/Chat");
const Message = require("../../models/Message");
const ThreadWorker = require("./ThreadWorker");

/**
 * Create the worker thread and register jobs below.
 */
const threadWorker = new ThreadWorker();

/**
 * Connect to MongoDB.
 */
mongoose.connect().then(() => {
  console.log(`Worker ${process.pid} connected to MongoDB`);
});

/**
 * Create #general-chat if it does't exist.
 */
threadWorker.registerJob("createGeneralChatIfNotExists", () => {
  return Chat.createGeneralChatIfNotExists();
});

/**
 * Remove any users from every chat.
 */
threadWorker.registerJob("clearChatsFromUsers", () => {
  return Chat.clearChatsFromUsers();
});

/**
 * Delete messages and unused chats that are older than `sinceDate`, except #general-chat.
 *   Start by deleting messages that are older than `sinceDate`.
 *   Then count the remaining messages for every chat, other than #general-chat.
 *   If any chat doesn't have messages anymore, look up whether that chat was created before `sinceDate`.
 *   If so, then delete that chat.
 * @param {Object} message
 * @param {Number} message.sinceTime Time to subtract from now, in ms.
 * @async
 */
threadWorker.registerJob("deleteMessagesAndUnusedChatsSince", async message => {
  let now = new Date().getTime();
  let sinceDate = new Date(now - message.sinceTime);

  let chats = await Chat.find();
  for (let chat of chats) {
    /** Delete messages of chat that are old. */
    let { n, ok } = await Message.deleteMany({
      chat: chat.id,
      createdAt: { $lte: sinceDate }
    });

    if (ok !== 1) {
      console.log("Deleting old messages of Chat", chat.name, "error", ok);
      continue;
    }

    if (n > 0) {
      console.log(
        "Deleted",
        n,
        "old messages of Chat",
        chat.name,
        "successfully!"
      );
    }

    /** If #general-chat, stop here. */
    if (chat.name === "general-chat") {
      continue;
    }

    /** Otherwise, count the remaining messages of chat... */
    Message.countDocuments({
      chat: chat.id
    }).then((count, err) => {
      if (err) {
        console.log(
          "Count remaining messages of Chat",
          chat.name,
          "error",
          err
        );
        return;
      }

      if (count > 0) {
        console.log(
          "Chat",
          chat.name,
          "still has",
          count,
          "Messages remaining!"
        );
        return;
      }

      /**
       * If the chat has no messages now:
       *   Look up whether the chat is old.
       *   And if so, delete that chat.
       */
      let chatCreationTimestamp = new Date(chat.createdAt).getTime();
      if (chatCreationTimestamp > sinceDate.getTime()) {
        return;
      }

      chat.remove(function(err, chat) {
        if (err) {
          console.log(
            "Deleting old Chat",
            chat.name,
            "without messages error",
            err
          );
        }
        console.log(
          "Deleted old Chat",
          chat.name,
          "without messages successfully!"
        );
      });
    });
  }
});

/**
 * Register a new user and respond with the said user.
 * If any form fields are missing, respond with 400 and any validation message(s).
 * @param {Object} message
 * @param {String} message.username
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("registerUser", async message => {
  let contentType = { "Content-Type": "application/json" };

  let username = message.username;
  if (!username) {
    return {
      statusCode: 400,
      contentType,
      payload: JSON.stringify({
        errors: { username: "This field is required" }
      })
    };
  }

  let latestUser = await User.getLatestUser();

  let tag = latestUser ? latestUser.tag + 1 : 1;

  let user = new User({
    name: username,
    tag: tag
  });
  await user.save();

  return {
    statusCode: 200,
    contentType,
    payload: user.toClientJSON()
  };
});

/**
 * Log a user in to the API, after finding the user in the database.
 * If any form fields are missing, respond with 400.
 * If the user was not found, respond with 404.
 * @param {Object} message
 * @param {String} message.userId
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("logInUser", async message => {
  let contentType = { "Content-Type": "application/json" };

  let userId = message.userId;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return {
      statusCode: 400,
      contentType,
      payload: JSON.stringify({ errors: { params: "Missing parameters" } })
    };
  }

  let user = await User.findById(userId);
  if (!user) {
    return {
      statusCode: 400,
      contentType,
      payload: JSON.stringify({ errors: { user: "User not found" } })
    };
  }

  return {
    statusCode: 200,
    contentType,
    payload: user.toClientJSON()
  };
});

/**
 * Get the list of chats from the database and respond with the said list.
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("getChats", async () => {
  let contentType = { "Content-Type": "application/json" };

  let chats = await Chat.find();
  chats = chats.map(chat => chat.toClientObject());

  return {
    statusCode: 200,
    contentType,
    payload: JSON.stringify(chats)
  };
});

/**
 * Get the list of users of a specific chat, after finding the chat in the database
 * and respond with the said list.
 * If any form fields are missing, respond with 400.
 * If the chat was not found, respond with 404.
 * @param {Object} message
 * @param {String} message.chatId
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("getChatUsers", async message => {
  let contentType = { "Content-Type": "application/json" };

  let chatId = message.chatId;
  if (!chatId || !mongoose.isValidObjectId(chatId)) {
    return { statusCode: 400 };
  }

  /**
   * Find the specific chat in the database, with all its users.
   * Also sort the users alphabetically, followed by tag.
   */
  let chat = await Chat.findById(chatId).populate({
    path: "users",
    options: { sort: { name: "asc", tag: "asc" } }
  });
  if (!chat) {
    return { statusCode: 404 };
  }

  let users = chat.users.map(user => user.toClientObject());

  return {
    statusCode: 200,
    contentType,
    payload: JSON.stringify(users)
  };
});

/**
 * Get the list of messages of a specific chat, after finding the chat in the database
 * and respond with the said list.
 * If any form fields are missing, respond with 400.
 * If the chat was not found, respond with 404.
 * @param {Object} message
 * @param {String} message.chatId
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("getChatMessages", async message => {
  let contentType = { "Content-Type": "application/json" };

  let chatId = message.chatId;
  if (!chatId || !mongoose.isValidObjectId(chatId)) {
    return { statusCode: 400 };
  }

  /**
   * Find all the messages of the specific chat,
   * along with the users who sent them.
   */
  let messages = await Message.find({ chat: chatId }).populate("user");
  messages = messages.map(message => message.toClientObject());

  return {
    statusCode: 200,
    contentType,
    payload: JSON.stringify(messages)
  };
});

/**
 * Post a message of a specific user in a specific chat, after finding the chat and the user in the database
 * and respond with the said message.
 * If any form fields are missing, respond with 400.
 * If the chat or the user was not found, respond with 404.
 * @param {Object} message
 * @param {String} message.chatId
 * @param {String} message.userId
 * @param {String} message.messageContent
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("postChatMessage", async message => {
  let contentType = { "Content-Type": "application/json" };

  let chatId = message.chatId;
  let userId = message.userId;
  let messageContent = message.messageContent;
  if (
    !chatId ||
    !mongoose.isValidObjectId(chatId) ||
    !userId ||
    !mongoose.isValidObjectId(userId) ||
    !messageContent
  ) {
    return { statusCode: 400 };
  }

  /**
   * Find the specific chat in the database,
   * with all its users.
   */
  let chat = await Chat.findById(chatId).populate("users");
  if (!chat) {
    return { statusCode: 404 };
  }

  /**
   * Check whether the specific user
   * is in the chat.
   */
  let user = chat.users.find(user => user._id.toString() === userId);
  if (!user) {
    return { statusCode: 404 };
  }

  let chatMessage = new Message({
    content: messageContent,
    chat: chat._id,
    user: user._id
  });
  await chatMessage.save();

  chatMessage.user = user;

  return {
    statusCode: 200,
    contentType,
    payload: chatMessage.toClientJSON(),
    chatMessage: chatMessage.toClientObject(),
    user: user.toClientObject()
  };
});

/**
 * Confirm that a user, who is currently typing, exists in the chat,
 * by finding the specific chat and the specific user in the database.
 * If any form fields are missing, respond with 400.
 * If the chat or the user was not found, respond with 404.
 * @param {Object} message
 * @param {String} message.chatId
 * @param {String} message.userId
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("postChatUserTyping", async message => {
  let chatId = message.chatId;
  let userId = message.userId;
  if (
    !chatId ||
    !mongoose.isValidObjectId(chatId) ||
    !userId ||
    !mongoose.isValidObjectId(userId)
  ) {
    return { statusCode: 400 };
  }

  /**
   * Find the specific chat in the database,
   * with all its users.
   */
  let chat = await Chat.findById(chatId).populate("users");
  if (!chat) {
    return { statusCode: 404 };
  }

  /**
   * Check whether the specific user
   * is in the chat.
   */
  let user = chat.users.find(user => user._id.toString() === userId);
  if (!user) {
    return { statusCode: 404 };
  }

  return {
    statusCode: 204,
    user: user.toClientObject()
  };
});

/**
 * Create a new chat with a unique name, after finding the user in the database and respond with the said chat.
 * If any form fields are missing or a chat with that name already exists, respond with 400 and any validation message(s).
 * If the user was not found, respond with 404.
 * @param {Object} message
 * @param {String} message.chatId
 * @param {String} message.chatName
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("createChat", async message => {
  let contentType = { "Content-Type": "application/json" };

  let userId = message.userId;
  let chatName = message.chatName;
  if (!userId || !mongoose.isValidObjectId(userId) || !chatName) {
    return {
      statusCode: 400,
      contentType,
      payload: JSON.stringify({ errors: { params: "Missing parameters" } })
    };
  }

  let existingChat = await Chat.findOne({ name: chatName });
  if (existingChat) {
    return {
      statusCode: 400,
      contentType,
      payload: JSON.stringify({ errors: { chatName: "Chat already exists" } })
    };
  }

  let user = await User.findById(userId);
  if (!user) {
    return {
      statusCode: 404,
      contentType,
      payload: JSON.stringify({ errors: { user: "User not found" } })
    };
  }

  let chat = new Chat({
    name: chatName
  });
  await chat.save();

  return {
    statusCode: 200,
    contentType,
    payload: chat.toClientJSON(),
    chat: chat.toClientObject()
  };
});

/**
 * Finds a specific chat and a specific user in the database.
 * If there aren't any duplicate users in the chat:
 *   Responds successfully with the user.
 * @param {Object} message
 * @param {String} message.chatId The specific chat id.
 * @param {String} message.userId The specific user id.
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("socketOnConnect", async message => {
  let chatId = message.chatId;
  let userId = message.userId;
  if (!mongoose.isValidObjectId(chatId) || !mongoose.isValidObjectId(userId)) {
    return {};
  }

  let chat = await Chat.findById(chatId).populate("users");
  if (!chat) {
    return {};
  }

  let user = await User.findById(userId);
  if (!user) {
    return {};
  }

  chat.users.push(user);
  await chat.save();

  if (getMatchedUsers(chat.users, user).length === 1) {
    return { user: user.toClientObject() };
  }

  return {};
});

/**
 * Finds a specific chat and a specific user in the database.
 * Then searches for that user in that chat and removes him.
 * Afterwards, if there aren't any duplicate users in the chat:
 *   Responds successfully with the user.
 * @param {Object} message
 * @param {String} message.chatId The specific chat id.
 * @param {String} message.userId The specific user id.
 * @returns {Object}
 * @async
 */
threadWorker.registerJob("socketOnDisconnect", async message => {
  let chatId = message.chatId;
  let userId = message.userId;
  if (!mongoose.isValidObjectId(chatId) || !mongoose.isValidObjectId(userId)) {
    return {};
  }

  let chat = await Chat.findById(chatId).populate("users");
  if (!chat) {
    return {};
  }

  let user = await User.findById(userId);
  if (!user) {
    return {};
  }

  /** Remove the user from the chat. */
  let chatUserIndex = chat.users.findIndex(chatUser =>
    chatUser._id.equals(user._id)
  );
  if (chatUserIndex === -1) {
    return {};
  }

  chat.users.splice(chatUserIndex, 1);
  await chat.save();

  if (getMatchedUsers(chat.users, user).length === 0) {
    return { user: user.toClientObject() };
  }

  return {};
});

/**
 * Filters a list of users by another user, to get any duplicates.
 * @param {User[]} users
 * @param {User} filterUser
 * @returns {User[]} A list of duplicated users.
 * @helper
 */
function getMatchedUsers(users, filterUser) {
  return users.filter(user => user._id.equals(filterUser._id));
}
