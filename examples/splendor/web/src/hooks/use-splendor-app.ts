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
  reserveDeckCardDiscoveryStart,
  reserveFaceUpCardDiscoveryStart,
  takeThreeDistinctGemsDiscoveryStart,
  takeTwoSameGemsDiscoveryStart,
  type DiscoveryResult,
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

type CommandType =
  | "buy_face_up_card"
  | "buy_reserved_card"
  | "choose_noble"
  | "reserve_deck_card"
  | "reserve_face_up_card"
  | "take_three_distinct_gems"
  | "take_two_same_gems";

type OpenDiscovery = Extract<DiscoveryResult, { complete: false }>;

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
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const latestPresenceTargetRef = useRef<PresenceTarget | null>(presenceTarget);
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

  useEffect(() => {
    latestPresenceTargetRef.current = presenceTarget;
  }, [presenceTarget]);

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
    clearReconnectTimer();
    shouldReconnectRef.current = true;

    liveRef.current = connectLive(token, {
      onOpen() {
        startTransition(() => {
          setLiveStatus("connected");
        });

        if (target.kind === "room") {
          liveRef.current?.send({
            type: "subscribe_room",
            roomId: target.roomId,
          });
          return;
        }

        liveRef.current?.send({
          type: "subscribe_game",
          gameSessionId: target.gameSessionId,
        });
      },
      onClose() {
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
              setPresenceTarget({ kind: "room", roomId: message.room.id });
              savePresenceTarget({ kind: "room", roomId: message.room.id });
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
              setPresenceTarget(nextTarget);
              savePresenceTarget(nextTarget);
            });
            liveRef.current?.send({
              type: "subscribe_game",
              gameSessionId: message.gameSessionId,
            });
            return;
          case "game_snapshot":
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
            return;
          case "game_discovery_result":
            startTransition(() => {
              const result = message.result;

              if (!result) {
                setDiscovery(null);
                setError("Discovery is unavailable for this action");
                setBusy(false);
                return;
              }

              if (result.complete) {
                const latestActiveCommandType =
                  latestActiveCommandTypeRef.current;
                if (!latestActiveCommandType) {
                  setError("Discovery completed without an active command");
                  setBusy(false);
                  return;
                }

                liveRef.current?.send({
                  type: "game_execute",
                  requestId: createRequestId(),
                  gameSessionId: message.gameSessionId,
                  command: {
                    type: latestActiveCommandType,
                    input: result.input,
                  },
                });
                setDiscovery(null);
                return;
              }

              setDiscovery(result as OpenDiscovery);
              setBusy(false);
            });
            return;
          case "game_execution_result":
            startTransition(() => {
              if (!message.accepted) {
                setError(message.reason);
              }
              setBusy(false);
            });
            return;
          case "game_available_commands":
            return;
          case "game_ended":
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
  }, []);

  useEffect(() => {
    if (!playerSessionToken || !presenceTarget) {
      return;
    }

    connectToLiveSocket(playerSessionToken, presenceTarget);

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
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
    if (!game) {
      return;
    }

    setBusy(true);
    setError(null);
    setActiveCommandType(commandType);
    liveRef.current?.send({
      type: "game_discover",
      requestId: createRequestId(),
      gameSessionId: game.gameSessionId,
      discovery: {
        type: commandType,
        ...DISCOVERY_STARTS[commandType],
      },
    });
  }

  function chooseDiscoveryOption(option: OpenDiscovery["options"][number]) {
    if (!game || !activeCommandType) {
      return;
    }

    setBusy(true);
    liveRef.current?.send({
      type: "game_discover",
      requestId: createRequestId(),
      gameSessionId: game.gameSessionId,
      discovery: {
        type: activeCommandType,
        step: option.nextStep,
        input: option.nextInput,
      },
    });
  }

  function cancelDiscovery() {
    resetTransientGameState();
  }

  function backToMenu() {
    shouldReconnectRef.current = false;
    clearReconnectTimer();
    clearPresenceTarget();
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
