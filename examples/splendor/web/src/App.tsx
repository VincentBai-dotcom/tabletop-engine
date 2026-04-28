import { useMemo, useState } from "react";
import { developmentCardsById, nobleTilesById } from "splendor-example/client";
import "./App.css";
import { useSplendorApp } from "./hooks/use-splendor-app";

const TOKEN_ORDER = ["white", "blue", "green", "red", "black", "gold"] as const;
const COST_ORDER = ["White", "Blue", "Green", "Red", "Black"] as const;

const COMMAND_LABELS: Record<string, string> = {
  take_three_distinct_gems: "Take 3 distinct gems",
  take_two_same_gems: "Take 2 same gems",
  reserve_face_up_card: "Reserve face-up card",
  reserve_deck_card: "Reserve deck card",
  buy_face_up_card: "Buy face-up card",
  buy_reserved_card: "Buy reserved card",
  return_tokens: "Return tokens",
  choose_noble: "Choose noble",
};

function commandLabel(commandType: string): string {
  return (
    COMMAND_LABELS[commandType] ??
    commandType
      .split("_")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2)
    .padEnd(1, "·");
}

type DiscoveryOption =
  ReturnType<typeof useSplendorApp> extends {
    discovery: { options: infer Options } | null;
  }
    ? Options extends Array<infer Option>
      ? Option
      : never
    : never;

function GemDot({ color }: { color: string }) {
  return <span className={`gem-dot gem-dot-${color}`} />;
}

function CostChip({ color, amount }: { color: string; amount: number }) {
  if (amount <= 0) return null;
  return <span className={`cost-chip cost-chip-${color}`}>{amount}</span>;
}

function OptionSummary({ output }: { output: Record<string, unknown> }) {
  if (typeof output.cardId === "number") {
    const card = developmentCardsById[output.cardId];
    return (
      <>
        <span className="option-primary">
          {card?.bonusColor ? (
            <GemDot color={card.bonusColor.toLowerCase()} />
          ) : null}
          {card?.prestigePoints ?? 0} pts
        </span>
        <span className="option-secondary">
          Card #{output.cardId} · level {String(output.level ?? "?")}
        </span>
      </>
    );
  }

  if (typeof output.color === "string") {
    return (
      <>
        <span className="option-primary">
          <GemDot color={output.color} />
          {String(output.color).replace(/^./, (c) => c.toUpperCase())}
        </span>
        {typeof output.requiredCount === "number" ? (
          <span className="option-secondary">
            {String(output.selectedCount)} / {String(output.requiredCount)}{" "}
            selected
          </span>
        ) : typeof output.requiredReturnCount === "number" ? (
          <span className="option-secondary">
            return {String(output.selectedCount)} of{" "}
            {String(output.requiredReturnCount)}
          </span>
        ) : typeof output.amount === "number" ? (
          <span className="option-secondary">+{String(output.amount)}</span>
        ) : null}
      </>
    );
  }

  if (typeof output.nobleId === "number") {
    return (
      <>
        <span className="option-primary">
          {String(output.name ?? `Noble #${output.nobleId}`)}
        </span>
        <span className="option-secondary">3 prestige</span>
      </>
    );
  }

  if (typeof output.level === "number") {
    return (
      <>
        <span className="option-primary">Level {String(output.level)}</span>
        {typeof output.cardCount === "number" ? (
          <span className="option-secondary">
            {String(output.cardCount)} cards in deck
          </span>
        ) : null}
      </>
    );
  }

  return <span className="option-primary">Select</span>;
}

function StatusPill({ status, busy }: { status: string; busy: boolean }) {
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" />
      <span>{status}</span>
      {busy ? <span className="busy">working</span> : null}
    </span>
  );
}

