export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function run(argv: string[]): Promise<RunResult> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return {
      exitCode: 0,
      stdout: createHelpText(),
      stderr: "",
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: `unknown_command:${argv.join(" ")}`,
  };
}

function createHelpText(): string {
  return ["tabletop-cli", "", "Commands:", "  generate", "  validate"].join(
    "\n",
  );
}

if (import.meta.main) {
  const result = await run(process.argv.slice(2));

  if (result.stdout) {
    console.log(result.stdout);
  }

  if (result.stderr) {
    console.error(result.stderr);
  }

  process.exitCode = result.exitCode;
}
