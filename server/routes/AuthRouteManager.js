const RouteManager = require("./RouteManager");
const User = require("../models/User");

/** Class that registers all the auth routes and handlers. */
module.exports = class AuthRouteManager extends RouteManager {
  /**
   * @param {Mongoose} mongoose Our mongoose instance.
   */
  constructor(mongoose) {
    super(mongoose);

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
   * Register a new user and respond with the said user.
   * If any form fields are missing, respond with 400 and any validation message(s).
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @async
   */
  async registerUser(req, res) {
    let fields = await this.parseFormFields(req);
    let username = fields.username;

    if (!username) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ errors: { username: "This field is required" } })
      );
      return;
    }

    let latestUser = await User.getLatestUser();

    let tag = latestUser ? latestUser.tag + 1 : 1;

    let user = new User({
      name: username,
      tag: tag
    });
    await user.save();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(user.toClientJSON());
  }

  /**
   * Log a user in to the API, after finding the user in the database.
   * If any form fields are missing, respond with 400.
   * If the user was not found, respond with 404.
   * @param {Request} req The HTTP request.
   * @param {Response} res The HTTP response.
   * @async
   */
  async loginUser(req, res) {
    let fields = await this.parseFormFields(req);
    let userId = fields.userId;

    if (!userId || !this.mongoose.isValidObjectId(userId)) {
      res.writeHead(400);
      res.end(JSON.stringify({ errors: { params: "Missing parameters" } }));
      return;
    }

    let user = await User.findById(userId);
    if (!user) {
      res.writeHead(404);
      res.end(JSON.stringify({ errors: { user: "User not found" } }));
      return;
    }

    res.writeHead(200);
    res.end(user.toClientJSON());
  }
};
