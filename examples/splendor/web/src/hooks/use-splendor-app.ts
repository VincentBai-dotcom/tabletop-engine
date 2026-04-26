import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  buyFaceUpCardDiscoveryStart,
  buyReservedCardDiscoveryStart,
  chooseNobleDiscoveryStart,
  createGameEngineClient,
  reserveDeckCardDiscoveryStart,
  reserveFaceUpCardDiscoveryStart,
  takeThreeDistinctGemsDiscoveryStart,
  takeTwoSameGemsDiscoveryStart,
  type CommandPayload,
  type CommandType,
  type DiscoveryPayload,
  type DiscoveryResult,
  type GameEngineClient,
  type VisibleState,
} from "splendor-example/client";
import { connectLive, type LiveConnectionHandle } from "../lib/live-connection";
import {
  clearPlayerSessionToken,
  clearPresenceTarget,
  loadPlayerSessionToken,
  loadPresenceTarget,
  savePlayerSessionToken,
  savePresenceTarget,
  type PresenceTarget,
} from "../lib/player-session";
import { createRoom, joinRoom } from "../lib/server-api";
import type {
  BrowserLiveServerMessage,
  BrowserRoomSnapshot,
  SplendorDiscoveryRequest,
} from "../types/live";
import { normalizeRoomSnapshot } from "../types/live";

type OpenDiscovery = Extract<DiscoveryResult, { complete: false }>;
type CompleteDiscovery = Extract<DiscoveryResult, { complete: true }>;
type Screen = "menu" | "room" | "game" | "ended";

const DISCOVERY_STARTS: Record<
  CommandType,
  {
    step: SplendorDiscoveryRequest["step"];
    input: SplendorDiscoveryRequest["input"];
  }
> = {
  buy_face_up_card: buyFaceUpCardDiscoveryStart,
  buy_reserved_card: buyReservedCardDiscoveryStart,
  choose_noble: chooseNobleDiscoveryStart,
  reserve_deck_card: reserveDeckCardDiscoveryStart,
  reserve_face_up_card: reserveFaceUpCardDiscoveryStart,
  take_three_distinct_gems: takeThreeDistinctGemsDiscoveryStart,
  take_two_same_gems: takeTwoSameGemsDiscoveryStart,
};

export interface SplendorGameState {
  gameSessionId: string;
  stateVersion: number;
  view: VisibleState;
  availableCommands: string[];
  events: unknown[];
}

export interface EndedState {
  result: {
    reason: "completed" | "invalidated";
    winnerPlayerIds?: string[];
    message?: string;
  };
  lastView: VisibleState | null;
}

function messageToText(message: BrowserLiveServerMessage) {
  if (message.type !== "error") {
    return null;
  }

  return message.message ?? message.code;
}

function createDiscoveryRequest(
  commandType: CommandType,
  step: SplendorDiscoveryRequest["step"],
  input: SplendorDiscoveryRequest["input"],
): DiscoveryPayload {
  return {
    type: commandType,
    step,
    input,
  } as DiscoveryPayload;
}

function createCommandRequest(
  commandType: CommandType,
  input: CompleteDiscovery["input"],
): CommandPayload {
  return {
    type: commandType,
    input,
  } as CommandPayload;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Live request failed";
}

function updatePresenceTargetIfChanged(
  current: PresenceTarget | null,
  next: PresenceTarget,
) {
  if (
    current?.kind === next.kind &&
    ((current.kind === "room" &&
      next.kind === "room" &&
      current.roomId === next.roomId) ||
      (current.kind === "game" &&
        next.kind === "game" &&
        current.gameSessionId === next.gameSessionId))
  ) {
    return current;
  }

  savePresenceTarget(next);
  return next;
}

