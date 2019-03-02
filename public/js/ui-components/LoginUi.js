/* global UiComponent */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "LoginUi" }] */

/** Class representing the login component. */
class LoginUi extends UiComponent {
  /**
   * @param {AppWorker} appWorker The web worker instance of our main thread.
   */
  constructor(appWorker) {
    super(appWorker);
  }

  /**
   * Attempts to log in a user.
   * If successful:
   *   Saves the user info in local storage.
   * Otherwise:
   *   Removes any user info existing in local storage.
   * Finally emits an event about what happened.
   * @param {Object} user The user info object.
   * @param {String} user.id
   */
  async logInUser(user) {
    let loggedIn;

    try {
      /** Make an API call attempting to log in a user. */
      await this.appWorker.postMessage({
        op: "logInUser",
        userId: user.id
      });

      localStorage.setItem("user", JSON.stringify(user));

      loggedIn = true;
    } catch (error) {
      localStorage.removeItem("user");

      loggedIn = false;
    }

    let userLogInAttempt = new CustomEvent("userLogInAttempt", {
      detail: { loggedIn: loggedIn, user: user }
    });

    document.dispatchEvent(userLogInAttempt);
  }
}
