/* global MainWorker*/
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "AppWorker" }] */

/** Our implementation of the MainWorker class. */
class AppWorker extends MainWorker {
  constructor(worker) {
    super(worker);
  }

  /**
   * Extends the parent method to implement new functionality.
   * If the message comes from an event:
   *   Runs the appropriate handler.
   * Otherwise:
   *   Does what the parent method would do.
   * @param {Event} e
   */
  onMessage(e) {
    let message = e.data;
    let event = message.event;
    if (event) {
      this.onMessageEvent(event, message);
      return;
    }

    super.onMessage(e);
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
}
