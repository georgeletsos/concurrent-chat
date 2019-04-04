/* global UiComponent */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "InstructionsUi" }] */

/** Class representing the instructions component. */
class InstructionsUi extends UiComponent {
  constructor() {
    super(document.getElementById("instructions-container"));

    /** Main DOM elements of component. */
    this.$noChatContainer = document.getElementById("no-chat-container");
  }

  showNoChatContainer() {
    this.$noChatContainer.classList.remove("hidden");
  }

  removeNoChatContainer() {
    this.$noChatContainer.parentNode.removeChild(this.$noChatContainer);
  }
}
