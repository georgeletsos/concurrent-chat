/**
 * @typedef {Object} Route
 * @property {String} method
 * @property {RegExp} regexpUrl
 * @property {Function} routeHandler
 */

/**
 * @callback routeCallback
 * @param {Request} req
 * @param {Response} res
 * @param {String} regexpMatch
 */

/** Class representing a route. */
module.exports = class Route {
  /**
   * @param {String} method The HTTP method. Usualy get or post.
   * @param {RegExp} regexpUrl A RegExp the request url should match.
   * @param {routeCallback} routeHandler The callback to run.
   */
  constructor(method, regexpUrl, routeHandler) {
    this.method = method;
    this.regexpUrl = regexpUrl;
    this.routeHandler = routeHandler;
  }
};
