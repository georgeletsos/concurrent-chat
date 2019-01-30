/* global AppWorker, _, dayjs */

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

    /** Throttle the register user function. */
    this._registerUserThrottled = _.throttle(this._registerUser, 1e3, {
      trailing: false
    });

    /** Add the submission event handler for the register user UI form. */
    document
      .getElementById("register-form")
      .addEventListener("submit", this._registerUserHandler.bind(this));

    /** Throttle the typing function. */
    this._typingThrottled = _.throttle(this._typing, 10e3, {
      trailing: false
    });

    /** Our main DOM components are defined below. */
    this.$registerContainer = document.getElementById("register-container");

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

    this._$messageFormField = document.getElementById("message-form-field");

    this._$typing = document.getElementById("typing");

    this._$typingTextContainer = this._$typing.querySelector("span");

    this._$usersContainer = document.getElementById("users-container");

    this._$users = document.getElementById("users");
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

      /** Finish here by showing the register user UI. */
      this.$registerContainer.classList.remove("hidden");

      return;
    }

    /** After successfully logging in, remove the container of the register user UI. */
    this.$registerContainer.parentNode.removeChild(this.$registerContainer);

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
      /** Remove the container of messages. */
      this._$messagesContainer.parentNode.removeChild(this._$messagesContainer);

      /** Remove the container of users. */
      this._$usersContainer.parentNode.removeChild(this._$usersContainer);

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

        /** Add the event handler for posting a message in the current chat. */
        this._$messageFormField.addEventListener("keydown", e => {
          /** Since this is a textarea, post the message only after the Enter key has been pressed. */
          if (e.key === "Enter" && !e.shiftKey) {
            this._postMessageHandler(e);
          }
        });

        /** Add the input event handler for when current user is typing in the current chat. */
        this._$messageFormField.addEventListener("input", e => {
          /** Since this is a textarea... */
          let $el = e.target;

          /** Reset its height. */
          $el.style.height = "auto";

          /** Grow the textarea, when a new line is added. */
          if ($el.scrollHeight > $el.clientHeight) {
            $el.style.height = $el.scrollHeight + "px";
          }

          this._typingHandler(e);
        });

        /**
         * Focus on the message input.
         * (When the code reaches here right after registering a new User,
         * we need to redirect the focus.)
         */
        this._$messageFormField.focus();

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
   * Set the placeholder of the message input.
   * @param {string} chatName
   */
  AppUi.prototype.setMessagePlaceholder = function(chatName) {
    this._$messageFormField.setAttribute("placeholder", `Message #${chatName}`);
  };

  /**
   * @param {Element} $element The element in question.
   * @returns {number} The sum of `scrollTop` and `clientHeight` properties of the `$element`.
   */
  AppUi.prototype._getElementScrollClient = function($element) {
    return Math.ceil($element.scrollTop + $element.clientHeight);
  };

  /**
   * Check if the user is currently scrolling on an element, by using the `scrollClient` and `scrollHeight` properties of the element.
   * Doesn't always use the current values of the above properties of the element, in case something has been added to the element in between.
   * @param {number} scrollClient The scrollClient property of the element.
   * @param {number} scrollHeight The scrollHeight property of the element.
   * @returns {Boolean} True or false.
   */
  AppUi.prototype._isUserCurrentlyScrolling = function(
    scrollClient,
    scrollHeight
  ) {
    /** Deviation of 5px */
    return Math.abs(scrollClient - scrollHeight) > 5;
  };

  /**
   * Register a new user by making an API call.
   * If successful, save the new user to local storage and show the app UI.
   * If not successful, show validation error(s).
   * Also show/hide the loading animation on the button.
   * @param {Event} e The event that took place.
   */
  AppUi.prototype._registerUser = function(e) {
    let $form = e.target,
      $input = $form.querySelector("input"),
      $label = $form.querySelector("label"),
      $button = $form.querySelector("button"),
      $buttonPulsingDots = $button.querySelector("div"),
      $buttonText = $button.querySelector("span");

    this._undrawValidation($input, $label);

    /** Hide the button text. */
    $buttonText.classList.add("hidden");

    /** Show the pulsing dots. */
    $buttonPulsingDots.classList.remove("hidden");

    let username = $input.value.trim();

    /** Give the pulsing dots half a second... (Doesn't look nice if it's too fast) */
    setTimeout(() => {
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

          /** Hide the pulsing dots. */
          $buttonPulsingDots.classList.add("hidden");

          /** Show the button text. */
          $buttonText.classList.remove("hidden");

          /** Finally initialize the app UI. */
          this.initApp();
        })
        /** If a new User couldn't get registered successfully... */
        .catch(error => {
          /** Hide the pulsing dots. */
          $buttonPulsingDots.classList.add("hidden");

          /** Show the button text. */
          $buttonText.classList.remove("hidden");

          /**
           * If there was no error, then the problem should be elsewhere.
           * Otherwise, show the validation message(s).
           */
          if (!error) {
            console.error("Worker rejected promise with no payload");
            return;
          }

          this._drawValidation(error.username, $input, $label);
        });
    }, 5e2);
  };

  /**
   * Event handler that uses the trottled version of the register user function above.
   * @param {Event} e The event that took place.
   */
  AppUi.prototype._registerUserHandler = function(e) {
    e.preventDefault();

    this._registerUserThrottled(e);
  };

  /**
   * Event handler that takes care of posting a message of the current user
   * in the current chat, by making an API call.
   * After the message has been sent successfully, scroll to bottom of the messages DOM component.
   * Also restart the throttled typing function.
   * @param {Event} e The event that took place.
   */
  AppUi.prototype._postMessageHandler = function(e) {
    e.preventDefault();

    let $message = e.target;

    let messageContent = $message.value.trim();

    if (!messageContent) {
      return;
    }

    AppWorker.api
      .postMessage({
        action: "postChatMessage",
        chatId: this._chatId,
        userId: this.user.id,
        messageContent: messageContent
      })
      .then(() => {
        /** After the message has been sent successfully, scroll to bottom of the messages DOM component. */
        this._$messages.scrollTop = this._$messages.scrollHeight;

        /** Also restart the throttled typing function. */
        this._typingThrottled.cancel();
        this._typingThrottled.flush();
      });

    /** Clear the message field. */
    $message.value = "";

    /** Since this is a textarea, also reset its height. */
    $message.style.height = "auto";
  };

  /** Send a signal that current user has started typing in the current chat. */
  AppUi.prototype._typing = function() {
    AppWorker.api.postMessage({
      action: "typing",
      chatId: this._chatId,
      userId: this.user.id
    });
  };

  /**
   * Event handler that uses the trottled version of the typing function above,
   * when the message being typed isn't empty.
   * @param {Event} e The event that took place.
   */
  AppUi.prototype._typingHandler = function(e) {
    e.preventDefault();

    let message = e.target.value.trim();
    if (!message) {
      return;
    }

    this._typingThrottled();
  };

  /**
   * Show the pulsing dots and draw a list of users currently typing, next to the pulsing dots.
   * @param {Object[]} typingUsers The list of users currently typing.
   * @param {string} typingUsers[].name The name of a user currently typing.
   * @param {number} typingUsers[].tag The tag of a user currently typing.
   */
  AppUi.prototype.drawTypingUsers = function(typingUsers) {
    /** Start by clearing the list of users currently typing of the UI. */
    this._$typingTextContainer.innerHTML = "";

    /** If there are no users currently typing, finish here by hiding the typing element of the UI. */
    if (typingUsers.length === 0) {
      this._$typing.classList.add("hidden");
      return;
    }

    let $span = document.createElement("span");

    $span.classList.add("text-white", "font-bold");

    /** Draw something different depending on the amount of users currently typing. */
    if (typingUsers.length === 1) {
      let typingUser = typingUsers[0];

      $span.textContent = `${typingUser.name} #${typingUser.tag}`;

      this._$typingTextContainer.appendChild($span);

      this._$typingTextContainer.appendChild(
        document.createTextNode(" is typing...")
      );
    } else if (typingUsers.length <= 3) {
      /** Remove the last user currently typing, but keep the user in memory temporarily (will be used later). */
      let lastTypingUser = typingUsers.splice(-1, 1)[0];

      /** Loop through the remaining users currently typing, appending each one to the element. */
      for (let [index, typingUser] of typingUsers.entries()) {
        let $spanClone = $span.cloneNode();

        $spanClone.textContent = `${typingUser.name} #${typingUser.tag}`;

        this._$typingTextContainer.appendChild($spanClone);

        /** Stop here, if this is the last user of the remaining users currently typing. */
        if (index + 1 === typingUsers.length) {
          break;
        }

        /** Otherwise append a comma. */
        this._$typingTextContainer.appendChild(document.createTextNode(", "));
      }

      /** Now it's time to append the last user currently typing and the typing message to the element. */
      let $spanClone = $span.cloneNode();

      $spanClone.textContent = `${lastTypingUser.name} #${lastTypingUser.tag}`;

      this._$typingTextContainer.appendChild(document.createTextNode(" and "));

      this._$typingTextContainer.appendChild($spanClone);

      this._$typingTextContainer.appendChild(
        document.createTextNode(" are typing...")
      );
    } else if (typingUsers.length > 3) {
      this._$typingTextContainer.appendChild(
        document.createTextNode("Several people are typing...")
      );
    }

    this._$typing.classList.remove("hidden");
  };

  /**
   * Draw a validation error message on the `$label`
   * and add the error border to the `$input`.
   * @param {string} validationMessage The validation error message to draw.
   * @param {Element} $input The input element.
   * @param {Element} $label The label element of the input element.
   */
  AppUi.prototype._drawValidation = function(
    validationMessage,
    $input,
    $label
  ) {
    $input.classList.add("border-red");

    $label.classList.add("text-red");

    let $span = document.createElement("span");

    $span.setAttribute("error-message", "");

    $span.textContent = `- ${validationMessage}`;

    $span.classList.add("text-xs", "font-normal", "italic", "tracking-wide");

    $label.appendChild($span);
  };

  /**
   * Remove a validation error message from the `$label`
   * and also remove the error border from the `$input`.
   * @param {Element} $input The input element.
   * @param {Element} $label The label element of the input element.
   */
  AppUi.prototype._undrawValidation = function($input, $label) {
    $input.classList.remove("border-red");

    $label.classList.remove("text-red");

    let $span = $label.querySelector("[error-message]");
    if ($span) {
      $span.parentNode.removeChild($span);
    }
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

      /** If the current chat isn't the same as the iterated chat, then draw an `a.href` element. */
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
   * Draw a welcome message for the `user` on the UI.
   * @param {Object} user The user to say welcome to.
   * @param {string} user.name The name of the user.
   * @param {string} user.tag The tag of the user.
   */
  AppUi.prototype.drawWelcomeMessage = function(user) {
    /**
     * Store the scroll and height of the messages DOM component before continuing.
     * They are going to be used later to implement scroll to bottom functionality.
     */
    let messagesScrollClient = this._getElementScrollClient(this._$messages),
      messagesScrollHeight = this._$messages.scrollHeight;

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

    this._$messages.appendChild($li);

    /** If the user is not currently scrolling, scroll to bottom of the messages DOM component to show the newly added message. */
    if (
      !this._isUserCurrentlyScrolling(
        messagesScrollClient,
        messagesScrollHeight
      )
    ) {
      this._$messages.scrollTop = this._$messages.scrollHeight;
    }
  };

  /**
   * Draw a goodbye message for the `user` on the UI.
   * @param {Object} user The user to say goodbye to.
   * @param {string} user.name The name of the user.
   * @param {string} user.tag The tag of the user.
   */
  AppUi.prototype.drawGoodbyeMessage = function(user) {
    /**
     * Store the scroll and height of the messages DOM component before continuing.
     * They are going to be used later to implement scroll to bottom functionality.
     */
    let messagesScrollClient = this._getElementScrollClient(this._$messages),
      messagesScrollHeight = this._$messages.scrollHeight;

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

    this._$messages.appendChild($li);

    /** If the user is not currently scrolling, scroll to bottom of the messages DOM component to show the newly added message. */
    if (
      !this._isUserCurrentlyScrolling(
        messagesScrollClient,
        messagesScrollHeight
      )
    ) {
      this._$messages.scrollTop = this._$messages.scrollHeight;
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
    let messagesScrollClient = this._getElementScrollClient(this._$messages),
      messagesScrollHeight = this._$messages.scrollHeight;

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

      this._$messages.appendChild($li);
    }

    /** If the user is not currently scrolling, scroll to bottom of the messages DOM component to show the newly added messages. */
    if (
      !this._isUserCurrentlyScrolling(
        messagesScrollClient,
        messagesScrollHeight
      )
    ) {
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
