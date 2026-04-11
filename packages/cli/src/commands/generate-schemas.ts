import { describeGameProtocol } from "tabletop-engine";
import { success, type RunResult } from "../lib/command-result.ts";
import { createGenerationContext } from "../lib/generation-context.ts";
import { parseCommandArguments } from "../lib/parse-args.ts";
import { writeOutputFile } from "../lib/write-output.ts";

interface GenerateSchemasOptions {
  cwd: string;
}

export async function runGenerateSchemasCommand(
  args: string[],
  options: GenerateSchemasOptions,
): Promise<RunResult> {
  const parsed = parseCommandArguments(args);
  const context = await createGenerationContext(parsed, {
    cwd: options.cwd,
  });
  const protocol = describeGameProtocol(context.game);
  const outputPath = `${context.outputDirectory}/schemas.generated.json`;

  const generated = {
    canonicalState: {
      type: "object",
      properties: {
        game: context.game.canonicalGameStateSchema.schema,
        runtime: context.game.runtimeStateSchema,
      },
      required: ["game", "runtime"],
      additionalProperties: false,
    },
    visibleState: protocol.viewSchema,
    commands: Object.fromEntries(
      Object.entries(protocol.commands).map(([commandId, command]) => [
        commandId,
        command.commandSchema.schema,
      ]),
    ),
    discoveries: Object.fromEntries(
      Object.entries(protocol.commands)
        .filter(([, command]) => command.discoverySchema)
        .map(([commandId, command]) => [
          commandId,
          command.discoverySchema!.schema,
        ]),
    ),
  };

  await writeOutputFile(outputPath, JSON.stringify(generated, null, 2));

  return success(`generated schemas:${outputPath}`);
}
