/* global AppWorker, dayjs */

window.AppUi = (function() {
  "use strict";

  /** Class representing the UI of our main thread. */
  const AppUi = function() {
    /** Current user info that might exist in local storage. */
    this.user = localStorage.getItem("user")
      ? JSON.parse(localStorage.getItem("user"))
      : null;

    /** Current chat id that comes from the page URL. */
    this._chatId = location.pathname.slice(1);

    /** Our main DOM components are defined below. */
    this._$registerContainer = document.getElementById("register-container");

    this._$registerForm = document.getElementById("register-form");

    this._$appContainer = document.getElementById("app-container");

    this._$chatsContainer = document.getElementById("chats-container");

    this._$chats = document.getElementById("chats");

    this._$myUsername = document.getElementById("my-username");

    this._$myTag = document.getElementById("my-tag");

    this._$instructionsContainer = document.getElementById(
      "instructions-container"
    );

    this._$messagesContainer = document.getElementById("messages-container");

    this._$messages = document.getElementById("messages");

    this._$messageForm = document.getElementById("message-form");

    this._$messageFormInput = this._$messageForm.querySelector("input");

    this._$usersContainer = document.getElementById("users-container");

    this._$users = document.getElementById("users");
  };

  /** Initialize the register user UI, by showing the DOM component and adding event handlers. */
  AppUi.prototype.initRegister = function() {
    /** Add the submission event handler for the register user UI form. */
    this._$registerForm.addEventListener(
      "submit",
      this._registerUserHandler.bind(this)
    );

    /** Show the register user UI. */
    this._$registerContainer.classList.remove("hidden");
  };

  /** Initialize the app UI, by showing the DOM component, adding event handlers and making API calls. */
  AppUi.prototype.initApp = async function() {
    /** Wait for the current user to successfully log in to the API... */
    try {
      await AppWorker.api.postMessage({
        action: "loginUser",
        userId: this.user.id
      });
    } catch (error) {
      /** If the current user cannot log in, remove the current user from local storage. */
      localStorage.removeItem("user");

      /** Set the current user as empty. */
      this.user = null;

      /** Finish here by initializing the register user UI. */
      this.initRegister();

      return;
    }

    /** Show the app UI. */
    this._$appContainer.classList.remove("hidden");

    this._drawCurrentUserInfo(this.user);

    /** Make an async API call to get the list of chats... */
    AppWorker.api
      .postMessage({
        action: "getChats"
      })
      .then(chats => {
        /** Then draw the list of chats on the UI. */
        this._drawChats(chats);

        /** And show the container of the list of chats. */
        this._$chatsContainer.classList.remove("hidden");
      });

    /** If there's no chat id in the page URL... */
    if (!this._chatId) {
      /** Finish here by showing the container of instructions. */
      this._$instructionsContainer.classList.remove("hidden");

      return;
    }

    /** Otherwise, continue by making another async API call to get the list of users of current Chat... */
    AppWorker.api
      .postMessage({
        action: "getChatUsers",
        chatId: this._chatId
      })
      .then(users => {
        /** Then draw the list of users on the UI. */
        this.drawUsers(users);

        /** And show the container of the list of users. */
        this._$usersContainer.classList.remove("hidden");
      });

    /** Make yet another async API call to get the list of messages of current chat... */
    AppWorker.api
      .postMessage({
        action: "getChatMessages",
        chatId: this._chatId
      })
      .then(messages => {
        /**
         * Start by showing the container of the list of messages.
         * (It's needed in order to make scroll to bottom functionality work...)
         */
        this._$messagesContainer.classList.remove("hidden");

        /** Add the submission event handler for posting a message in the current chat. */
        this._$messageForm.addEventListener(
          "submit",
          this._postMessageHandler.bind(this)
        );

        /**
         * Focus on the message input.
         * (When the code reaches here right after registering a new User,
         * we need to redirect the focus.)
         */
        this._$messageFormInput.focus();

        /** Finally draw the list of messages on the UI. */
        this.drawMessages(messages);
      });

    /** Finish by asking to open a websocket connection, between the current user and the current chat. */
    AppWorker.api.postMessage({
      action: "connectWebsocket",
      chatId: this._chatId,
      userId: this.user.id
    });
  };

  /**
   * Set the title of the page.
   * @param {string} chatName
   */
  AppUi.prototype.setTitle = function(chatName) {
    document.title = `#${chatName}`;
  };

  /**
   * Set the placeholder of the Message input.
   * @param {string} chatName
   */
  AppUi.prototype.setMessagePlaceholder = function(chatName) {
    this._$messageFormInput.setAttribute("placeholder", `Message #${chatName}`);
  };

  /**
   * Event handler that takes care of registering a new User by making an API call.
   * Also shows any validation errors.
   * @param {Event} e The event that took place.
   */
  AppUi.prototype._registerUserHandler = function(e) {
    e.preventDefault();

    let $form = e.target;

    let username = $form.querySelector("input").value.trim();

    /** Make an API call to register a new User... */
    AppWorker.api
      .postMessage({
        action: "registerUser",
        username: username
      })
      /** If a new User was registered successfully... */
      .then(user => {
        /** Save the User in local storage. */
        localStorage.setItem("user", JSON.stringify(user));

        /** Update the current User. */
        this.user = user;

        /** Hide the container of the register user UI. */
        this._$registerContainer.classList.add("hidden");

        /** Finally initialize the app UI. */
        this.initApp();
      })
      /** If a new User couldn't get registered successfully... */
      .catch(error => {
        /**
         * If there was no error, then the problem should be elsewhere.
         * Otherwise, show the validation message(s).
         */
        if (!error) {
          console.error("Worker rejected promise with no payload");
          return;
        }

        let $input = $form.querySelector("input"),
          $label = $form.querySelector("label"),
          $errorMessageSpan = $label.querySelector("[error-message]");

        $label.classList.add("text-red");

        $input.classList.add("border-red");

        /** Finish here, if there is any visible validation message already. */
        if ($errorMessageSpan) {
          return;
        }

        let $span = document.createElement("span");

        $span.setAttribute("error-message", "");

        $span.textContent = `- ${error.username}`;

        $span.classList.add(
          "text-xs",
          "font-normal",
          "italic",
          "tracking-wide"
        );

        $label.appendChild($span);
      });
  };

  /**
   * Event handler that takes care of posting a message of the current user
   * in the current chat, by making an API call.
   * @param {Event} e The event that took place.
   */
  AppUi.prototype._postMessageHandler = function(e) {
    e.preventDefault();

    let $form = e.target;

    let $message = $form.querySelector("input");

    let messageContent = $message.value.trim();

    if (!messageContent) {
      return;
    }

    AppWorker.api.postMessage({
      action: "postChatMessage",
      chatId: this._chatId,
      userId: this.user.id,
      messageContent: messageContent
    });

    $message.value = "";
  };

  /**
   * Draw `user` info on the UI.
   * @param {Object} user The user object.
   * @param {string} user.name The name of the user.
   * @param {number} user.tag The tag of the user.
   */
  AppUi.prototype._drawCurrentUserInfo = function(user) {
    this._$myUsername.textContent = user.name;
    this._$myTag.textContent = `#${user.tag}`;
  };

  /**
   * Draw a list of `chats` on the UI.
   * @param {Object[]} chats A list of chats.
   * @param {string} chats[].id The id of the chat.
   * @param {string} chats[].name The name of the chat.
   */
  AppUi.prototype._drawChats = function(chats) {
    for (let chat of chats) {
      let $li = document.createElement("li"),
        $div = document.createElement("div"),
        $hash = document.createElement("span"),
        $chatName = document.createElement("span");

      $li.classList.add("py-1");

      $div.classList.add("p-2", "rounded-lg", "select-none");

      $hash.classList.add("mr-1", "text-base", "text-white", "opacity-50");

      $hash.textContent = "#";

      $div.appendChild($hash);

      $chatName.classList.add("text-base", "text-white");

      $chatName.textContent = chat.name;

      $div.appendChild($chatName);

      /** If the current chat isn't the same as the iterated chat, then draw a `a.href` element. */
      if (this._chatId === chat.id) {
        $div.classList.add("bg-grey-light");

        $li.appendChild($div);
      } else {
        $div.classList.add("hover:bg-grey-darker");

        let $a = document.createElement("a");

        $a.classList.add("no-underline");

        $a.setAttribute("href", `/${chat.id}`);

        $a.appendChild($div);

        $li.appendChild($a);
      }

      this._$chats.appendChild($li);
    }
  };

  /**
   * Draw a list of `messages` on the UI.
   * @param {Object[]} messages A list of messages.
   * @param {string} messages[].user The user that sent the message.
   * @param {string} messages[].content The content of the message.
   * @param {string} messages[].sentAt The timestamp when the message was sent.
   */
  AppUi.prototype.drawMessages = function(messages) {
    /**
     * Store the scroll and height of the messages DOM component before continuing.
     * They are going to be used later to implement scroll to bottom functionality.
     */
    let $messagesScrollClient = Math.ceil(
        this._$messages.scrollTop + this._$messages.clientHeight
      ),
      $messagesScrollHeight = this._$messages.scrollHeight;

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

      $time.classList.add("ml-1", "text-sm", "text-grey-dark", "time");

      let today = dayjs(),
        yesterday = today.subtract(1, "day"),
        sentAt = dayjs(message.sentAt),
        sentAtToTime = dayjs(message.sentAt).format("h:mm A"),
        sentAtToDate = dayjs(message.sentAt).format("DD/MM/YYYY");

      if (sentAt.isSame(today, "day")) {
        $time.textContent = `Today at ${sentAtToTime}`;
      } else if (sentAt.isSame(yesterday, "day")) {
        $time.textContent = `Yesterday at ${sentAtToTime}`;
      } else {
        $time.textContent = sentAtToDate;
      }

      $div2.appendChild($time);

      $div1.appendChild($div2);

      $message.classList.add("text-base", "text-grey-lightest", "message");

      $message.textContent = message.content;

      $div1.appendChild($message);

      $li.appendChild($div1);

      this._$messages.appendChild($li);
    }

    /** If the user is not currently scrolling... (deviation of 5px) */
    if (Math.abs($messagesScrollClient - $messagesScrollHeight) <= 5) {
      /** Scroll to bottom to show the newly added messages. */
      this._$messages.scrollTop = this._$messages.scrollHeight;
    }
  };

  /**
   * Create an element that houses a `user`.
   * @param {Object} user The user.
   * @param {string} user.id The id of the user.
   * @param {string} user.name The name of the user.
   * @param {number} user.tag The tag of the user.
   * @returns {Element} The element.
   */
  AppUi.prototype._createUserEl = function(user) {
    let $li = document.createElement("li");

    $li.classList.add("py-2", "text-base", "text-grey-lighter");

    $li.setAttribute("user-id", user.id);

    $li.textContent = `${user.name} #${user.tag}`;

    return $li;
  };

  /**
   * Draw a list of `users` on the UI.
   * @param {Object[]} users A list of users.
   */
  AppUi.prototype.drawUsers = function(users) {
    for (let user of users) {
      let $user = this._createUserEl(user);

      this._$users.appendChild($user);
    }
  };

  /**
   * Draw a `user` just before the `nextUser` on the UI.
   * @param {Object} user The user to be drawn.
   * @param {Object} nextUser The next user in line.
   */
  AppUi.prototype.drawUserAfter = function(user, nextUser) {
    let $nextUser = this._$users.querySelector(`[user-id="${nextUser.id}"]`);

    if ($nextUser) {
      let $user = this._createUserEl(user);

      $nextUser.parentNode.insertBefore($user, $nextUser);
    }
  };

  /**
   * Remove a `user` from the UI.
   * @param {Object} user The user to be removed.
   */
  AppUi.prototype.undrawUser = function(user) {
    let $user = this._$users.querySelector(`[user-id="${user.id}"]`);

    if ($user) {
      $user.parentNode.removeChild($user);
    }
  };

  return new AppUi();
})();
