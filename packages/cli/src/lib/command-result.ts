export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function success(stdout: string): RunResult {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
  };
}

export function failure(stderr: string): RunResult {
  return {
    exitCode: 1,
    stdout: "",
    stderr,
  };
}
