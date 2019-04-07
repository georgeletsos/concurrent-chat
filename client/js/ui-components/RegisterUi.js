/* global UiComponent, _ */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "RegisterUi" }] */

/** Class representing the register component. */
class RegisterUi extends UiComponent {
  /**
   * @param {AppWorker} appWorker The web worker instance of our main thread.
   */
  constructor(appWorker) {
    super(document.getElementById("register-container"), appWorker);

    this.onFormSubmit = this.onFormSubmit.bind(this);

    this.registerUserThrottled = _.throttle(this.registerUser, 1e3, {
      trailing: false
    });

    /** Main DOM elements of component. */
    this.$form = document.getElementById("register-form");
    this.$username = this.$form.querySelector("input");
    this.$usernameLabel = this.$form.querySelector("label");
    this.$button = this.$form.querySelector("button");
    this.$buttonLoading = this.$button.querySelector("div");
    this.$buttonText = this.$button.querySelector("span");
  }

  /**
   * Initializes the component, by setting up the form submission event listener.
   */
  init() {
    this.$form.addEventListener("submit", this.onFormSubmit);
  }

  /**
   * Called upon form submission.
   * Uses the throttled version of the `registerUser` method below.
   * @param {Event} e
   */
  onFormSubmit(e) {
    e.preventDefault();
    this.registerUserThrottled(e);
  }

  /**
   * Attempts to register a new user.
   * Starts by showing the loading animation of the button.
   * If registration was successful:
   *   Emits an event about what happened.
   * Otherwise:
   *   Shows any validation message(s).
   */
  registerUser() {
    this.undrawValidation(this.$username, this.$usernameLabel);

    /** Hide the button text. */
    this.$buttonText.classList.add("hidden");

    /** Show the loading animation of the button. */
    this.$buttonLoading.classList.remove("hidden");

    let username = this.$username.value.trim();

    let registerOperation = () => {
      /** Make an API call attempting to register a new user. */
      this.appWorker
        .postMessage({
          op: "registerUser",
          username: username
        })
        .then(response => {
          /** Hide the loading animation of the button. */
          this.$buttonLoading.classList.add("hidden");

          /** Show the button text. */
          this.$buttonText.classList.remove("hidden");

          let errors = response.errors;
          if (errors) {
            let errorUsername = errors.username;
            if (errorUsername) {
              this.drawValidation(
                errorUsername,
                this.$username,
                this.$usernameLabel
              );
            }

            return;
          }

          let user = response;
          let userRegisteredEvent = new CustomEvent("userRegistered", {
            detail: { user: user }
          });

          document.dispatchEvent(userRegisteredEvent);
        });
    };

    /** Give the loading animation half a second... (Doesn't look nice if it's too fast) */
    setTimeout(registerOperation, 5e2);
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

    let $span = document.createElement("span");

    $span.setAttribute("error-message", "");

    $span.textContent = `- ${validationMessage}`;

    $span.classList.add("text-xs", "font-normal", "italic", "tracking-wide");

    $label.appendChild($span);
  }

  /**
   * Removes a validation message from the `$label` and the error border from the `$input`.
   * @param {Element} $input
   * @param {Element} $label
   */
  undrawValidation($input, $label) {
    $input.classList.remove("border-red");

    $label.classList.remove("text-red");

    let $span = $label.querySelector("[error-message]");
    if ($span) {
      $span.parentNode.removeChild($span);
    }
  }
}
