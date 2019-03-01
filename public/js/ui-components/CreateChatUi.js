/* global UiComponent */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "CreateChatUi" }] */

/** Class representing the create-chat component. */
class CreateChatUi extends UiComponent {
  /**
   * @param {AppWorker} appWorker The web worker instance of our main thread.
   * @param {Object} user The user info object.
   */
  constructor(appWorker, user) {
    super(appWorker);

    this.user = user;

    this.onShowButtonClick = this.onShowButtonClick.bind(this);
    this.onFormSubmit = this.onFormSubmit.bind(this);

    /** Main DOM elements of component. */
    this.$form = document.getElementById("create-chat-form");
    this.$chatName = this.$form.querySelector("input");
    this.$chatNameLabel = this.$form.querySelector("label");
    this.$showButton = document.getElementById("show-create-chat-btn");
    this.$icon = this.$showButton.querySelector("div");
  }

  /**
   * Initializes the component, by setting up the show button click
   * and form submission event listeners.
   */
  init() {
    this.$showButton.addEventListener("click", this.onShowButtonClick);
    this.$form.addEventListener("submit", this.onFormSubmit);
  }

  /**
   * Called when the show button is clicked.
   * Shows the form and animates the icon.
   * @param {Event} e
   */
  onShowButtonClick(e) {
    e.preventDefault();

    this.$form.classList.toggle("hidden");

    this.$icon.classList.toggle("rotate-45");

    this.$chatName.focus();
  }

  /**
   * Called upon form submission.
   * Attempts to create a new chat, when the chat name field is not empty.
   * If successful:
   *   Redirects to the new chat URL.
   * Otherwise:
   *   Shows any validation message(s).
   * @param {Event} e
   */
  onFormSubmit(e) {
    e.preventDefault();

    let chatName = this.$chatName.value.trim();
    if (!chatName) {
      return;
    }

    /** Make an API call attempting to create a new chat. */
    this.appWorker.api
      .postMessage({
        action: "createChat",
        userId: this.user.id,
        chatName: chatName
      })
      .then(newChat => {
        location.href = "/" + newChat.id;
      })
      .catch(error => {
        let errorChatName = error.chatName;
        if (errorChatName) {
          this.drawValidation(
            errorChatName,
            this.$chatName,
            this.$chatNameLabel
          );
        }
      });
  }

  /**
   * Draws a validation message on the `$label` and adds the error border to the `$input`.
   * @param {String} validationMessage
   * @param {Element} $input
   * @param {Element} $label
   */
  drawValidation(validationMessage, $input, $label) {
    $input.classList.add("border-red");

    $label.classList.add("text-red");

    let $span = $label.querySelector("[error-message]");
    if ($span) {
      return;
    }

    $span = document.createElement("span");

    $span.setAttribute("error-message", "");

    $span.textContent = validationMessage;

    $span.classList.add("text-xs", "italic", "tracking-wide");

    $label.appendChild($span);

    $label.classList.remove("hidden");
  }
}
