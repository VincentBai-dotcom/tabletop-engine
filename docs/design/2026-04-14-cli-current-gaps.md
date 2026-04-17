# CLI Current Gaps

## Purpose

This document records the current functionality gaps in `packages/cli` based on
the implementation on `main` as of April 14, 2026.

The CLI is no longer just scaffold. It has working commands for:

- `generate types`
- `generate schemas`
- `generate protocol`
- `generate client-sdk`
- `validate`

However, several parts are still first-pass implementations rather than stable
product surfaces.

## Gap 1: Runtime Setup Input Is Still Not CLI-Addressable

Current implementation is config-driven through
[load-config.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/lib/load-config.ts),
and command execution reads a built game definition from `tabletop.config.ts`
rather than guessing a game export from a module path.

Problem:

- the engine now correctly models session setup through
  `setupInput(t.object(...))` and `createInitialState(input, rngSeed)`
- the CLI can generate static artifacts directly from a built game definition
- but the CLI still has no way to supply runtime setup input for:
  - snapshot creation
  - scenario validation
  - future artifact generation that needs a concrete initialized session

Why this matters:

- the previous hidden guessing behavior is gone, which is correct
- but the CLI still cannot drive games that require concrete setup input without
  hand-written external code
- validation and generation commands still lack an explicit session-input
  contract

What is missing:

- explicit CLI support for session setup input
- explicit CLI support for the required `rngSeed`
- a clear distinction between:
  - building/loading a game definition
  - initializing a concrete session from that definition

Likely direction:

- add explicit runtime-input options such as:
  - `--seed`
  - `--input <file>`
- validate those against the engine-declared `setupInput` schema before
  invoking session-oriented CLI flows

## Gap 2: Protocol Generation Dumps Raw Engine Descriptor

