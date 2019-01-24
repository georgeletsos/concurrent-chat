/* global AppUi */

/**
 * Event listener for when the document is ready.
 * Inspired by jQuery.
 * @param {Function} eventHandler The function to be called.
 */
const onDocumentReady = function(eventHandler) {
  if (document.readyState !== "loading") {
    eventHandler();
  } else {
    document.addEventListener("DOMContentLoaded", eventHandler);
  }
};

/** When the document is ready... */
onDocumentReady(function() {
  /** If there's no user found in local storage... */
  if (!AppUi.user) {
    /** Finish here by initializing the register user UI. */
    AppUi.initRegister();

    return;
  }

  /** Otherwise, under normal circumstances, initialize the app UI. */
  AppUi.initApp();
});
