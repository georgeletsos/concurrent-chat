const fs = require("fs");
const path = require("path");
const RouteManager = require("./RouteManager");

/** Class that registers all the static routes and handlers. */
module.exports = class StaticRouteManager extends RouteManager {
  constructor() {
    super();

    this.publicFolder = path.join(__dirname, "..", "..", "client");

    this.registerRoutes();
  }

  /**
   * Register all the static routes here.
   * Home/index route needs to be registered last.
   */
  registerRoutes() {
    this.get(
      /^(\/(?:js|css|img)\/[^/].+\.(?:js|css|svg))$/i,
      (req, res, filename) => this.streamStaticFile(res, filename)
    );

    this.get(/^.*$/i, (req, res) => this.streamIndexFile(res));
  }

  /**
   * Stream the home/index file.
   * @param {Response} res The HTTP response.
   */
  streamIndexFile(res) {
    let indexFile = path.join(this.publicFolder, "index.html");

    this.streamFile(res, indexFile);
  }

  /**
   * Stream a static file.
   * @param {Response} res The HTTP response.
   * @param {String} filePath The file and its parent folder.
   */
  streamStaticFile(res, filePath) {
    let file = path.join(this.publicFolder, filePath);

    this.streamFile(res, file);
  }

  /**
   * Stream a file by creating a stream to read the `file`,
   * and piping the `file` to the HTTP `res`.
   * @param {Response} res The HTTP response.
   * @param {String} file The full path of the file to serve.
   */
  streamFile(res, file) {
    let contentType = this.getContentType(file);
    res.writeHead(200, { "Content-Type": contentType });

    let stream = fs.createReadStream(file);

    stream.once("error", err => {
      /** If file was not found... */
      if (err.code === "ENOENT") {
        /** Just stream the home/index file. */
        this.streamIndexFile(res);
      }
    });

    /** End the response when there's no more input. */
    stream.once("end", () => {
      res.end();
    });

    stream.pipe(res);
  }

  /**
   * Get the correct content type based on the extension of the file.
   * @param {String} file The name of the file.
   * @returns {String} The content type.
   */
  getContentType(file) {
    let fileExtension = path.extname(file);

    switch (fileExtension.toLowerCase()) {
      case ".html":
        return "text/html";
      case ".js":
        return "application/javascript";
      case ".css":
        return "text/css";
      case ".svg":
        return "image/svg+xml";
      default:
        return "";
    }
  }
};
