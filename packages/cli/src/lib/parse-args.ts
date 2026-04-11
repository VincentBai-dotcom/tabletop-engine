export function isHelpFlag(value: string | undefined): boolean {
  return value === "--help" || value === "-h";
}

export interface ParsedCommandArguments {
  gamePath: string;
  exportName?: string;
  outDir?: string;
  snapshotPath?: string;
}

export function parseCommandArguments(args: string[]): ParsedCommandArguments {
  const flags = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (!current?.startsWith("--")) {
      continue;
    }

    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      throw new Error(`missing_flag_value:${current}`);
    }

    flags.set(current, next);
    index += 1;
  }

  const gamePath = flags.get("--game");

  if (!gamePath) {
    throw new Error("game_path_required");
  }

  return {
    gamePath,
    exportName: flags.get("--export"),
    outDir: flags.get("--outDir"),
    snapshotPath: flags.get("--snapshot"),
  };
}
