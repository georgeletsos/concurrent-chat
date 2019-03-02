/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "AppWorker" }] */

/** Class representing the web worker instance of our main thread. */
class AppWorker {
  /**
   * @param {Worker} worker
   */
  constructor(worker) {
    this.worker = worker;
    this.callbacks = [];
    this.generateId = this.idGenerator();

    this.onMessage = this.onMessage.bind(this);
    this.worker.addEventListener("message", this.onMessage);
  }

  /**
   * Unique id generator function.
   * @yields {Number} A unique id.
   */
  *idGenerator() {
    let id = 0;

    while (true) {
      yield id++;
    }
  }

  /**
   * Called when the worker thread passes the result of a completed job
   * back to the main thread.
   * If the message comes from an event:
   *    Runs the appropriate handler.
   * Otherwise:
   *   Finds and runs the right callback, based on the message id.
   * @param {Event} e
   */
  onMessage(e) {
    let message = e.data;
    let id = message.id;
    let error = message.error;
    let result = message.data;

    let event = message.event;
    if (event) {
      this.onMessageEvent(event, message);
      return;
    }

    let callbackIndex = this.callbacks.findIndex(
      callback => callback.id === id
    );
    let callback = this.callbacks[callbackIndex];
    if (!callback) {
      return;
    }

    this.callbacks.splice(callbackIndex, 1);
    callback.fn(error, result);
  }

  /**
   * Called when the worker thread passes the result of an event
   * back to the main thread.
   * Emits an appropriate custom event about what happened.
   * @param {Event} event
   * @param {Object} message
   */
  onMessageEvent(event, message) {
    switch (event) {
      case "socketConnected": {
        let socketConnectedEvent = new CustomEvent("socketConnected", {
          detail: { chatName: message.chatName }
        });

        document.dispatchEvent(socketConnectedEvent);
        break;
      }

      case "userConnected": {
        let detail = { user: message.user };
        if (message.nextUser) {
          detail.nextUser = message.nextUser;
        }

        let socketUserConnectedEvent = new CustomEvent("socketUserConnected", {
          detail: detail
        });

        document.dispatchEvent(socketUserConnectedEvent);
        break;
      }

      case "userDisconnected": {
        let socketUserDisconnectedEvent = new CustomEvent(
          "socketUserDisconnected",
          {
            detail: { user: message.user }
          }
        );

        document.dispatchEvent(socketUserDisconnectedEvent);
        break;
      }

      case "chatCreated": {
        let socketChatCreatedEvent = new CustomEvent("socketChatCreated", {
          detail: { chat: message.chat }
        });

        document.dispatchEvent(socketChatCreatedEvent);
        break;
      }

      case "messagePosted": {
        let socketMessagePostedEvent = new CustomEvent("socketMessagePosted", {
          detail: { message: message.message }
        });

        document.dispatchEvent(socketMessagePostedEvent);
        break;
      }

      case "userTyping": {
        let socketUserTypingEvent = new CustomEvent("socketUserTyping", {
          detail: { typingUsers: message.typingUsers }
        });

        document.dispatchEvent(socketUserTypingEvent);
        break;
      }
    }
  }

  /**
   * Passes a job to the worker thread.
   * Saves a callback, matched to an id,
   * so that it knows what to do when the worker thread responds.
   * @param {Object} message
   * @returns {Promise} A promise that is resolved with the result or rejected with an error.
   */
  postMessage(message) {
    let id = this.generateId.next().value;
    message.id = id;

    return new Promise((resolve, reject) => {
      this.callbacks.push({
        id,
        fn: (error, result) => {
          if (error) {
            return reject(new Error(error));
          }
          resolve(result);
        }
      });

      this.worker.postMessage(message);
    });
  }
}
