interface BuiltGameDefinition {
  name: string;
  commands: object;
  canonicalGameStateSchema: object;
  runtimeStateSchema: object;
}

export interface TabletopCliConfig<
  TGame extends BuiltGameDefinition = BuiltGameDefinition,
> {
  game: TGame;
  outDir?: string;
}

export function defineConfig<TGame extends BuiltGameDefinition>(
  config: TabletopCliConfig<TGame>,
): TabletopCliConfig<TGame> {
  return config;
}
