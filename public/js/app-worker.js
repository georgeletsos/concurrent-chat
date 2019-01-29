/* global AppUi */

window.AppWorker = (function() {
  "use strict";

  /** Class representing the web worker instance our main thread. */
  const AppWorker = function() {
    /**
     * Unique id generator function.
     * @yields {number} A unique id.
     */
    this._generateId = function*() {
      let id = 0;

      while (true) {
        yield id++;
      }
    };

    /**
     * Global id generator.
     * We need these ids to map tasks executed by web workers to the larger
     * operation that created them.
     */
    this._idGenerator = this._generateId();

    /**
     * Resolver and rejector functions from promises.
     * As results come back from web workers, we look them up here based on the id.
     */
    this._resolvers = {};
    this._rejectors = {};

    /**
     * The original implementation of postMessage().
     * We are going to need to call it later on, inside our custom implementation.
     */
    this._postMessage = Worker.prototype.postMessage;

    /**
     * A reference to this AppWorker.
     * We are going to need to use it later, inside a closure.
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
         * Run the original web worker postMessage() implementation,
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
    this.api = new Worker("js/worker.js");

    /** Listen to messages coming from the web worker. */
    this.api.addEventListener("message", e => {
      /** If the response came from a websocket event... */
      if (e.data.socketEvent) {
        /** This switch decides what action to follow based on the websocket event. */
        switch (e.data.socketEvent) {
          /**
           * Upon connection, change the title of the page.
           * Also change the message input placeholder.
           */
          case "connect":
            AppUi.setTitle(e.data.chatName);
            AppUi.setMessagePlaceholder(e.data.chatName);
            break;

          /** When a user connects, draw the user in the UI, along with a welcome message. */
          case "userConnected":
            if (e.data.nextUser) {
              AppUi.drawUserAfter(e.data.user, e.data.nextUser);
            } else {
              AppUi.drawUsers([e.data.user]);
            }

            AppUi.drawWelcomeMessage(e.data.user);
            break;

          /** When a user disconnects, remove the user from the UI and draw a goodbye message. */
          case "userDisconnected":
            AppUi.undrawUser(e.data.user);

            AppUi.drawGoodbyeMessage(e.data.user);
            break;

          /** When a message is received, draw the message in the UI. */
          case "chatMessage":
            AppUi.drawMessages([e.data.message]);
            break;

          /** When a user has started/stopped typing, draw the users currently typing in the UI. */
          case "userTyping":
            AppUi.drawTypingUsers(e.data.typingUsers);
            break;
        }

        return;
      }

      /**
       * Otherwise...
       * If the e.data object has an error property,
       * look up the rejector function and call it with the e.data.error.
       * Else, look up the resolver function and call it with the e.data.data.
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
  };

  return new AppWorker();
})();
