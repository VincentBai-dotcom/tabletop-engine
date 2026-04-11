import { describeGameProtocol } from "tabletop-engine";
import { success, type RunResult } from "../lib/command-result.ts";
import { createGenerationContext } from "../lib/generation-context.ts";
import { parseCommandArguments } from "../lib/parse-args.ts";
import { writeOutputFile } from "../lib/write-output.ts";

interface GenerateProtocolOptions {
  cwd: string;
}

export async function runGenerateProtocolCommand(
  args: string[],
  options: GenerateProtocolOptions,
): Promise<RunResult> {
  const parsed = parseCommandArguments(args);
  const context = await createGenerationContext(parsed, {
    cwd: options.cwd,
  });
  const protocol = describeGameProtocol(context.game);
  const outputPath = `${context.outputDirectory}/protocol.generated.json`;

  await writeOutputFile(outputPath, JSON.stringify(protocol, null, 2));

  return success(`generated protocol:${outputPath}`);
}
