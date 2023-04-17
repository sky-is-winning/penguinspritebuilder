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

    get html() {
        return `
        <!DOCTYPE html>
<html>
  <head>
    <title>Penguin Sprite Builder</title>
    <link href="//db.onlinewebfonts.com/c/771545ad3c588eace8fa2bb99d2c4e59?family=Burbank+Small" rel="stylesheet" type="text/css"/>
  </head>
  <body>
    <h1>Enter Item Details</h1>
    <form>
      <label for="background">Background:</label>
      <input type="text" id="background" name="background"><br>

      <label for="flag">Flag:</label>
      <input type="text" id="flag" name="flag"><br>

      <label for="color">Color:</label>
      <input type="text" id="color" name="color"><br>

      <label for="feet">Feet:</label>
      <input type="text" id="feet" name="feet"><br>

      <label for="body">Body:</label>
      <input type="text" id="body" name="body"><br>

      <label for="hand">Hand:</label>
      <input type="text" id="hand" name="hand"><br>

      <label for="neck">Neck:</label>
      <input type="text" id="neck" name="neck"><br>

      <label for="face">Face:</label>
      <input type="text" id="face" name="face"><br>

      <label for="head">Head:</label>
      <input type="text" id="head" name="head"><br>

      <input type="submit" value="Submit">
    </form>
    <script>
        document.querySelector("form").addEventListener("submit", (event) => {
            event.preventDefault();
            const formData = new FormData(event.target);
            const searchParams = new URLSearchParams();
            for (const pair of formData) {
                searchParams.append(pair[0], pair[1]);
            }
            window.location.href = window.location.origin + window.location.pathname + "?" + searchParams.toString();
        });
    </script>
    <style>
    @import url(//db.onlinewebfonts.com/c/771545ad3c588eace8fa2bb99d2c4e59?family=Burbank+Small);

    @font-face {font-family: "Burbank Small"; src: url("//db.onlinewebfonts.com/t/771545ad3c588eace8fa2bb99d2c4e59.eot"); src: url("//db.onlinewebfonts.com/t/771545ad3c588eace8fa2bb99d2c4e59.eot?#iefix") format("embedded-opentype"), url("//db.onlinewebfonts.com/t/771545ad3c588eace8fa2bb99d2c4e59.woff2") format("woff2"), url("//db.onlinewebfonts.com/t/771545ad3c588eace8fa2bb99d2c4e59.woff") format("woff"), url("//db.onlinewebfonts.com/t/771545ad3c588eace8fa2bb99d2c4e59.ttf") format("truetype"), url("//db.onlinewebfonts.com/t/771545ad3c588eace8fa2bb99d2c4e59.svg#Burbank Small") format("svg"); }

    body {
        text-align: center;
        font-family: "Burbank Small";
    }

    form {
        display: inline-block;
    }
    </style>
    </br>
  </body>
</html>
        `;
    }

    start() {
        this.server.listen(3000);

        this.server.on("request", async (request, response) => {
            if (request.url == "/") {
                response.writeHead(200, { "Content-Type": "text/html" });
                response.write(this.html);
                response.end();
                return;
            }
            
            if (request.url.startsWith("/?")) {
                let formData = querystring.parse(request.url.split("?")[1]);

                let string = Object.values(formData)
                    .filter((item) => item != "")
                    .join(",");
                
                if (!string || string == "") {
                    response.writeHead(200, { "Content-Type": "text/html" });
                    response.write(this.html);
                    response.end();
                    return;
                }

                try {
                    let sessionId = randomBytes(16).toString("hex");

                    response.writeHead(200, { "Content-Type": "text/html" });
                    response.write(this.html);

                    let frames = []
                    let endSessionTimeout
                    this.events.on(sessionId, (data) => {
                        clearTimeout(endSessionTimeout);

                        if (data.type == "start") {
                            frames.push(data.frame)
                        } else if (data.type == "progress") {
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
                    response.write(this.html);
                    response.write("<h1>An error occured</h1>");
                    response.end();
                }
            }
        });
    }
}
