import { useMemo, useState } from "react";
import { developmentCardsById, nobleTilesById } from "splendor-example/client";
import "./App.css";
import { useSplendorApp } from "./hooks/use-splendor-app";

function formatCommandLabel(commandType: string) {
  return commandType
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function App() {
  const app = useSplendorApp();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const playerSections = useMemo(() => {
    if (!app.game) {
      return [];
    }

    return app.game.view.game.playerOrder.map((playerId) => {
      const player = app.game?.view.game.players[playerId];
      return {
        playerId,
        player,
      };
    });
  }, [app.game]);

  return (
    <main className="shell">
      <section className="masthead">
        <div>
          <p className="eyebrow">Hosted Splendor Vertical Slice</p>
          <h1>Private room play on one real hosted loop.</h1>
          <p className="lede">
            Same-browser reconnect, live room updates, player-scoped game views,
            hosted discovery, and no account system.
          </p>
        </div>
        <div className="status-panel">
          <span className={`status-dot status-${app.liveStatus}`} />
          <span>{app.liveStatus}</span>
          {app.busy ? <span className="busy-chip">working</span> : null}
        </div>
      </section>

      {app.error ? <div className="flash flash-error">{app.error}</div> : null}

      {app.screen === "menu" ? (
        <section className="layout-grid">
          <article className="panel panel-hero">
            <p className="panel-kicker">Main Menu</p>
            <h2>Create a private room</h2>
            <p>
              The room is invite-only. Share the room code directly with
              friends. The backend keeps only anonymous player sessions and live
              game state.
            </p>
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Vincent"
              />
            </label>
            <div className="button-row">
              <button
                onClick={() => app.createRoomAndConnect(displayName.trim())}
                disabled={app.busy || displayName.trim().length === 0}
              >
                Create room
              </button>
              <button
                className="secondary"
                onClick={app.resetBrowserSession}
                disabled={app.busy}
              >
                Reset browser session
              </button>
            </div>
          </article>

          <article className="panel">
            <p className="panel-kicker">Join by Code</p>
            <h2>Reconnect with the same browser</h2>
            <p>
              If the room or game still exists, reopening this page from the
              same browser reuses the stored anonymous player session.
            </p>
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Vincent"
              />
            </label>
            <label className="field">
              <span>Room code</span>
              <input
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(event.target.value.toUpperCase())
                }
                placeholder="ABC123"
              />
            </label>
            <div className="button-row">
              <button
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
            </div>
          </article>
        </section>
      ) : null}

      {app.screen === "room" && app.room ? (
        <section className="layout-grid">
          <article className="panel panel-room">
            <p className="panel-kicker">Room</p>
            <h2>Code {app.room.code}</h2>
            <p>
              The host can start once at least two seated players are ready.
            </p>
            <div className="button-row">
              <button onClick={() => app.setReady(true)} disabled={app.busy}>
                Ready
              </button>
              <button
                className="secondary"
                onClick={() => app.setReady(false)}
                disabled={app.busy}
              >
                Not ready
              </button>
              <button onClick={app.startGame} disabled={app.busy}>
                Start game
              </button>
              <button
                className="secondary"
                onClick={app.leaveRoom}
                disabled={app.busy}
              >
                Leave room
              </button>
            </div>
          </article>

          <article className="panel">
            <p className="panel-kicker">Seats</p>
            <div className="seat-list">
              {app.room.players.map((player) => (
                <div className="seat-card" key={player.playerSessionId}>
                  <div className="seat-title">
                    <strong>{player.displayName}</strong>
                    <span>seat {player.seatIndex + 1}</span>
                  </div>
                  <div className="seat-meta">
                    {player.isHost ? <span>host</span> : null}
                    <span>{player.isReady ? "ready" : "waiting"}</span>
                    {player.disconnectedAt ? <span>disconnected</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {app.screen === "game" && app.game ? (
        <section className="layout-grid game-grid">
          <article className="panel panel-command">
            <p className="panel-kicker">Actions</p>
            <h2>
              {app.game.availableCommands.length > 0
                ? "Your available commands"
                : "Waiting for another player"}
            </h2>
            <div className="button-stack">
              {app.game.availableCommands.map((commandType) => (
                <button
                  key={commandType}
                  onClick={() =>
                    app.beginDiscovery(
                      commandType as Parameters<typeof app.beginDiscovery>[0],
                    )
                  }
                  disabled={app.busy}
                >
                  {formatCommandLabel(commandType)}
                </button>
              ))}
            </div>

            {app.discovery ? (
              <div className="discovery-panel">
                <div className="discovery-header">
                  <strong>{app.discovery.step}</strong>
                  <button
                    className="secondary small"
                    onClick={app.cancelDiscovery}
                  >
                    Cancel
                  </button>
                </div>
                <div className="discovery-options">
                  {app.discovery.options.map((option) => (
                    <button
                      key={option.id}
                      className="option-card"
                      onClick={() => app.chooseDiscoveryOption(option)}
                    >
                      <pre>{JSON.stringify(option.output, null, 2)}</pre>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </article>

          <article className="panel panel-board">
            <p className="panel-kicker">Board</p>
            <h2>Visible game state</h2>
            <div className="token-bank">
              {Object.entries(app.game.view.game.bank).map(
                ([color, amount]) => (
                  <div key={color} className="token-pill">
                    <span>{color}</span>
                    <strong>{amount}</strong>
                  </div>
                ),
              )}
            </div>

            <div className="board-levels">
              {Object.entries(app.game.view.game.board.faceUpByLevel).map(
                ([level, cardIds]) => (
                  <section key={level}>
                    <h3>Level {level}</h3>
                    <div className="card-grid">
                      {cardIds.map((cardId) => {
                        const card = developmentCardsById[cardId];
                        return (
                          <article className="card-tile" key={cardId}>
                            <header>
                              <span>#{cardId}</span>
                              <strong>{card?.bonusColor ?? "Unknown"}</strong>
                            </header>
                            <p>{card?.prestigePoints ?? 0} prestige</p>
                            <code>
                              {JSON.stringify(card?.cost ?? {}, null, 0)}
                            </code>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ),
              )}
            </div>
          </article>

          <article className="panel">
            <p className="panel-kicker">Players</p>
            <div className="player-list">
              {playerSections.map(({ playerId, player }) => (
                <section className="player-card" key={playerId}>
                  <header>
                    <h3>{playerId}</h3>
                    <span>{player?.nobleIds.length ?? 0} nobles</span>
                  </header>
                  <div className="token-bank compact">
                    {player
                      ? Object.entries(player.tokens).map(([color, amount]) => (
                          <div key={color} className="token-pill">
                            <span>{color}</span>
                            <strong>{amount}</strong>
                          </div>
                        ))
                      : null}
                  </div>
                  <p>
                    Purchased: {player?.purchasedCardIds.join(", ") || "none"}
                  </p>
                  <p>
                    Reserved:{" "}
                    {Array.isArray(player?.reservedCardIds)
                      ? player?.reservedCardIds.join(", ") || "none"
                      : `${player?.reservedCardIds.value.count ?? 0} hidden`}
                  </p>
                  <p>
                    Nobles:{" "}
                    {player?.nobleIds
                      .map(
                        (nobleId) => nobleTilesById[nobleId]?.name ?? nobleId,
                      )
                      .join(", ") || "none"}
                  </p>
                </section>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {app.screen === "ended" && app.ended ? (
        <section className="layout-grid">
          <article className="panel panel-end">
            <p className="panel-kicker">Game Over</p>
            <h2>
              {app.ended.result.reason === "completed"
                ? "Session completed"
                : "Session invalidated"}
            </h2>
            <p>{app.ended.result.message ?? "The game no longer exists."}</p>
            {app.ended.result.winnerPlayerIds?.length ? (
              <p>Winner(s): {app.ended.result.winnerPlayerIds.join(", ")}</p>
            ) : null}
            <div className="button-row">
              <button onClick={app.backToMenu}>Back to main menu</button>
            </div>
          </article>

          {app.ended.lastView ? (
            <article className="panel">
              <p className="panel-kicker">Final View</p>
              <pre className="final-json">
                {JSON.stringify(app.ended.lastView.game, null, 2)}
              </pre>
            </article>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default App;
