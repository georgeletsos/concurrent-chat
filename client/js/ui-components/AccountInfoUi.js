/* global UiComponent */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "AccountInfoUi" }] */

/** Class representing the account info component. */
class AccountInfoUi extends UiComponent {
  /**
   * @param {Object} user The user info object.
   */
  constructor(user) {
    super();

    this.user = user;

    /** Main DOM elements of component. */
    this.$accountUsername = document.getElementById("account-username");
    this.$accountTag = document.getElementById("account-tag");
  }

  /**
   * Initializes the component by drawing the current user account info.
   */
  init() {
    this.drawAccountInfo();
  }

  drawAccountInfo() {
    let { name, tag } = this.user;
    this.$accountUsername.textContent = name;
    this.$accountTag.textContent = "#" + tag;
  }
}
