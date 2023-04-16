import fs from "fs";
import sharp from "sharp";
import textureunpacker from "./textureunpacker.js";
import GIFEncoder from "gifencoder";
import pngFileStream from "png-file-stream";

const unpacker = new textureunpacker();

const paperItemDir = "./clothing/paper";
const spriteDir = "./clothing/sprites";
const outputDir = "./output";
const penguinDir = "./penguin";
const extractedDir = "./extracted";

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(extractedDir)) fs.mkdirSync(extractedDir);

const items = JSON.parse(fs.readFileSync("./crumbs/items.json"));
const secretFrames = JSON.parse(fs.readFileSync("./crumbs/secret_frames.json"));
const colors = JSON.parse(fs.readFileSync("./crumbs/colors.json"));

async function buildAnimation(options) {
    try {
        let penguinModel = {
            photo: 0,
            pin: 0,
            color: 1,
            feet: 0,
            body: 0,
            neck: 0,
            hand: 0,
            face: 0,
            head: 0,
        };

        options.items.split(",").forEach((item) => {
            let itemData = items[item];
            if (!itemData) return;
            penguinModel[itemData.type] =
                itemData.type != "color" ? parseInt(item) : colors[item];
        });

        if (options.customColor) {
            penguinModel.color = options.customColor;
        }

        if (!fs.existsSync(`${penguinDir}/paper/${penguinModel.color}.webp`)) {
            if (!(await generateColorPaper(penguinModel.color))) return;
        }

        let penguinArray = Object.values(penguinModel).filter(
            (item) => item != 0
        );

        let cacheString = penguinArray.join("_");

        if (fs.existsSync(`${outputDir}/${cacheString}`)) {
            return cacheString;
        }

        fs.mkdirSync(`${outputDir}/${cacheString}`);

        // Paper

        let bottomLayer = penguinArray.shift();
        sharp(
            typeof bottomLayer != "string"
                ? `${paperItemDir}/${bottomLayer}.webp`
                : `${penguinDir}/paper/${bottomLayer}.webp`
        )
            .composite(
                penguinArray.map((item) => {
                    if (typeof item == "string") {
                        return {
                            input: `${penguinDir}/paper/${item}.webp`,
                        };
                    }
                    return {
                        input: `${paperItemDir}/${item}.webp`,
                    };
                })
            )
            .toFile(`${outputDir}/${cacheString}/paper.gif`, (err, info) => {
                if (err) throw err;
            });

        // Sprites
        await unpack(bottomLayer);
        for (let item of penguinArray) {
            await unpack(item);
        }

        let frames = [];
        for (let i = 1; i <= 26; i++) {
            if (i == 25 || i == 26) {
                let isSecret = false;
                secretFrames[i].forEach((frame) => {
                    for (let i in frame) {
                        if (penguinModel[i] && penguinModel[i] != frame[i]) {
                            return;
                        }
                    }
                    frames.push(frame.secret_frame);
                    isSecret = true;
                    return;
                });
                if (!isSecret) {
                    frames.push(i);
                }
            } else {
                frames.push(i);
            }
        }

        let framesLeft = frames.length;

        for (let frame of frames) {
            let complete = await processFrame(frame, penguinModel, cacheString);
            if (complete) {
                console.log(`Frame ${frame} complete`);
                framesLeft--;
            }
            if (framesLeft == 0) {
                return cacheString;
            }
        }
    } catch (err) {
        console.error(error);
    }
}

