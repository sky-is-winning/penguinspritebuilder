import http from "http";
import fs from "fs";
import querystring from "querystring";
import buildAnimation from "../src/penguinbuilder.js";
import { EventEmitter } from "events";
import { randomBytes } from "crypto";

export default class WebServer {
    constructor() {
        this.server = http.createServer();
        this.events = new EventEmitter();
    }

    get indexhtml() {
        return fs.readFileSync("./html/index.html").toString();
    }

    get html404() {
        return fs.readFileSync("./html/404.html").toString();
    }

    start() {
        this.server.listen(3000);

        this.server.on("request", async (request, response) => {
            if (request.url == "/") {
                response.writeHead(200, { "Content-Type": "text/html" });
                response.write(this.indexhtml);
                response.end();
                return;
            } else if (request.url.startsWith("/?")) {
                let formData = querystring.parse(request.url.split("?")[1]);

                let string = Object.values(formData)
                    .filter((item) => item != "")
                    .join(",");
                
                if (!string || string == "") {
                    response.writeHead(200, { "Content-Type": "text/html" });
                    response.write(this.indexhtml);
                    response.end();
                    return;
                }

                try {
                    let sessionId = randomBytes(16).toString("hex");

                    response.writeHead(200, { "Content-Type": "text/html" });
                    response.write(this.indexhtml);

                    let frames = []
                    let endSessionTimeout
                    this.events.on(sessionId, (data) => {
                        clearTimeout(endSessionTimeout);

                        if (data.type == "start") {
                            frames.push(data.frame)
                        } else if (data.type == "progress") {
                            if (!fs.existsSync(data.file)) return;
                            let image = fs.readFileSync(data.file)
                            response.write(
                                `<img src="data:image/gif;base64,${image.toString(
                                    "base64"
                                )}" style="width:10%;height:10%;">`
                            );
                            frames = frames.filter((frame) => frame != data.frame)

                            if (frames.length == 0) {
                                endSessionTimeout = setTimeout(() => {
                                    response.end();
                                }, 1000);
                            }
                        } else if (data.type == "error") {
                            response.write(`<h1>An error occured</h1>`);
                            response.end();
                        }
                    });

                    await buildAnimation({ items: string }, sessionId, this.events);

                } catch (err) {
                    response.writeHead(200, { "Content-Type": "text/html" });
                    response.write(this.indexhtml);
                    response.write("<h1>An error occured</h1>");
                    response.end();
                }
            } else {
                response.writeHead(404, { "Content-Type": "text/html" });
                response.write(this.html404)
                response.end();
            }
        });
    }
}