Current implementation in [generate-protocol.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/commands/generate-protocol.ts#L19):

```ts
const protocol = describeGameProtocol(context.game);
const outputPath = `${context.outputDirectory}/protocol.generated.json`;

await writeOutputFile(outputPath, JSON.stringify(protocol, null, 2));
```

Problem:

- `describeGameProtocol(...)` is an engine descriptor, not necessarily a clean
  external artifact format
- the CLI currently writes that object directly without a materialization step

Why this matters:

- a generated file called `protocol.generated.json` implies a stable public
  artifact
- the current output is tied closely to the engine descriptor shape rather than
  a separately curated public format
- future consumers may depend on details that were never meant to be stable

What is missing:

- a normalization/materialization layer between engine descriptor and output
- a clear contract for what `protocol.generated.json` is supposed to be
  semantically

Likely direction:

- define an explicit generated protocol artifact shape
- generate that artifact from `describeGameProtocol(...)`, rather than dumping
  the raw descriptor

## Gap 3: Client SDK Generation Is Still a Type Stub Emitter

Current implementation in [generate-client-sdk.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/commands/generate-client-sdk.ts#L23):

```ts
const protocol = describeGameProtocol(context.game);
const canonicalSchema = {
  type: "object",
  properties: {
    game: context.game.canonicalGameStateSchema.schema,
    runtime: context.game.runtimeStateSchema,
  },
  required: ["game", "runtime"],
} as const;
```

And later in the same file [generate-client-sdk.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/commands/generate-client-sdk.ts#L51):

```ts
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
```

Problem:

- the output is useful as a type declaration surface
- but it is not a full SDK in any meaningful runtime sense
- `discover(...)` still returns `Promise<unknown>`

Why this matters:

- the command name `generate client-sdk` suggests more than type aliases and an
  interface shell
- the current output is closer to:
  - generated protocol client types
    than:
  - a usable SDK surface

What is missing:

- typed discovery result generation
- a clearer split between:
  - generated types
  - generated client interface contracts
  - any future transport helpers

Likely direction:

- either rename/scope this output more narrowly
- or deepen it into a true client-facing generated surface

## Gap 4: Validation Scope Is Narrow

Current implementation in [validate.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/commands/validate.ts#L27):

```ts
const messages = [`validated game:${context.game.name}`];

if (parsed.snapshotPath) {
  const snapshot = JSON.parse(await readFile(parsed.snapshotPath, "utf8")) as {
    game: unknown;
    runtime: unknown;
  };

  assertSchemaValue(context.game.canonicalGameStateSchema, snapshot.game);
  assertSchemaValue(context.game.runtimeStateSchema, snapshot.runtime);
  messages.push(`validated snapshot:${parsed.snapshotPath}`);
}
```

Problem:

- `validate` currently validates:
  - the game definition can be loaded/built
  - an optional snapshot
- it does not yet validate:
  - replay records
  - scenario fixtures
  - generated artifacts
  - protocol outputs

Why this matters:

- the design doc positioned validation as broader tooling
- the implemented command is useful but much narrower than the design implies

What is missing:

- explicit replay validation
- fixture validation
- possibly schema/protocol artifact validation where applicable

Likely direction:

- extend argument parsing and validation contexts
- keep snapshot validation as one mode of a broader `validate` command

## Gap 5: Argument Model Is Still Minimal

Current parser in [parse-args.ts](/home/vincent-bai/Documents/github/tabletop-kernel/packages/cli/src/lib/parse-args.ts#L5):

```ts
export interface ParsedCommandArguments {
  configPath?: string;
  outDir?: string;
  snapshotPath?: string;
}
```

Problem:

- only a very small set of flags is supported
- there is no structured way to provide:
  - game factory inputs
  - generation presets
  - output naming/package options
  - replay validation inputs

Why this matters:

- this keeps the CLI simple, but it still leaves session-oriented input flows
  underspecified
- the config-file shift fixed the old `--game` / `--export` inference problem,
  but it did not yet add a structured model for richer validation or generation
  inputs

What is missing:

- richer generation/validation inputs
- session-input options
- output/package presets if client generation grows

Likely direction:

- keep core flags stable:
  - `--config`
  - `--outDir`
- add explicit build/validation inputs rather than hidden defaults

## Gap 6: The Current Implementation Falls Short of the Original Design Doc

The earlier CLI design in
[2026-04-10-cli-artifact-generation-design.md](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-10-cli-artifact-generation-design.md)
set a broader target than what is currently implemented.

Examples:

1. Validation scope

The design says validation should cover snapshots, replay records, and generated
artifacts at
[2026-04-10-cli-artifact-generation-design.md#L167](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-10-cli-artifact-generation-design.md#L167),
but current `validate` only handles game loading and snapshots.

2. Client SDK scope

The design says the SDK should include discovery request and response types and
small helper wrappers at
[2026-04-10-cli-artifact-generation-design.md#L153](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-10-cli-artifact-generation-design.md#L153),
but current output stops short of typed discovery results and runtime helpers.

3. Input model

The design leaves room for explicit exported symbol names and config-file
support at
[2026-04-10-cli-artifact-generation-design.md#L178](/home/vincent-bai/Documents/github/tabletop-kernel/docs/design/2026-04-10-cli-artifact-generation-design.md#L178),
but the current loader still depends on implicit factory calling conventions.

This is not a bug by itself. It just means the implementation is currently:

- useful
- tested
- partial relative to the broader intended CLI product surface

## Recommended Next Steps

Priority order:

1. Fix game-loading inputs

This is the most important correctness issue because it affects every artifact
generation command.

2. Define a materialized protocol artifact

This clarifies what `generate protocol` is actually promising to consumers.

3. Broaden `validate`

Replay and fixture validation are natural next steps and align well with the
CLI’s purpose.

4. Decide whether `generate client-sdk` should remain a typed interface
   generator or grow into a fuller generated SDK surface

This is partly a naming/product decision, not just an implementation task.
