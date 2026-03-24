import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { MenuOption } from "./types.ts";

export function createPromptInterface(): Interface {
  return createInterface({
    input: stdin,
    output: stdout,
  });
}

export async function selectMenuOption<T>(
  prompt: Interface,
  question: string,
  options: readonly MenuOption<T>[],
): Promise<T> {
  if (options.length === 0) {
    throw new Error("no_menu_options");
  }

  for (;;) {
    stdout.write(`${question}\n`);

    for (const [index, option] of options.entries()) {
      stdout.write(`${String(index + 1)}. ${option.label}\n`);
    }

    const answer = (await prompt.question("> ")).trim();
    const choice = Number(answer);

    if (Number.isInteger(choice) && choice >= 1 && choice <= options.length) {
      return options[choice - 1]!.value;
    }

    stdout.write("Enter a valid number from the list.\n\n");
  }
}

export async function waitForEnter(
  prompt: Interface,
  question: string,
): Promise<void> {
  await prompt.question(`${question}\n`);
}
