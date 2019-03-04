/* global AppWorker, RegisterUi, LoginUi, AppUi */

(function() {
  class Main {
    constructor() {
      /** Creates the appWorker instance that UI components are going to use. */
      this.appWorker = new AppWorker(
        new Worker("/js/workers/thread/worker.js")
      );

      this.registerUi = new RegisterUi(this.appWorker);
      this.onUserRegistered = this.onUserRegistered.bind(this);

      this.logInUi = new LoginUi(this.appWorker);
      this.onUserLogInAttempt = this.onUserLogInAttempt.bind(this);

      /** Current user info that might exist in local storage. */
      this.user = JSON.parse(localStorage.getItem("user"));
    }

    /**
     * Called when the document is ready.
     * Inspired by jQuery.
     * @param {Function} eventHandler The function to be called.
     */
    static onDocumentReady(eventHandler) {
      if (document.readyState !== "loading") {
        eventHandler();
      } else {
        document.addEventListener("DOMContentLoaded", eventHandler);
      }
    }

    /**
     * Initializes the register and login components, also set ups listeners for their events.
     * If there is user info in local storage:
     *   Proceeds to log him in.
     * Otherwise:
     *   Shows the register component.
     */
    init() {
      this.registerUi.init();
      document.addEventListener("userRegistered", this.onUserRegistered);
      document.addEventListener("userLogInAttempt", this.onUserLogInAttempt);

      if (this.user) {
        this.logInUi.logInUser(this.user);
        return;
      }

      this.registerUi.show();
    }

    /**
     * Called upon successful registration of a user.
     * Proceeds to log him in.
     * @param {Event} e
     */
    onUserRegistered(e) {
      let user = e.detail.user;
      this.logInUi.logInUser(user);
    }

    /**
     * Called when attempting to log in a user.
     * If not successful:
     *   Shows the register component.
     * Otherwise:
     *   Removes the register component and the listeners, and initializes the main app component.
     * @param {Event} e
     */
    onUserLogInAttempt(e) {
      let userLoggedIn = e.detail.loggedIn;
      if (!userLoggedIn) {
        this.registerUi.show();
        return;
      }

      this.registerUi.remove();
      document.removeEventListener("userRegistered", this.onUserRegistered);
      document.removeEventListener("userLogInAttempt", this.onUserLogInAttempt);

      let user = e.detail.user;
      new AppUi(this.appWorker, user).init();
    }
  }

  Main.onDocumentReady(function() {
    new Main().init();
  });
})();
