/* global UiComponent, AccountInfoUi, ChatListUi, MessageListUi, MessageFieldUi, UserListUi, InstructionsUi, CreateChatUi */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "AppUi" }] */

/** Class representing the main app component. */
class AppUi extends UiComponent {
  /**
   * @param {AppWorker} appWorker The web worker instance of our main thread.
   * @param {Object} user The user info object.
   */
  constructor(appWorker, user) {
    super(document.getElementById("app-container"), appWorker);

    this.user = user;

    /** The current chat id that comes from the page URL. */
    this.chatId = location.pathname.slice(1);

    this.onSocketConnected = this.onSocketConnected.bind(this);

    this.accountInfoUi = new AccountInfoUi(this.user);
    this.chatListUi = new ChatListUi(this.appWorker, this.chatId);
    this.messageListUi = new MessageListUi(
      this.appWorker,
      this.chatId,
      this.user
    );
    this.messageFieldUi = new MessageFieldUi(
      this.appWorker,
      this.chatId,
      this.user
    );
    this.userListUi = new UserListUi(this.appWorker, this.chatId);
    this.instructionsUi = new InstructionsUi();
    this.createChatUi = new CreateChatUi(this.appWorker, this.user);
  }

  /**
   * Initializes all of the components as needed.
   * Starts by showing the main app component and setting up socket event listeners.
   * Initializes the account info and the create chat components.
   * If there is no chat id on the page URL:
   *   Removes every other component other than the chat list and instructions, and initializes the chat list.
   * Otherwise:
   *   After initializing the chat list, checks if the chat id exists in that list.
   * If the chat id doesn't exist:
   *   Removes every other component other than the chat list and instructions, which houses the no-chat component.
   *   Also shows the no-chat component.
   * If the chat id exists: (under normal circumstances)
   *   Removes the instructions component and initializes the message list, the message field
   *   and the user list components. Finally attempts to open a socket connection between
   *   the user and the chat.
   */
  async init() {
    this.show();

    this.setUpSocketEventListeners();

    this.accountInfoUi.init();
    this.createChatUi.init();

    if (!this.chatId) {
      this.messageListUi.remove();
      this.userListUi.remove();
      this.instructionsUi.removeNoChatContainer();
      this.instructionsUi.show();

      this.chatListUi.init();
      return;
    }

    await this.chatListUi.init();

    let chatExists = await this.appWorker.api.postMessage({
      action: "checkIfChatExists",
      chatId: this.chatId
    });
    if (!chatExists) {
      this.messageListUi.remove();
      this.userListUi.remove();
      this.instructionsUi.showNoChatContainer();
      this.instructionsUi.show();
      return;
    }

    this.instructionsUi.remove();
    this.messageListUi.init();
    this.messageFieldUi.init();
    this.userListUi.init();

    this.appWorker.api.postMessage({
      action: "connectSocket",
      chatId: this.chatId,
      userId: this.user.id
    });
  }

  setUpSocketEventListeners() {
    document.addEventListener("socketConnected", this.onSocketConnected);
  }

  /**
   * Called upon successful socket connection.
   * Sets the title of the page.
   * @param {Event} e
   */
  onSocketConnected(e) {
    this.setTitle(e.detail.chatName);
  }

  /**
   * Sets the title of the page.
   * @param {String} chatName
   */
  setTitle(chatName) {
    document.title = "#" + chatName;
  }
}
