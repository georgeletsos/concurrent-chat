const RouteManager = require("./RouteManager");

/** Class that registers all the auth routes and handlers. */
module.exports = class AuthRouteManager extends RouteManager {
  /**
   * @param {MainWorker} mainWorker Our mongoose instance.
   */
  constructor(mainWorker) {
    super(mainWorker);

    this.registerRoutes();
  }

  /**
   * Register all the auth routes here.
   */
  registerRoutes() {
    this.post(/^\/api\/auth\/register$/i, (req, res) =>
      this.registerUser(req, res)
    );

    this.post(/^\/api\/auth\/login$/i, (req, res) => this.loginUser(req, res));
  }

  /**
   * Passes the job of registering a new user to a worker.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @async
   */
  async registerUser(req, res) {
    let fields = await this.parseFormFields(req);

    this.mainWorker
      .send({
        op: "registerUser",
        username: fields.username
      })
      .then(message => {
        res.writeHead(message.statusCode, message.contentType);
        res.end(message.payload);
      });
  }

  /**
   * Passes the job of logging in a user to a worker.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @async
   */
  async loginUser(req, res) {
    let fields = await this.parseFormFields(req);

    this.mainWorker
      .send({
        op: "logInUser",
        userId: fields.userId
      })
      .then(message => {
        res.writeHead(message.statusCode, message.contentType);
        res.end(message.payload);
      });
  }
};
