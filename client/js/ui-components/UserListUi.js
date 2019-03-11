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

    this.onShowButtonClick = this.onShowButtonClick.bind(this);
    this.onOutsideClick = this.onOutsideClick.bind(this);
    this.onSocketUserConnected = this.onSocketUserConnected.bind(this);
    this.onSocketUserDisconnected = this.onSocketUserDisconnected.bind(this);

    this.showClass = "translate-self-right";
    this.showIconClass = "users-icon";
    this.hideIconClass = "x-sign-icon";

    /** Main DOM elements of component. */
    this.$users = document.getElementById("users");
    this.$showButton = document.getElementById("show-users-container-btn");
    this.$icon = this.$showButton.querySelector("div");
  }

  /**
   * Initializes the component, by setting up the show button click, outside click
   * and socket event listeners while drawing the list of current chat's users.
   */
  init() {
    this.$showButton.addEventListener("click", this.onShowButtonClick);
    document.addEventListener("click", this.onOutsideClick);

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

  /**
   * Called when the show button is clicked.
   * Shows/hides the component and swaps the icon.
   */
  onShowButtonClick() {
    this.$mainContainer.classList.toggle(this.showClass);
    this.$icon.classList.toggle(this.showIconClass);
    this.$icon.classList.toggle(this.hideIconClass);
  }

  /**
   * Called when a click on the outside of the component occurs.
   * Hides the component and swaps the icon.
   * @param {Event} e
   */
  onOutsideClick(e) {
    if (
      e.target.closest("#" + this.$mainContainer.id) === this.$mainContainer
    ) {
      return;
    }

    if (!this.$mainContainer.classList.contains(this.showClass)) {
      this.$mainContainer.classList.add(this.showClass);
    }

    if (this.$icon.classList.contains(this.hideIconClass)) {
      this.$icon.classList.remove(this.hideIconClass);
      this.$icon.classList.add(this.showIconClass);
    }
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
