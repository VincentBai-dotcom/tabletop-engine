import type { SplendorTerminalCommand } from "./types.ts";
import type { SplendorTerminalSession } from "./session.ts";
import {
  buildCommandFromDiscovery,
  chooseRandomAvailableCommandType,
  chooseRandomDiscoveryOption,
} from "./actions.ts";

export async function chooseRandomBotCommand(
  session: SplendorTerminalSession,
  actorId: string,
  random: () => number = Math.random,
): Promise<SplendorTerminalCommand> {
  const commandType = chooseRandomAvailableCommandType(
    session,
    actorId,
    random,
  );

  return buildCommandFromDiscovery(
    session,
    actorId,
    commandType,
    async (discovery) => chooseRandomDiscoveryOption(discovery, random),
  );
}
