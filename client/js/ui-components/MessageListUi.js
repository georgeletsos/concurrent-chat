/* global UiComponent, dayjs */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "MessageListUi" }] */

/** Class representing the message list component. */
class MessageListUi extends UiComponent {
  /**
   * @param {AppWorker} appWorker The web worker instance of our main thread.
   * @param {String} chatId The current chat id that comes from the page URL.
   * @param {Object} user The user info object.
   */
  constructor(appWorker, chatId, user) {
    super(document.getElementById("messages-container"), appWorker);

    this.chatId = chatId;
    this.user = user;

    this.onUserPostedMessage = this.onUserPostedMessage.bind(this);
    this.onSocketUserConnected = this.onSocketUserConnected.bind(this);
    this.onSocketUserDisconnected = this.onSocketUserDisconnected.bind(this);
    this.onSocketMessagePosted = this.onSocketMessagePosted.bind(this);

    /** Main DOM elements of component. */
    this.$messages = document.getElementById("messages");
  }

  /**
   * Initializes the component, by setting up socket event listeners,
   * showing the component and drawing the list of current chat's messages.
   *   The component needs to be shown before any messages are drawn,
   *   for the scroll to bottom functionality to work the first time.
   */
  init() {
    document.addEventListener("userPostedMessage", this.onUserPostedMessage);

    this.setUpSocketEventListeners();

    this.show();

    /** Make an API call to get the list of current chat's messages. */
    this.appWorker
      .postMessage({
        op: "getChatMessages",
        chatId: this.chatId
      })
      .then(messages => {
        this.drawMessages(messages);
      });
  }

  /**
   * Called when the current user posts a message.
   * Scroll to bottom of the message list, to see the newly added message.
   * @param {Event} e
   */
  onUserPostedMessage() {
    this.$messages.scrollTop = this.$messages.scrollHeight;
  }

  setUpSocketEventListeners() {
    document.addEventListener(
      "socketUserConnected",
      this.onSocketUserConnected
    );
    document.addEventListener(
      "socketUserDisconnected",
      this.onSocketUserDisconnected
    );
    document.addEventListener(
      "socketMessagePosted",
      this.onSocketMessagePosted
    );
  }

  /**
   * Called when the socket informs that a user has been connected.
   * Draws a welcome message for that user.
   * @param {Event} e
   */
  onSocketUserConnected(e) {
    this.drawWelcomeMessage(e.detail.user);
  }

  /**
   * Called when the socket informs that a user has been disconnected.
   * Draws a goodbye message for that user.
   * @param {Event} e
   */
  onSocketUserDisconnected(e) {
    this.drawGoodbyeMessage(e.detail.user);
  }

  /**
   * Called when the socket informs that a user has posted a message in the chat.
   * Draws that message.
   * @param {Event} e
   */
  onSocketMessagePosted(e) {
    this.drawMessages([e.detail.message]);
  }

  /**
   * Calculates the sum of `scrollTop` and `clientHeight` properties of the `$element`.
   * @param {Element} $element
   * @returns {Number} The sum of `scrollTop` and `clientHeight` properties of the `$element`.
   */
  getElementScrollClient($element) {
    return Math.ceil($element.scrollTop + $element.clientHeight);
  }

  /**
   * Checks if the user is currently scrolling on an element.
   * @param {Number} scrollClient The sum of `scrollTop` and `clientHeight` of an element.
   * @param {Number} scrollHeight The `scrollHeight` property of an element.
   * @returns {Boolean}
   */
  isUserScrolling(scrollClient, scrollHeight) {
    /** Deviation of 5px. */
    return Math.abs(scrollClient - scrollHeight) > 5;
  }

  /**
   * Draws a welcome message for the user.
   * @param {Object} user
   * @param {String} user.name
   * @param {String} user.tag
   */
  drawWelcomeMessage(user) {
    /**
     * Store the scroll client and scroll height of the messages DOM element before continuing.
     * They are going to be used later to implement scroll to bottom functionality.
     */
    let messagesScrollClient = this.getElementScrollClient(this.$messages);
    let messagesScrollHeight = this.$messages.scrollHeight;

    let $li = document.createElement("li"),
      $arrow = document.createElement("div"),
      $welcomeMessage = document.createElement("div"),
      $username = document.createElement("span"),
      $time = document.createElement("span");

    $li.classList.add(
      "py-2",
      "border-t",
      "border-solid",
      "border-grey-dark",
      "flex",
      "items-center"
    );

    $arrow.classList.add(
      "w-4",
      "h-4",
      "mr-2",
      "bg-contain",
      "bg-center",
      "bg-no-repeat",
      "arrow-right"
    );

    $li.appendChild($arrow);

    $welcomeMessage.classList.add("text-base", "text-grey-lightest");

    $welcomeMessage.appendChild(document.createTextNode("Welcome "));

    $username.classList.add("text-white");

    $username.textContent = `${user.name} #${user.tag}`;

    $welcomeMessage.appendChild($username);

    $welcomeMessage.appendChild(document.createTextNode("."));

    $li.appendChild($welcomeMessage);

    $time.classList.add("ml-1", "text-sm", "text-grey-dark");

    $time.textContent = `Today at ${dayjs().format("h:mm A")}`;

    $li.appendChild($time);

    this.$messages.appendChild($li);

    /** If the user is not scrolling, scroll to bottom to show the newly added message. */
    if (!this.isUserScrolling(messagesScrollClient, messagesScrollHeight)) {
      this.$messages.scrollTop = this.$messages.scrollHeight;
    }
  }

