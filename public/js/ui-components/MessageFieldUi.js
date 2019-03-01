/* global UiComponent, _ */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "MessageFieldUi" }] */

/** Class representing the message field component. */
class MessageFieldUi extends UiComponent {
  /**
   * @param {AppWorker} appWorker The web worker instance of our main thread.
   * @param {String} chatId The current chat id that comes from the page URL.
   * @param {Object} user The user info object.
   */
  constructor(appWorker, chatId, user) {
    super(appWorker);

    this.chatId = chatId;
    this.user = user;

    this.onFieldKeydown = this.onFieldKeydown.bind(this);
    this.onFieldInput = this.onFieldInput.bind(this);
    this.onSocketConnected = this.onSocketConnected.bind(this);
    this.onSocketUserTyping = this.onSocketUserTyping.bind(this);

    this.userTypingThrottled = _.throttle(this.userTyping, 10e3, {
      trailing: false
    });

    /** Main DOM elements of component. */
    this.$messageField = document.getElementById("message-form-field");
    this.$typing = document.getElementById("typing");
    this.$typingTextContainer = this.$typing.querySelector("span");
  }

  /**
   * Initializes the component, by setting up message field keydown and input event listeners,
   * socket event listeners and focusing on the message field.
   */
  init() {
    this.$messageField.addEventListener("keydown", this.onFieldKeydown);
    this.$messageField.addEventListener("input", this.onFieldInput);

    this.setUpSocketEventListeners();
    this.focus();
  }

  setUpSocketEventListeners() {
    document.addEventListener("socketConnected", this.onSocketConnected);
    document.addEventListener("socketUserTyping", this.onSocketUserTyping);
  }

  /**
   * Called upon successful socket connection.
   * Sets the message field placeholder.
   * @param {Event} e
   */
  onSocketConnected(e) {
    this.setMessageFieldPlaceholder(e.detail.chatName);
  }

  /**
   * Called when the socket informs that a user is typing.
   * Draws the typing users.
   * @param {Event} e
   */
  onSocketUserTyping(e) {
    this.drawTypingUsers(e.detail.typingUsers);
  }

  /**
   * Sets focus on the message field.
   */
  focus() {
    this.$messageField.focus();
  }

  /**
   * Called upon typing in the message field.
   * If the Enter key was pressed:
   *   Post the message in the chat.
   * @param {Event} e
   */
  onFieldKeydown(e) {
    if (this.wasEnterPressed(e)) {
      this.postMessage(e);
    }
  }

  /**
   * Checks if the Enter key was pressed, without the Shift key.
   * @param {Event} e
   */
  wasEnterPressed(e) {
    return e.key === "Enter" && !e.shiftKey;
  }

  /**
   * Called upon inputting data in the message field.
   * Starts by changing the field's height, since it's a textarea, in case a line was added or removed.
   * If the inputted data is not empty:
   *   Uses the throttled version of the `userTyping` method below.
   * @param {Event} e
   */
  onFieldInput(e) {
    e.preventDefault();

    this.changeFieldHeight(e);

    let message = e.target.value.trim();
    if (!message) {
      return;
    }

    this.userTypingThrottled();
  }

  /**
   * Changes the field's height.
   * Since a textarea is being used, it needs to grow when a new line is added
   * and shrink when a line is removed.
   * @param {Event} e
   */
  changeFieldHeight(e) {
    let $el = e.target;

    /** Reset the height. */
    $el.style.height = "auto";

    if ($el.scrollHeight > $el.clientHeight) {
      $el.style.height = $el.scrollHeight + "px";
    }
  }

  /**
   * Notifies the API that the current user is typing.
   */
  userTyping() {
    this.appWorker.api.postMessage({
      action: "userTyping",
      chatId: this.chatId,
      userId: this.user.id
    });
  }

  /**
   * Posts a message of the current user in the current chat,
   * when the message field is not empty.
   * Emits an event about what happened,
   * and resets the throttled version of the `userTyping` method.
   * Also resets the message field and its height.
   * @param {Event} e
   */
  postMessage(e) {
    e.preventDefault();

    let $messageField = e.target;

    let messageContent = $messageField.value.trim();
    if (!messageContent) {
      return;
    }

    /** Make an API call to post the message. */
    this.appWorker.api
      .postMessage({
        action: "postChatMessage",
        chatId: this.chatId,
        userId: this.user.id,
        messageContent: messageContent
      })
      .then(() => {
        let userPostedMessage = new CustomEvent("userPostedMessage");
        document.dispatchEvent(userPostedMessage);

        /** Reset the throttled version of the `userTyping` method. */
        this.userTypingThrottled.cancel();
        this.userTypingThrottled.flush();
      });

    $messageField.value = "";
    $messageField.style.height = "auto";
  }

  /**
   * Shows the animation and draws a list of users currently typing.
   * @param {Object[]} typingUsers The list of users currently typing.
   * @param {String} typingUsers[].name
   * @param {Number} typingUsers[].tag
   */
  drawTypingUsers(typingUsers) {
    /** Start by clearing the previous list of users currently typing. */
    this.$typingTextContainer.innerHTML = "";

    /** If there are no users currently typing, finish here by hiding the element. */
    if (typingUsers.length === 0) {
      this.$typing.classList.add("hidden");
      return;
    }

    let $span = document.createElement("span");

    $span.classList.add("text-white", "font-bold");

    /** Draw something different depending on the amount of users currently typing. */
    if (typingUsers.length === 1) {
      let typingUser = typingUsers[0];

      $span.textContent = `${typingUser.name} #${typingUser.tag}`;

      this.$typingTextContainer.appendChild($span);

      this.$typingTextContainer.appendChild(
        document.createTextNode(" is typing...")
      );
    } else if (typingUsers.length <= 3) {
      /** Remove the last user currently typing, but keep him in memory (will be used later). */
      let lastTypingUser = typingUsers.splice(-1, 1)[0];

      /** Loop through the remaining users currently typing, appending each one to the element. */
      for (let [index, typingUser] of typingUsers.entries()) {
        let $spanClone = $span.cloneNode();

        $spanClone.textContent = `${typingUser.name} #${typingUser.tag}`;

        this.$typingTextContainer.appendChild($spanClone);

        /** Stop here, if this is the last user of the remaining users currently typing. */
        if (index + 1 === typingUsers.length) {
          break;
        }

        /** Otherwise append a comma. */
        this.$typingTextContainer.appendChild(document.createTextNode(", "));
      }

      /** Append the last user currently typing and the typing message to the element. */
      let $spanClone = $span.cloneNode();

      $spanClone.textContent = `${lastTypingUser.name} #${lastTypingUser.tag}`;

      this.$typingTextContainer.appendChild(document.createTextNode(" and "));

      this.$typingTextContainer.appendChild($spanClone);

      this.$typingTextContainer.appendChild(
        document.createTextNode(" are typing...")
      );
    } else if (typingUsers.length > 3) {
      this.$typingTextContainer.appendChild(
        document.createTextNode("Several people are typing...")
      );
    }

    /** Show the element. */
    this.$typing.classList.remove("hidden");
  }

  /**
   * Sets the placeholder of the message field.
   * @param {String} chatName
   */
  setMessageFieldPlaceholder(chatName) {
    this.$messageField.setAttribute("placeholder", `Message #${chatName}`);
  }
}
