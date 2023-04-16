import http from "http";
import fs from "fs";
import querystring from "querystring";
import buildAnimation from "../src/penguinbuilder.js";

export default class WebServer {
    constructor() {
        this.server = http.createServer();
    }

    get html() {
        return `
        <!DOCTYPE html>
<html>
  <head>
    <title>Input Form Example</title>
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
                let data = await buildAnimation({ items: string });
                response.writeHead(200, { "Content-Type": "text/html" });
                response.write(this.html);
                let files = fs
                    .readdirSync(`./output/${data}/`)
                    .filter((file) => file.endsWith(".gif"));
                files.forEach((file) => {
                    let image = fs.readFileSync(`./output/${data}/${file}`);
                    response.write(
                        `<img src="data:image/gif;base64,${image.toString(
                            "base64"
                        )}" style="width:10%;height:10%;">`
                    );
                });
                response.end();
            } catch (err) {
                response.writeHead(200, { "Content-Type": "text/html" });
                response.write(this.html);
                response.write(error.name);
                response.end();
            }
        });
    }
}
