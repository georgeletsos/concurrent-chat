/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "AppWorker" }] */

/** Class representing the web worker instance of our main thread. */
class AppWorker {
  constructor() {
    /**
     * Unique id generator function.
     * @yields {Number} A unique id.
     */
    this._generateId = function*() {
      let id = 0;

      while (true) {
        yield id++;
      }
    };

    /**
     * Global id generator.
     * These ids are used to map tasks executed by web workers to the larger
     * operation that created them.
     */
    this._idGenerator = this._generateId();

    /**
     * Resolver and rejector functions from promises.
     * As results come back from web workers, they are being looked up here based on the id.
     */
    this._resolvers = {};
    this._rejectors = {};

    /**
     * The original implementation of `postMessage()`.
     * There will be a need to call it later on, inside our custom implementation.
     */
    this._postMessage = Worker.prototype.postMessage;

    /**
     * A reference to this AppWorker.
     * There will be a need to use it later on, inside a closure.
     */
    const thisAppWorker = this;

    /** Replace the original web worker postMessage() with our custom implementation. */
    Worker.prototype.postMessage = function(data) {
      return new Promise((resolve, reject) => {
        /** The id that's used to tie together a web worker response and a resolver or rejector function. */
        let msgId = thisAppWorker._idGenerator.next().value;

        /**
         * Store the resolver and rejector functions.
         * They are going to be used used later inside the web worker message callback.
         */
        thisAppWorker._resolvers[msgId] = resolve;
        thisAppWorker._rejectors[msgId] = reject;

        /**
         * Run the original web worker `postMessage()` implementation,
         * which takes care of actually posting the message to the web worker thread.
         */
        thisAppWorker._postMessage.call(
          this,
          Object.assign(
            {
              msgId: msgId
            },
            data
          )
        );
      });
    };

    /** Start our web worker. */
    this.api = new Worker("/js/worker.js");

    /** Listen to messages coming from the web worker. */
    this.api.addEventListener("message", e => {
      let event = e.data.event;
      /** If the response came from a websocket event... */
      if (event) {
        /** This switch decides what action to follow based on the websocket event. */
        switch (event) {
          /**
           * Upon connection, change the title of the page.
           * Also change the message input placeholder.
           */
          case "socketConnected": {
            let socketConnectedEvent = new CustomEvent("socketConnected", {
              detail: { chatName: e.data.chatName }
            });

            document.dispatchEvent(socketConnectedEvent);
            break;
          }

          /** When a user connects, draw the user in the UI, along with a welcome message. */
          case "userConnected": {
            let detail = { user: e.data.user };
            if (e.data.nextUser) {
              detail.nextUser = e.data.nextUser;
            }

            let socketUserConnectedEvent = new CustomEvent(
              "socketUserConnected",
              {
                detail: detail
              }
            );

            document.dispatchEvent(socketUserConnectedEvent);
            break;
          }

          /** When a user disconnects, remove the user from the UI and draw a goodbye message. */
          case "userDisconnected": {
            let socketUserDisconnectedEvent = new CustomEvent(
              "socketUserDisconnected",
              {
                detail: { user: e.data.user }
              }
            );

            document.dispatchEvent(socketUserDisconnectedEvent);
            break;
          }

          /** When a new chat has been created, draw the new chat in the UI. */
          case "chatCreated": {
            let socketChatCreatedEvent = new CustomEvent("socketChatCreated", {
              detail: { chat: e.data.chat }
            });

            document.dispatchEvent(socketChatCreatedEvent);
            break;
          }

          /** When a message is received, draw the message in the UI. */
          case "messagePosted": {
            let socketMessagePostedEvent = new CustomEvent(
              "socketMessagePosted",
              {
                detail: { message: e.data.message }
              }
            );

            document.dispatchEvent(socketMessagePostedEvent);
            break;
          }

          /** When a user has started/stopped typing, draw the users currently typing in the UI. */
          case "userTyping": {
            let socketUserTypingEvent = new CustomEvent("socketUserTyping", {
              detail: { typingUsers: e.data.typingUsers }
            });

            document.dispatchEvent(socketUserTypingEvent);
            break;
          }
        }

        return;
      }

      /**
       * Otherwise...
       * If the e.data object has an error property,
       * look up the rejector function and call it with the `e.data.error`.
       * Else, look up the resolver function and call it with the `e.data.data`.
       */
      let source = e.data.hasOwnProperty("error")
          ? this._rejectors
          : this._resolvers,
        callback = source[e.data.msgId],
        data = e.data.hasOwnProperty("error") ? e.data.error : e.data.data;

      if (data) {
        callback(data);
      } else {
        callback();
      }

      /** There is no further need for the resolver and rejector functions, so delete them. */
      delete this._resolvers[e.data.msgId];
      delete this._rejectors[e.data.msgId];
    });
  }
}
