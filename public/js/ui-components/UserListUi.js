/* global UiComponent */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "UserListUi" }] */

/** Class representing the user list component. */
class UserListUi extends UiComponent {
  /**
   * @param {AppWorker} appWorker The web worker instance of our main thread.
   * @param {String} chatId The current chat id that comes from the page URL.
   */
  constructor(appWorker, chatId) {
    super(document.getElementById("users-container"), appWorker);

    this.chatId = chatId;

    this.onSocketUserConnected = this.onSocketUserConnected.bind(this);
    this.onSocketUserDisconnected = this.onSocketUserDisconnected.bind(this);

    /** Main DOM elements of component. */
    this.$users = document.getElementById("users");
  }

  /**
   * Initializes the component, by setting up socket event listeners
   * and drawing the list of current chat's users.
   */
  init() {
    this.setUpSocketEventListeners();

    /** Make an API call to get the list of current chat's users. */
    this.appWorker
      .postMessage({
        op: "getChatUsers",
        chatId: this.chatId
      })
      .then(users => {
        this.drawUsers(users);
        this.show();
      });
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
  }

  /**
   * Called when the socket informs that a user has been connected.
   * Draws that user in the list, in the appropriate position.
   * @param {Event} e
   */
  onSocketUserConnected(e) {
    let user = e.detail.user;
    let nextUser = e.detail.nextUser;

    if (nextUser) {
      this.drawUserAfter(user, nextUser);
      return;
    }

    this.drawUsers([user]);
  }

  /**
   * Called when the socket informs that a user has been disconnected.
   * Removes that user from the list.
   * @param {Event} e
   */
  onSocketUserDisconnected(e) {
    this.undrawUser(e.detail.user);
  }

  /**
   * Draws a list of users.
   * @param {Object[]} users A list of users.
   */
  drawUsers(users) {
    for (let user of users) {
      let $user = this.createUserEl(user);
      this.$users.appendChild($user);
    }
  }

  /**
   * Creates an element that houses a user.
   * @param {Object} user
   * @param {String} user.id
   * @param {String} user.name
   * @param {Number} user.tag
   * @returns {Element}
   */
  createUserEl(user) {
    let $li = document.createElement("li");

    $li.classList.add("py-2", "text-base", "text-grey-lighter");

    $li.setAttribute("user-id", user.id);

    $li.textContent = `${user.name} #${user.tag}`;

    return $li;
  }

  /**
   * Draws a user just before another user.
   * @param {Object} user The user to be drawn.
   * @param {Object} nextUser The next user in line.
   */
  drawUserAfter(user, nextUser) {
    let $nextUser = this.$users.querySelector(`[user-id="${nextUser.id}"]`);
    if ($nextUser) {
      let $user = this.createUserEl(user);
      $nextUser.parentNode.insertBefore($user, $nextUser);
    }
  }

  /**
   * Removes a user from the list.
   * @param {Object} user
   */
  undrawUser(user) {
    let $user = this.$users.querySelector(`[user-id="${user.id}"]`);
    if ($user) {
      $user.parentNode.removeChild($user);
    }
  }
}
