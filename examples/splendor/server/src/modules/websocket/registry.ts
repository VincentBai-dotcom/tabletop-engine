import type {
  LiveConnection,
  LiveConnectionRegistry,
  LiveSubscription,
  RemovedLiveConnection,
} from "./model";

interface RegistryRecord {
  connection: LiveConnection;
  subscription: LiveSubscription | null;
}

export function createLiveConnectionRegistry(): LiveConnectionRegistry {
  const byPlayerSessionId = new Map<string, RegistryRecord>();
  const playerSessionIdByConnectionId = new Map<string, string>();

  function getRecord(playerSessionId: string): RegistryRecord {
    const record = byPlayerSessionId.get(playerSessionId);
    if (!record) {
      throw new Error("live_connection_not_found");
    }
    return record;
  }

  function removePlayerSession(playerSessionId: string) {
    const record = byPlayerSessionId.get(playerSessionId);
    if (!record) {
      return null;
    }

    byPlayerSessionId.delete(playerSessionId);
    playerSessionIdByConnectionId.delete(record.connection.id);

    return {
      playerSessionId,
      subscription: record.subscription,
    } satisfies RemovedLiveConnection;
  }

  return {
    register(playerSessionId, connection) {
      removePlayerSession(playerSessionId);
      byPlayerSessionId.set(playerSessionId, {
        connection,
        subscription: null,
      });
      playerSessionIdByConnectionId.set(connection.id, playerSessionId);
    },

    getConnection(playerSessionId) {
      return byPlayerSessionId.get(playerSessionId)?.connection ?? null;
    },

    getPlayerSessionIdByConnectionId(connectionId) {
      return playerSessionIdByConnectionId.get(connectionId) ?? null;
    },

    getGameConnectionForPlayer(playerSessionId, gameSessionId) {
      const record = byPlayerSessionId.get(playerSessionId);
      if (
        record?.subscription?.type !== "game" ||
        record.subscription.gameSessionId !== gameSessionId
      ) {
        return null;
      }

      return record.connection;
    },

    subscribeToRoom(playerSessionId, roomId) {
      getRecord(playerSessionId).subscription = { type: "room", roomId };
    },

    subscribeToGame(playerSessionId, gameSessionId) {
      getRecord(playerSessionId).subscription = {
        type: "game",
        gameSessionId,
      };
    },

    getRoomConnections(roomId) {
      return [...byPlayerSessionId.values()]
        .filter((record) => {
          const { subscription } = record;
          return (
            subscription?.type === "room" && subscription.roomId === roomId
          );
        })
        .map((record) => record.connection);
    },

    getGameConnections(gameSessionId) {
      return [...byPlayerSessionId.values()]
        .filter((record) => {
          const { subscription } = record;
          return (
            subscription?.type === "game" &&
            subscription.gameSessionId === gameSessionId
          );
        })
        .map((record) => record.connection);
    },

    getConnections() {
      return [...byPlayerSessionId.values()].map((record) => record.connection);
    },

    removeConnection(connectionId) {
      const playerSessionId =
        playerSessionIdByConnectionId.get(connectionId) ?? null;
      if (!playerSessionId) {
        return null;
      }

      return removePlayerSession(playerSessionId);
    },
  };
}
