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
  const commandTypeAliases = renderCommandTypeAliases(protocol.commands);
  const discoveryStartHelpers = renderDiscoveryStartHelpers(protocol.commands);
  const commandUnion = renderCommandRequestUnion(protocol.commands);
  const discoveryRequestUnion = renderDiscoveryRequestUnion(protocol.commands);
  const discoveryResultUnion = renderDiscoveryResultUnion(protocol.commands);
  const output = [
    renderTypeDeclaration(
      "VisibleState",
      protocol.viewSchema as Record<string, unknown>,
    ),
    commandTypeAliases,
    `export type CommandRequest = ${commandUnion || "never"};\n`,
    `export type DiscoveryRequest = ${discoveryRequestUnion || "never"};\n`,
    `export type DiscoveryResult = ${discoveryResultUnion || "never"};\n`,
    discoveryStartHelpers,
  ].join("\n");
  const outputPath = `${context.outputDirectory}/client-sdk.generated.ts`;

  await writeOutputFile(outputPath, output);

  return success(`generated client sdk:${outputPath}`);
}

function renderCommandTypeAliases(
  commands: Record<
    string,
    {
      commandSchema: { schema?: Record<string, unknown> };
      discovery?: DiscoveryDescriptor;
    }
  >,
): string {
  return Object.entries(commands)
    .flatMap(([commandId, command]) => {
      const typeName = toPascalCase(commandId);
      const commandRequest = renderCommandRequestType(commandId, command);
      const aliases = [
        `export type ${typeName}CommandRequest = ${commandRequest};\n`,
      ];

      if (command.discovery) {
        const discoveryRequest = renderDiscoveryRequestType(
          commandId,
          command.discovery,
        );
        const discoveryResult = renderDiscoveryResultType(command);

        aliases.push(
          `export type ${typeName}DiscoveryRequest = ${discoveryRequest};\n`,
          `export type ${typeName}DiscoveryResult = ${discoveryResult};\n`,
        );
      }

      return aliases;
    })
    .join("\n");
}

function renderCommandRequestUnion(
  commands: Record<
    string,
    { commandSchema: { schema?: Record<string, unknown> } }
  >,
): string {
  return renderUnion(
    Object.keys(commands).map(
      (commandId) => `${toPascalCase(commandId)}CommandRequest`,
    ),
  );
}

interface DiscoveryStepDescriptor {
  stepId: string;
  inputSchema: { schema?: Record<string, unknown> };
  outputSchema: { schema?: Record<string, unknown> };
  defaultNextStep?: string;
}

interface DiscoveryDescriptor {
  startStep: string;
  steps: DiscoveryStepDescriptor[];
}

function renderDiscoveryRequestUnion(
  commands: Record<
    string,
    {
      commandSchema: { schema?: Record<string, unknown> };
      discovery?: DiscoveryDescriptor;
    }
  >,
): string {
  return renderUnion(
    Object.entries(commands).flatMap(([commandId, command]) =>
      command.discovery ? [`${toPascalCase(commandId)}DiscoveryRequest`] : [],
    ),
  );
}

function renderDiscoveryResultUnion(
  commands: Record<
    string,
    {
      commandSchema: { schema?: Record<string, unknown> };
      discovery?: DiscoveryDescriptor;
    }
  >,
): string {
  return renderUnion(
    Object.entries(commands).flatMap(([commandId, command]) =>
      command.discovery ? [`${toPascalCase(commandId)}DiscoveryResult`] : [],
    ),
  );
}

function renderCommandRequestType(
  commandId: string,
  command: { commandSchema: { schema?: Record<string, unknown> } },
): string {
  const commandSchema = command.commandSchema.schema as Record<string, unknown>;

  return `{
  type: ${JSON.stringify(commandId)};
  actorId: string;
  input: ${renderSchemaTypeString(commandSchema)};
}`;
}

function renderDiscoveryRequestType(
  commandId: string,
  discovery: DiscoveryDescriptor,
): string {
  return renderUnion(
    discovery.steps.map((step) => {
      const inputSchema = step.inputSchema.schema as Record<string, unknown>;

      return `{
  type: ${JSON.stringify(commandId)};
  actorId: string;
  step: ${JSON.stringify(step.stepId)};
  input: ${renderSchemaTypeString(inputSchema)};
}`;
    }),
  );
}

function renderDiscoveryResultType(command: {
  commandSchema: { schema?: Record<string, unknown> };
  discovery?: DiscoveryDescriptor;
}): string {
  const discovery = command.discovery;

  if (!discovery) {
    return "never";
  }

  const stepIdType = renderStringLiteralUnion(
    discovery.steps.map((step) => step.stepId),
  );
  const stepInputType = renderUnion(
    discovery.steps.map((step) =>
      renderSchemaTypeString(
        step.inputSchema.schema as Record<string, unknown>,
      ),
    ),
  );
  const completeResult = `{
  complete: true;
  input: ${renderSchemaTypeString(
    command.commandSchema.schema as Record<string, unknown>,
  )};
}`;

  const stepResults = discovery.steps.map((step) => {
    const outputSchema = step.outputSchema.schema as Record<string, unknown>;

    return `{
  complete: false;
  step: ${JSON.stringify(step.stepId)};
  options: Array<{
    id: string;
    output: ${renderSchemaTypeString(outputSchema)};
    nextStep: ${stepIdType};
    nextInput: ${stepInputType};
  }>;
}`;
  });

  return renderUnion([...stepResults, completeResult]);
}

function renderDiscoveryStartHelpers(
  commands: Record<
    string,
    {
      commandSchema: { schema?: Record<string, unknown> };
      discovery?: DiscoveryDescriptor;
    }
  >,
): string {
  return Object.entries(commands)
    .flatMap(([commandId, command]) => {
      if (!command.discovery) {
        return [];
      }

      const pascalName = toPascalCase(commandId);
      const camelName = toCamelCase(commandId);
      const startStep = command.discovery.startStep;

      return [
        `export type ${pascalName}DiscoveryStart = Omit<Extract<${pascalName}DiscoveryRequest, { step: ${JSON.stringify(
          startStep,
        )} }>, "actorId">;\n`,
        `export const ${camelName}DiscoveryStart = {
  type: ${JSON.stringify(commandId)},
  step: ${JSON.stringify(startStep)},
  input: {},
} satisfies ${pascalName}DiscoveryStart;\n`,
      ];
    })
    .join("\n");
}

function renderUnion(members: string[]): string {
  if (members.length === 0) {
    return "";
  }

  return members.join(" |\n");
}

function renderStringLiteralUnion(values: string[]): string {
  return values.map((value) => JSON.stringify(value)).join(" | ") || "never";
}

function toPascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`)
    .join("");
}

function toCamelCase(value: string): string {
  const pascalCase = toPascalCase(value);
  return `${pascalCase[0]!.toLowerCase()}${pascalCase.slice(1)}`;
}
