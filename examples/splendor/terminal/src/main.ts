import type { Interface } from "node:readline/promises";
import {
  createPromptInterface,
  selectMenuOption,
  waitForEnter,
} from "./prompts.ts";
import { createLocalSplendorSession } from "./session.ts";
import {
  buildCommandFromDiscovery,
  createCommandMenuOptions,
  describeCommand,
  describeDiscoveryOption,
  describeDiscoveryPrompt,
} from "./actions.ts";
import { chooseRandomBotCommand } from "./bot.ts";
import { renderGameScreen } from "./render.ts";
import type {
  MenuOption,
  SplendorTerminalCommand,
  SplendorTerminalDiscoveryOption,
  SplendorTerminalOpenDiscovery,
} from "./types.ts";

async function main(): Promise<void> {
  const session = createLocalSplendorSession();
  const prompt = createPromptInterface();

  try {
    for (;;) {
      if (session.isFinished()) {
        drawScreen(
          session,
          `Game finished. Winner(s): ${session.getWinnerIds()?.join(", ") ?? "none"}`,
        );
        break;
      }

      const activePlayerId = session.getActivePlayerId();

      if (!activePlayerId) {
        throw new Error("no_active_player");
      }

      if (activePlayerId === "you") {
        drawScreen(session, "Your turn.");
        const command = await promptForHumanCommand(
          prompt,
          session,
          activePlayerId,
        );
        const summary = `You: ${describeCommand(command)}`;
        const result = session.executeCommand(command, summary);

        if (!result.ok) {
          drawScreen(session, `Command rejected: ${result.reason}`);
          continue;
        }

        drawScreen(session, summary);
        continue;
      }

      drawScreen(session, `${activePlayerId} is about to act.`);
      await waitForEnter(
        prompt,
        `Press Enter to reveal ${activePlayerId}'s action...`,
      );
      const command = await chooseRandomBotCommand(session, activePlayerId);
      const summary = `${activePlayerId}: ${describeCommand(command)}`;
      const result = session.executeCommand(command, summary);

      if (!result.ok) {
        throw new Error(`bot_command_failed:${result.reason}`);
      }

      drawScreen(session, summary);
    }
  } finally {
    await waitForEnter(prompt, "Press Enter to exit.");
    prompt.close();
  }
}

async function promptForHumanCommand(
  prompt: Interface,
  session: ReturnType<typeof createLocalSplendorSession>,
  actorId: string,
): Promise<SplendorTerminalCommand> {
  const availableCommands = session.listAvailableCommands(actorId);

  if (availableCommands.length === 0) {
    throw new Error(`no_available_commands:${actorId}`);
  }

  const commandType = await selectMenuOption(
    prompt,
    "Choose a command:",
    createCommandMenuOptions(availableCommands),
  );

  return buildCommandFromDiscovery(
    session,
    actorId,
    commandType,
    async (discovery) => promptForDiscoveryOption(prompt, session, discovery),
  );
}

async function promptForDiscoveryOption(
  prompt: Interface,
  session: ReturnType<typeof createLocalSplendorSession>,
  discovery: SplendorTerminalOpenDiscovery,
): Promise<SplendorTerminalDiscoveryOption> {
  const options: MenuOption<SplendorTerminalDiscoveryOption>[] =
    discovery.options.map((option) => ({
      label: describeDiscoveryOption(discovery, option),
      value: option,
    }));

  drawScreen(session, describeDiscoveryPrompt(discovery));
  return selectMenuOption(
    prompt,
    `${describeDiscoveryPrompt(discovery)}:`,
    options,
  );
}

function drawScreen(
  session: ReturnType<typeof createLocalSplendorSession>,
  banner: string,
): void {
  const visibleState = session.getVisibleState();
  const screen = renderGameScreen({
    game: visibleState.game,
    activePlayerId: session.getActivePlayerId(),
    activity: session.getActivity(),
    banner,
  });

  process.stdout.write(`\x1Bc${screen}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
