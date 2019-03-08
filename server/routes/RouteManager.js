const Route = require("./Route");
const Formidable = require("formidable");

/** Class that registers routes and handlers. */
module.exports = class RouteManager {
  /**
   * @param {MainWorkerPool} mainWorkerPool Our mainWorkerPool instance.
   * @param {Socket} socket Our socket instance.
   */
  constructor(mainWorkerPool, socket) {
    this.mainWorkerPool = mainWorkerPool;
    this.socket = socket;

    /**
     * List of Routes.
     * @type {Route[]}
     */
    this.routes = [];
  }

  /**
   * Register a new GET route.
   * @param {RegExp} regexpUrl A RegExp the request url should match.
   * @param {routeCallback} routeHandler The callback to run.
   */
  get(regexpUrl, routeHandler) {
    this.routes.push(new Route("get", regexpUrl, routeHandler));
  }

  /**
   * Register a new POST route.
   * @param {RegExp} regexpUrl A RegExp the request url should match.
   * @param {routeCallback} routeHandler The callback to run.
   */
  post(regexpUrl, routeHandler) {
    this.routes.push(new Route("post", regexpUrl, routeHandler));
  }

  /**
   * Use the IncomingForm class from the formidable library to parse the form data of a request.
   * @param {Request} req The HTTP request.
   * @returns {Promise<Fields>} A promise that is resolved with the parsed form data.
   */
  parseFormFields(req) {
    return new Promise((resolve, reject) => {
      new Formidable.IncomingForm().parse(req, (error, fields) => {
        if (error) {
          reject(error);
        } else {
          resolve(fields);
        }
      });
    });
  }
};
