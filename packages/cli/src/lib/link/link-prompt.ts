import { input, select } from "@inquirer/prompts";
import type { Readable, Writable } from "node:stream";
import type { GameResponse } from "../api/games.ts";

export interface LinkPromptContext {
  /** The account's existing games, newest first. Empty means "must create". */
  games: GameResponse[];
  /** `game.name` from config, offered as the default for a new game. */
  defaultName: string;
}

/**
 * What the developer chose on an unlinked project's first upload: bind to an
 * existing game, or create a new one. There is deliberately no third "skip"
 * branch — an upload has to resolve to exactly one game.
 */
export type LinkDecision =
  | { action: "create"; name: string }
  | { action: "pick"; gameId: string };

export type LinkPrompt = (ctx: LinkPromptContext) => Promise<LinkDecision>;

/** The value carried by each row of the select, resolved after Enter. */
type LinkChoiceValue = { kind: "create" } | { kind: "pick"; gameId: string };

/**
 * The select rows: "Create a new game" first, then one row per existing game.
 * Extracted so the choice list is testable without driving a live terminal.
 */
export function buildLinkChoices(
  games: GameResponse[],
): { name: string; value: LinkChoiceValue }[] {
  return [
    { name: "Create a new game", value: { kind: "create" } },
    ...games.map((game) => ({
      name: `${game.name} (${game.id})`,
      value: { kind: "pick" as const, gameId: game.id },
    })),
  ];
}

/**
 * The interactive picker: an arrow-key select (↑/↓, Enter) over the account's
 * games, with a name prompt when the developer creates a new one. Kept behind
 * the `LinkPrompt` seam so the upload flow tests without a terminal. Streams
 * default to stdin/stderr — stderr, not stdout, so the command's final result
 * line stays the only thing on stdout.
 */
export function createInteractiveLinkPrompt(streams?: {
  input?: Readable;
  output?: Writable;
}): LinkPrompt {
  const context = {
    input: (streams?.input ?? process.stdin) as NodeJS.ReadableStream,
    output: (streams?.output ?? process.stderr) as NodeJS.WritableStream,
  };

  return async ({ games, defaultName }) => {
    const chosen =
      games.length === 0
        ? { kind: "create" as const }
        : await select(
            {
              message: "This project isn't linked to a game yet. Choose one:",
              choices: buildLinkChoices(games),
            },
            context,
          );

    if (chosen.kind === "pick") {
      return { action: "pick", gameId: chosen.gameId };
    }

    const name = await input(
      { message: "Name for the new game:", default: defaultName },
      context,
    );
    return { action: "create", name: name.trim() || defaultName };
  };
}
