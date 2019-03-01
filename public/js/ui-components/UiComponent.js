/* global AppWorker */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "UiComponent" }] */

/** Class representing a UI component. */
class UiComponent {
  /**
   * @param {Element} [$mainContainer] The main DOM element of the component.
   * @param {AppWorker} [appWorker] The web worker instance of our main thread.
   */
  constructor($mainContainer, appWorker) {
    if ($mainContainer instanceof AppWorker) {
      this.appWorker = $mainContainer;
    } else {
      this.$mainContainer = $mainContainer;
      this.appWorker = appWorker;
    }
  }

  /**
   * Shows the component in the DOM.
   */
  show() {
    this.$mainContainer.classList.remove("hidden");
  }

  /**
   * Removes the component from the DOM.
   */
  remove() {
    this.$mainContainer.parentNode.removeChild(this.$mainContainer);
  }

  /**
   * Initializes the component.
   * Meant to be overriden.
   */
  init() {}

  /**
   * Set ups socket event listeners.
   * Meant to be overriden.
   */
  setUpSocketEventListeners() {}
}