export function useSplendorApp() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [playerSessionToken, setPlayerSessionToken] = useState<string | null>(
    () => loadPlayerSessionToken(),
  );
  const [presenceTarget, setPresenceTarget] = useState<PresenceTarget | null>(
    () => loadPresenceTarget(),
  );
  const [room, setRoom] = useState<BrowserRoomSnapshot | null>(null);
  const [game, setGame] = useState<SplendorGameState | null>(null);
  const [ended, setEnded] = useState<EndedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState<
    "idle" | "connecting" | "connected" | "reconnecting"
  >("idle");
  const [activeCommandType, setActiveCommandType] =
    useState<CommandType | null>(null);
  const [discovery, setDiscovery] = useState<OpenDiscovery | null>(null);

  const liveRef = useRef<LiveConnectionHandle | null>(null);
  const gameEngineClientRef = useRef<GameEngineClient | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const latestGameRef = useRef(game);
  const latestActiveCommandTypeRef = useRef(activeCommandType);
  const requestCounterRef = useRef(0);

  function createRequestId() {
    requestCounterRef.current += 1;
    return `web-request-${requestCounterRef.current}`;
  }

  function resetTransientGameState() {
    setDiscovery(null);
    setActiveCommandType(null);
  }

  function clearReconnectTimer() {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  function disposeGameEngineClient() {
    gameEngineClientRef.current?.dispose();
    gameEngineClientRef.current = null;
  }

  useEffect(() => {
    latestGameRef.current = game;
  }, [game]);

  useEffect(() => {
    latestActiveCommandTypeRef.current = activeCommandType;
  }, [activeCommandType]);

  const connectToLiveSocket = useCallback(function connectToLiveSocketImpl(
    token: string,
    target: PresenceTarget,
  ) {
    liveRef.current?.close();
    disposeGameEngineClient();
    clearReconnectTimer();
    shouldReconnectRef.current = true;

    let gameEngineClient: GameEngineClient | null = null;

    const connection = connectLive(token, {
      onOpen() {
        gameEngineClient = createGameEngineClient(connection.socket, {
          createRequestId,
        });
        gameEngineClientRef.current = gameEngineClient;

        gameEngineClient.onGameSnapshot((message) => {
          startTransition(() => {
            setGame({
              gameSessionId: message.gameSessionId,
              stateVersion: message.stateVersion,
              view: message.view,
              availableCommands: message.availableCommands,
              events: message.events,
            });
            setScreen("game");
            setBusy(false);
            resetTransientGameState();
          });
        });

        gameEngineClient.onDiscoveryResult((message) => {
          startTransition(() => {
            const result = message.result?.result;

            if (!result) {
              setDiscovery(null);
              setError("Discovery is unavailable for this action");
              setBusy(false);
              return;
            }

            if (result.complete) {
              const latestActiveCommandType =
                latestActiveCommandTypeRef.current;
              if (!latestActiveCommandType || !gameEngineClient) {
                setError("Discovery completed without an active command");
                setBusy(false);
                return;
              }

              void gameEngineClient
                .execute({
                  gameSessionId: message.gameSessionId,
                  command: createCommandRequest(
                    latestActiveCommandType,
                    result.input,
                  ),
                })
                .catch((error: unknown) => {
                  startTransition(() => {
                    setError(toErrorMessage(error));
                    setBusy(false);
                  });
                });
              setDiscovery(null);
              return;
            }

            setDiscovery(result);
            setBusy(false);
          });
        });

        gameEngineClient.onExecutionResult((message) => {
          startTransition(() => {
            if (!message.accepted) {
              setError(message.reason);
            }
            setBusy(false);
          });
        });

        gameEngineClient.onGameEnded((message) => {
          shouldReconnectRef.current = false;
          clearPresenceTarget();
          startTransition(() => {
            setEnded({
              result: message.result,
              lastView: latestGameRef.current?.view ?? null,
            });
            setGame(null);
            setRoom(null);
            setScreen("ended");
            setBusy(false);
            setPresenceTarget(null);
            resetTransientGameState();
          });
        });

        startTransition(() => {
          setLiveStatus("connected");
        });

        if (target.kind === "room") {
          connection.send({
            type: "subscribe_room",
            roomId: target.roomId,
          });
          return;
        }

        connection.send({
          type: "subscribe_game",
          gameSessionId: target.gameSessionId,
        });
      },
      onClose() {
        gameEngineClient?.dispose();
        if (gameEngineClientRef.current === gameEngineClient) {
          gameEngineClientRef.current = null;
        }
        gameEngineClient = null;

        if (liveRef.current !== connection) {
          return;
        }

        liveRef.current = null;

        startTransition(() => {
          setLiveStatus("idle");
        });

        if (!shouldReconnectRef.current) {
          return;
        }

        reconnectTimerRef.current = window.setTimeout(() => {
          const latestTarget = loadPresenceTarget();
          const latestToken = loadPlayerSessionToken();
          if (!latestTarget || !latestToken) {
            return;
          }

          connectToLiveSocketImpl(latestToken, latestTarget);
        }, 1_500);
      },
      onError() {
        startTransition(() => {
          setError("Live connection failed");
        });
      },
      onMessage(message) {
        if (liveRef.current !== connection) {
          return;
        }

        const text = messageToText(message);
        if (text) {
          startTransition(() => {
            setError(text);
          });
          return;
        }

        switch (message.type) {
          case "session_resolved":
            savePlayerSessionToken(message.playerSessionToken);
            setPlayerSessionToken(message.playerSessionToken);
            return;
          case "room_snapshot":
          case "room_updated":
            startTransition(() => {
              setRoom(message.room);
              setGame(null);
              setEnded(null);
              setScreen("room");
              setPresenceTarget((current) =>
                updatePresenceTargetIfChanged(current, {
                  kind: "room",
                  roomId: message.room.id,
                }),
              );
              setBusy(false);
            });
            return;
          case "game_started":
            startTransition(() => {
              setRoom(null);
              setScreen("game");
              setBusy(false);
              const nextTarget = {
                kind: "game" as const,
                gameSessionId: message.gameSessionId,
              };
              setPresenceTarget((current) =>
                updatePresenceTargetIfChanged(current, nextTarget),
              );
            });
            connection.send({
              type: "subscribe_game",
              gameSessionId: message.gameSessionId,
            });
            return;
          case "game_snapshot":
          case "game_available_commands":
          case "game_discovery_result":
          case "game_execution_result":
          case "game_ended":
            return;
          case "server_restarting":
            startTransition(() => {
              setLiveStatus("reconnecting");
            });
            return;
          case "player_disconnected":
          case "player_reconnected":
            return;
        }
      },
    });

    liveRef.current = connection;
  }, []);

  useEffect(() => {
    if (!playerSessionToken || !presenceTarget) {
      return;
    }

    connectToLiveSocket(playerSessionToken, presenceTarget);

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      disposeGameEngineClient();
      liveRef.current?.close();
      liveRef.current = null;
    };
  }, [connectToLiveSocket, playerSessionToken, presenceTarget]);

  async function createRoomAndConnect(displayName: string) {
    setBusy(true);
    setError(null);

    try {
      const result = await createRoom({
        displayName,
        playerSessionToken,
      });
      savePlayerSessionToken(result.playerSessionToken);
      savePresenceTarget({ kind: "room", roomId: result.room.id });
      setPlayerSessionToken(result.playerSessionToken);
      setPresenceTarget({ kind: "room", roomId: result.room.id });
      setRoom(normalizeRoomSnapshot(result.room));
      setScreen("room");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to create room",
      );
      setBusy(false);
    }
  }

  async function joinRoomAndConnect(displayName: string, roomCode: string) {
    setBusy(true);
    setError(null);

    try {
      const result = await joinRoom({
        displayName,
        roomCode,
        playerSessionToken,
      });
      savePlayerSessionToken(result.playerSessionToken);
      savePresenceTarget({ kind: "room", roomId: result.room.id });
      setPlayerSessionToken(result.playerSessionToken);
      setPresenceTarget({ kind: "room", roomId: result.room.id });
      setRoom(normalizeRoomSnapshot(result.room));
      setScreen("room");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to join room");
      setBusy(false);
    }
  }

  function setReady(ready: boolean) {
    if (!room) {
      return;
    }

    setBusy(true);
    liveRef.current?.send({
      type: "room_set_ready",
      roomId: room.id,
      ready,
    });
  }

  function leaveRoom() {
    if (!room) {
      return;
    }

    shouldReconnectRef.current = false;
    clearPresenceTarget();
    disposeGameEngineClient();
    liveRef.current?.send({
      type: "room_leave",
      roomId: room.id,
    });
    liveRef.current?.close();
    liveRef.current = null;
    setRoom(null);
    setGame(null);
    setEnded(null);
    setScreen("menu");
    setPresenceTarget(null);
    setBusy(false);
    resetTransientGameState();
  }

  function startGame() {
    if (!room) {
      return;
    }

    setBusy(true);
    setError(null);
    liveRef.current?.send({
      type: "room_start_game",
      roomId: room.id,
    });
  }

  function beginDiscovery(commandType: CommandType) {
    if (!game || !gameEngineClientRef.current) {
      return;
    }

    setBusy(true);
    setError(null);
    setActiveCommandType(commandType);
    void gameEngineClientRef.current
      .discover({
        gameSessionId: game.gameSessionId,
        discovery: createDiscoveryRequest(
          commandType,
          DISCOVERY_STARTS[commandType].step,
          DISCOVERY_STARTS[commandType].input,
        ),
      })
      .catch((error: unknown) => {
        startTransition(() => {
          setError(toErrorMessage(error));
          setBusy(false);
        });
      });
  }

  function chooseDiscoveryOption(option: OpenDiscovery["options"][number]) {
    if (!game || !activeCommandType || !gameEngineClientRef.current) {
      return;
    }

    setBusy(true);
    void gameEngineClientRef.current
      .discover({
        gameSessionId: game.gameSessionId,
        discovery: createDiscoveryRequest(
          activeCommandType,
          option.nextStep,
          option.nextInput,
        ),
      })
      .catch((error: unknown) => {
        startTransition(() => {
          setError(toErrorMessage(error));
          setBusy(false);
        });
      });
  }

  function cancelDiscovery() {
    resetTransientGameState();
  }

  function backToMenu() {
    shouldReconnectRef.current = false;
    clearReconnectTimer();
    clearPresenceTarget();
    disposeGameEngineClient();
    liveRef.current?.close();
    liveRef.current = null;
    setRoom(null);
    setGame(null);
    setEnded(null);
    setScreen("menu");
    setPresenceTarget(null);
    setBusy(false);
    setError(null);
    resetTransientGameState();
  }

  function resetBrowserSession() {
    backToMenu();
    clearPlayerSessionToken();
    setPlayerSessionToken(null);
  }

  return {
    screen,
    room,
    game,
    ended,
    error,
    busy,
    liveStatus,
    activeCommandType,
    discovery,
    createRoomAndConnect,
    joinRoomAndConnect,
    setReady,
    leaveRoom,
    startGame,
    beginDiscovery,
    chooseDiscoveryOption,
    cancelDiscovery,
    backToMenu,
    resetBrowserSession,
  };
}