function App() {
  const app = useSplendorApp();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [menuTab, setMenuTab] = useState<"create" | "join">("create");

  const playerSections = useMemo(() => {
    if (!app.game) return [];
    return app.game.view.game.playerOrder.map((playerId) => ({
      playerId,
      player: app.game?.view.game.players[playerId],
    }));
  }, [app.game]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-brand-mark" />
          <span>Splendor</span>
        </div>
        <div className="topbar-meta">
          <StatusPill status={app.liveStatus} busy={app.busy} />
          {app.screen !== "menu" ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={app.resetBrowserSession}
              disabled={app.busy}
            >
              Reset session
            </button>
          ) : null}
        </div>
      </header>

      {app.error ? <div className="flash">{app.error}</div> : null}

      {app.screen === "menu" ? (
        <main className="view view-narrow">
          <h1 className="menu-title">Play Splendor</h1>
          <p className="menu-sub">
            Hosted, invite-only rooms. No accounts. Reconnect by reopening this
            page in the same browser.
          </p>

          <div className="tabs">
            <button
              className={`tab ${menuTab === "create" ? "active" : ""}`}
              onClick={() => setMenuTab("create")}
            >
              Create
            </button>
            <button
              className={`tab ${menuTab === "join" ? "active" : ""}`}
              onClick={() => setMenuTab("join")}
            >
              Join
            </button>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="display-name">
              Display name
            </label>
            <input
              id="display-name"
              className="field-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Vincent"
            />
          </div>

          {menuTab === "join" ? (
            <div className="field">
              <label className="field-label" htmlFor="room-code">
                Room code
              </label>
              <input
                id="room-code"
                className="field-input"
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(event.target.value.toUpperCase())
                }
                placeholder="ABC123"
                maxLength={6}
              />
            </div>
          ) : null}

          <div className="btn-row">
            {menuTab === "create" ? (
              <button
                className="btn"
                onClick={() => app.createRoomAndConnect(displayName.trim())}
                disabled={app.busy || displayName.trim().length === 0}
              >
                Create room
              </button>
            ) : (
              <button
                className="btn"
                onClick={() =>
                  app.joinRoomAndConnect(displayName.trim(), roomCode.trim())
                }
                disabled={
                  app.busy ||
                  displayName.trim().length === 0 ||
                  roomCode.trim().length === 0
                }
              >
                Join room
              </button>
            )}
          </div>
        </main>
      ) : null}

      {app.screen === "room" && app.room ? (
        <main className="view view-narrow">
          <p className="room-code-label">Room code</p>
          <h1 className="room-code">{app.room.code}</h1>
          <p className="room-help">
            Share the code with friends. Host can start once at least two seated
            players are ready.
          </p>

          <div className="seats">
            {app.room.players.map((player) => (
              <div className="seat" key={player.playerSessionId}>
                <span className="seat-avatar">
                  {initials(player.displayName)}
                </span>
                <span className="seat-name">{player.displayName}</span>
                {player.isHost ? (
                  <span className="seat-tag seat-tag-host">host</span>
                ) : null}
                {player.isReady ? (
                  <span className="seat-tag seat-tag-ready">ready</span>
                ) : (
                  <span className="seat-tag">waiting</span>
                )}
                {player.disconnectedAt ? (
                  <span className="seat-tag seat-tag-disconnected">
                    offline
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="btn-row">
            <button
              className="btn"
              onClick={() => app.setReady(true)}
              disabled={app.busy}
            >
              Ready
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => app.setReady(false)}
              disabled={app.busy}
            >
              Not ready
            </button>
            <button
              className="btn btn-accent"
              onClick={app.startGame}
              disabled={app.busy}
            >
              Start game
            </button>
            <button
              className="btn btn-ghost"
              onClick={app.leaveRoom}
              disabled={app.busy}
            >
              Leave
            </button>
          </div>
        </main>
      ) : null}

      {app.screen === "game" && app.game ? (
        <main className="view view-game">
          <div className="game">
            <aside className="actions">
              <p className="game-section-label">Actions</p>
              {app.game.availableCommands.length > 0 ? (
                app.game.availableCommands.map((commandType) => (
                  <button
                    key={commandType}
                    className="action-btn"
                    onClick={() =>
                      app.beginDiscovery(
                        commandType as Parameters<typeof app.beginDiscovery>[0],
                      )
                    }
                    disabled={app.busy}
                  >
                    {commandLabel(commandType)}
                  </button>
                ))
              ) : (
                <div className="actions-empty">Waiting for another player</div>
              )}
            </aside>

            <section className="board">
              <div>
                <p className="game-section-label">Bank</p>
                <div className="bank">
                  {TOKEN_ORDER.map((color) => {
                    const amount =
                      (app.game?.view.game.bank as Record<string, number>)[
                        color
                      ] ?? 0;
                    return (
                      <span key={color} className="gem">
                        <GemDot color={color} />
                        <span className="gem-count">{amount}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="game-section-label">Development cards</p>
                <div className="levels">
                  {Object.entries(app.game.view.game.board.faceUpByLevel).map(
                    ([level, cardIds]) => (
                      <div className="level-row" key={level}>
                        <span className="level-pill">L{level}</span>
                        <div className="cards">
                          {cardIds.map((cardId: number) => {
                            const card = developmentCardsById[cardId];
                            const points = card?.prestigePoints ?? 0;
                            return (
                              <article className="card" key={cardId}>
                                {card?.bonusColor ? (
                                  <span
                                    className={`card-bonus card-bonus-${card.bonusColor}`}
                                  />
                                ) : null}
                                <div className="card-head">
                                  <span
                                    className={`card-points ${
                                      points === 0 ? "card-points-zero" : ""
                                    }`}
                                  >
                                    {points}
                                  </span>
                                  <span className="card-bonus-label">
                                    {card?.bonusColor ?? "?"}
                                  </span>
                                </div>
                                <div className="card-cost">
                                  {COST_ORDER.map((costColor) => (
                                    <CostChip
                                      key={costColor}
                                      color={costColor}
                                      amount={card?.cost?.[costColor] ?? 0}
                                    />
                                  ))}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </section>

            <aside className="players">
              <p className="game-section-label">Players</p>
              {playerSections.map(({ playerId, player }) => {
                const totalTokens = player
                  ? TOKEN_ORDER.reduce(
                      (sum, color) =>
                        sum +
                        ((player.tokens as Record<string, number>)[color] ?? 0),
                      0,
                    )
                  : 0;
                const reserved = Array.isArray(player?.reservedCardIds)
                  ? `${player?.reservedCardIds.length}`
                  : `${player?.reservedCardIds.value.count ?? 0} (hidden)`;
                return (
                  <div className="player" key={playerId}>
                    <div className="player-head">
                      <span className="player-name">{playerId}</span>
                      <span className="player-stats">
                        {totalTokens}/10 tokens
                      </span>
                    </div>
                    <div className="player-tokens">
                      {TOKEN_ORDER.map((color) => {
                        const amount =
                          (player?.tokens as Record<string, number>)?.[color] ??
                          0;
                        if (amount === 0) return null;
                        return (
                          <span key={color} className="gem">
                            <GemDot color={color} />
                            <span className="gem-count">{amount}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="player-meta">
                      <div className="player-meta-row">
                        <span className="player-meta-label">Cards</span>
                        <span>{player?.purchasedCardIds.length ?? 0}</span>
                      </div>
                      <div className="player-meta-row">
                        <span className="player-meta-label">Reserved</span>
                        <span>{reserved}</span>
                      </div>
                      <div className="player-meta-row">
                        <span className="player-meta-label">Nobles</span>
                        <span>
                          {player?.nobleIds.length
                            ? player.nobleIds
                                .map(
                                  (id) => nobleTilesById[id]?.name ?? `#${id}`,
                                )
                                .join(", ")
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </aside>
          </div>

          {app.discovery ? (
            <div className="discovery" onClick={app.cancelDiscovery}>
              <div
                className="discovery-panel"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="discovery-head">
                  <div>
                    <div className="discovery-title">
                      {app.activeCommandType
                        ? commandLabel(app.activeCommandType)
                        : "Discovery"}
                    </div>
                    <div className="discovery-step">
                      {app.discovery.step.replace(/_/g, " ")}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={app.cancelDiscovery}
                  >
                    Cancel
                  </button>
                </div>
                <div className="discovery-options">
                  {app.discovery.options.map((option: DiscoveryOption) => (
                    <button
                      key={option.id}
                      className="option"
                      onClick={() => app.chooseDiscoveryOption(option)}
                    >
                      <OptionSummary
                        output={option.output as Record<string, unknown>}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </main>
      ) : null}

      {app.screen === "ended" && app.ended ? (
        <main className="view view-narrow">
          <h1 className="ended-headline">
            {app.ended.result.reason === "completed"
              ? "Game over"
              : "Session ended"}
          </h1>
          <p className="ended-sub">
            {app.ended.result.message ?? "The game no longer exists."}
          </p>
          {app.ended.result.winnerPlayerIds?.length ? (
            <div className="ended-winners">
              Winner: {app.ended.result.winnerPlayerIds.join(", ")}
            </div>
          ) : null}
          <div className="btn-row">
            <button className="btn" onClick={app.backToMenu}>
              Back to menu
            </button>
          </div>
        </main>
      ) : null}
    </div>
  );
}

export default App;