  /**
   * Draws a goodbye message for the user.
   * @param {Object} user
   * @param {String} user.name
   * @param {String} user.tag
   */
  drawGoodbyeMessage(user) {
    /**
     * Store the scroll client and scroll height of the messages DOM element before continuing.
     * They are going to be used later to implement scroll to bottom functionality.
     */
    let messagesScrollClient = this.getElementScrollClient(this.$messages);
    let messagesScrollHeight = this.$messages.scrollHeight;

    let $li = document.createElement("li"),
      $arrow = document.createElement("div"),
      $welcomeMessage = document.createElement("div"),
      $username = document.createElement("span"),
      $time = document.createElement("span");

    $li.classList.add(
      "py-2",
      "border-t",
      "border-solid",
      "border-grey-dark",
      "flex",
      "items-center"
    );

    $arrow.classList.add(
      "w-4",
      "h-4",
      "mr-2",
      "bg-contain",
      "bg-center",
      "bg-no-repeat",
      "arrow-right",
      "rotate-180"
    );

    $li.appendChild($arrow);

    $welcomeMessage.classList.add("text-base", "text-grey-lightest");

    $welcomeMessage.appendChild(document.createTextNode("Goodbye "));

    $username.classList.add("text-white");

    $username.textContent = `${user.name} #${user.tag}`;

    $welcomeMessage.appendChild($username);

    $welcomeMessage.appendChild(document.createTextNode("."));

    $li.appendChild($welcomeMessage);

    $time.classList.add("ml-1", "text-sm", "text-grey-dark");

    $time.textContent = `Today at ${dayjs().format("h:mm A")}`;

    $li.appendChild($time);

    this.$messages.appendChild($li);

    /** If the user is not scrolling, scroll to bottom to show the newly added message. */
    if (!this.isUserScrolling(messagesScrollClient, messagesScrollHeight)) {
      this.$messages.scrollTop = this.$messages.scrollHeight;
    }
  }

  /**
   * Draws a list of messages.
   * @param {Object[]} messages A list of messages.
   * @param {String} messages[].user The user that sent the message.
   * @param {String} messages[].content The content of the message.
   * @param {String} messages[].createdAt The date when the message was sent.
   */
  drawMessages(messages) {
    /**
     * Store the scroll client and scroll height of the messages DOM element before continuing.
     * They are going to be used later to implement scroll to bottom functionality.
     */
    let messagesScrollClient = this.getElementScrollClient(this.$messages);
    let messagesScrollHeight = this.$messages.scrollHeight;

    for (let message of messages) {
      let user = message.user,
        $li = document.createElement("li"),
        $div1 = document.createElement("div"),
        $div2 = document.createElement("div"),
        $message = document.createElement("div"),
        $username = document.createElement("span"),
        $time = document.createElement("span");

      $li.classList.add("py-2", "border-t", "border-solid", "border-grey-dark");

      $div1.classList.add("px-4");

      $div2.classList.add("mb-2");

      if (this.user.id === user.id) {
        $username.classList.add("text-purple");
      } else {
        $username.classList.add("text-white");
      }

      $username.classList.add("text-lg", "font-medium");

      $username.textContent = `${user.name} #${user.tag}`;

      $div2.appendChild($username);

      $time.classList.add("ml-1", "text-sm", "text-grey-dark");

      let today = dayjs();
      let yesterday = today.subtract(1, "day");
      let messageSentAt = message.createdAt;
      let sentAt = dayjs(messageSentAt);
      let sentAtToTime = dayjs(messageSentAt).format("h:mm A");
      let sentAtToDate = dayjs(messageSentAt).format("DD/MM/YYYY");

      if (sentAt.isSame(today, "day")) {
        $time.textContent = `Today at ${sentAtToTime}`;
      } else if (sentAt.isSame(yesterday, "day")) {
        $time.textContent = `Yesterday at ${sentAtToTime}`;
      } else {
        $time.textContent = sentAtToDate;
      }

      $div2.appendChild($time);

      $div1.appendChild($div2);

      $message.classList.add(
        "text-base",
        "text-grey-lightest",
        "message",
        "whitespace-pre-wrap",
        "break-words"
      );

      $message.textContent = message.content;

      $div1.appendChild($message);

      $li.appendChild($div1);

      this.$messages.appendChild($li);
    }

    /** If the user is not scrolling, scroll to bottom to show the newly added message. */
    if (!this.isUserScrolling(messagesScrollClient, messagesScrollHeight)) {
      this.$messages.scrollTop = this.$messages.scrollHeight;
    }
  }
}
