import { describeGameProtocol } from "tabletop-engine";
import { success, type RunResult } from "../lib/command-result.ts";
import { createGenerationContext } from "../lib/generation-context.ts";
import { parseCommandArguments } from "../lib/parse-args.ts";
import {
  renderSchemaTypeString,
  renderTypeDeclaration,
} from "../lib/render-typescript.ts";
import { writeOutputFile } from "../lib/write-output.ts";

interface GenerateClientSdkOptions {
  cwd: string;
}

export async function runGenerateClientSdkCommand(
  args: string[],
  options: GenerateClientSdkOptions,
): Promise<RunResult> {
  const parsed = parseCommandArguments(args);
  const context = await createGenerationContext(parsed, {
    cwd: options.cwd,
  });
  const protocol = describeGameProtocol(context.game);
  const canonicalSchema = {
    type: "object",
    properties: {
      game: context.game.canonicalGameStateSchema.schema,
      runtime: context.game.runtimeStateSchema,
    },
    required: ["game", "runtime"],
  } as const;
  const commandUnion = Object.entries(protocol.commands)
    .map(([commandId, command]) => {
      return `{
  type: ${JSON.stringify(commandId)};
  actorId: string;
  input: ${renderSchemaTypeString(command.commandSchema.schema as Record<string, unknown>)};
}`;
    })
    .join(" |\n");
  const discoveryUnion = Object.entries(protocol.commands)
    .filter(([, command]) => command.discoverySchema)
    .map(([commandId, command]) => {
      return `{
  type: ${JSON.stringify(commandId)};
  actorId: string;
  input: ${renderSchemaTypeString(command.discoverySchema!.schema as Record<string, unknown>)};
}`;
    })
    .join(" |\n");
  const output = [
    renderTypeDeclaration("CanonicalState", canonicalSchema),
    renderTypeDeclaration(
      "VisibleState",
      protocol.viewSchema as Record<string, unknown>,
    ),
    `export type CommandRequest = ${commandUnion || "never"};\n`,
    `export type DiscoveryRequest = ${discoveryUnion || "never"};\n`,
    [
      "export interface GameClientSdk {",
      "  getVisibleState(): Promise<VisibleState>;",
      "  submitCommand(command: CommandRequest): Promise<CanonicalState>;",
      "  discover(request: DiscoveryRequest): Promise<unknown>;",
      "}",
      "",
    ].join("\n"),
  ].join("\n");
  const outputPath = `${context.outputDirectory}/client-sdk.generated.ts`;

  await writeOutputFile(outputPath, output);

  return success(`generated client sdk:${outputPath}`);
}
