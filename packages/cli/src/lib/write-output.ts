import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeOutputFile(
  filePath: string,
  contents: string,
): Promise<void> {
  await mkdir(dirname(filePath), {
    recursive: true,
  });
  await writeFile(filePath, contents, "utf8");
}
