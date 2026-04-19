import { writeFile } from "node:fs/promises";
import { generateAsyncApi } from "tabletop-engine";
import { createSplendorGame } from "./game.ts";

const document = generateAsyncApi(createSplendorGame(), {
  title: "Splendor Hosted API",
  version: "0.1.0",
});

const outputPath = new URL("../asyncapi.json", import.meta.url);

await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