async function processFrame(frame, penguinModel, cacheString) {
    try {
        delete penguinModel.pin;
        delete penguinModel.photo;

        let penguinArray = Object.values(penguinModel).filter(
            (item) => item != 0
        );
        let frameList = [];
        for (let item of penguinArray) {
            if (typeof item == "string") {
                item = "penguin/body";
                if (frame > 26) {
                    if (!fs.existsSync(`${extractedDir}/penguin/${frame}`))
                        await unpackSecretFrames(frame);
                    item = `penguin/${frame}/body`;
                }
            }
            let frames = fs
                .readdirSync(`${extractedDir}/${item}`)
                .filter((file) => file.startsWith(frame));
            if (frames.length == 0) {
                console.log(`No frame ${frame} for ${item}`);
                return;
            }
            if (frameList.length == 0) {
                frameList = frames;
            } else {
                frameList = frameList.filter((frame) => frames.includes(frame));
            }
        }

        if (frameList.length == 0) {
            console.log(`No frames for ${frame} with items ${penguinArray}`);
            return;
        }

        let i = 0;
        return await processSubframe(frameList[i]);
        async function processSubframe(f) {
            try {
                f = f.split(".")[0];
                let image = await tint(
                    frame > 26
                        ? `${extractedDir}/penguin/${frame}/body/${f}.png`
                        : `${extractedDir}/penguin/body/${f}.png`,
                    penguinModel.color
                );
                let filename = f.toString();
                while (filename.split("_")[1].length < 4) {
                    filename =
                        filename.split("_")[0] +
                        "_" +
                        "0" +
                        filename.split("_")[1];
                }
                await sharp(image[0], image[1])
                    .composite(
                        penguinArray.map((item) => {
                            if (typeof item == "string") {
                                item =
                                    frame > 26
                                        ? `penguin/${frame}/penguin`
                                        : "penguin/penguin";
                            }
                            return {
                                input: `${extractedDir}/${item}/${f}.png`,
                            };
                        })
                    )
                    .toFile(`${outputDir}/${cacheString}/${filename}.png`)
                    .then(async () => {
                        frameList[i] = filename + ".png";
                        i++;
                        if (i < frameList.length) {
                            return await processSubframe(frameList[i]);
                        } else {
                            return await createGif();
                        }
                    });
            } catch (err) {
                console.error(error);
            }
        }

        async function createGif() {
            try {
                if (frameList.length == 1) {
                    sharp(`${outputDir}/${cacheString}/${frameList[0]}`).toFile(
                        `${outputDir}/${cacheString}/${frame}.gif`
                    );
                    return;
                }

                const encoder = new GIFEncoder(400, 400);
                encoder.setTransparent(0x00000000);
                const stream = pngFileStream(
                    `${outputDir}/${cacheString}/${frame}_????.png`
                )
                    .pipe(
                        encoder.createWriteStream({
                            repeat: 0,
                            delay: 42,
                            quality: 10,
                        })
                    )
                    .pipe(
                        fs.createWriteStream(
                            `${outputDir}/${cacheString}/${frame}.gif`
                        )
                    );

                stream.on("finish", () => {
                    for (let file of frameList) {
                        try {
                            fs.unlinkSync(
                                `${outputDir}/${cacheString}/${file}`
                            );
                        } catch (err) {}
                    }
                    return true;
                });
            } catch (err) {
                console.error(error);
            }
        }
    } catch (err) {
        console.error(error);
    }
}

async function unpack(item) {
    try {
        if (fs.existsSync(`${extractedDir}/${item}`)) {
            return true;
        }
        if (typeof item == "string") {
            if (fs.existsSync(`${extractedDir}/penguin`)) {
                return true;
            }
            await unpacker.readAtlas(`penguin.json`, {
                sourcedir: penguinDir,
                outputdir: `${extractedDir}/penguin`,
            });
            return true;
        }
        await unpacker.readAtlas(`${item}.json`, {
            sourcedir: spriteDir,
            outputdir: `${extractedDir}/${item}`,
        });
        return true;
    } catch (err) {
        console.error(error);
    }
}

async function unpackSecretFrames(frame) {
    try {
        await unpacker.readAtlas(`${frame}.json`, {
            sourcedir: `${penguinDir}/actions`,
            outputdir: `${extractedDir}/penguin/${frame}`,
        });
    } catch (err) {
        console.error(error);
    }
}

async function tint(image, color) {
    try {
        const { data, info } = await sharp(image)
            .raw()
            .toBuffer({ resolveWithObject: true });

        const pixelArray = new Uint8ClampedArray(data.buffer);

        if (!color) return false;

        for (let i = 0; i < pixelArray.length; i += 4) {
            pixelArray[i] = parseInt(color.substring(1, 3), 16);
            pixelArray[i + 1] = parseInt(color.substring(3, 5), 16);
            pixelArray[i + 2] = parseInt(color.substring(5, 7), 16);
        }

        const { width, height, channels } = info;

        return [pixelArray, { raw: { width, height, channels } }];
    } catch (err) {
        console.error(error);
    }
}

async function generateColorPaper(color) {
    try {
        let image = tint(`${penguinDir}/body.png`, color);

        if (!image) return false;

        image = await sharp(image[0], image[1])
            .composite([
                {
                    input: `${penguinDir}/paperdoll.png`,
                },
            ])
            .extend({
                top: 80,
                bottom: 80,
                left: 80,
                right: 80,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toFile(`${penguinDir}/paper/${color}.webp`);
        return true;
    } catch (err) {
        console.error(error);
    }
}

export default buildAnimation;
