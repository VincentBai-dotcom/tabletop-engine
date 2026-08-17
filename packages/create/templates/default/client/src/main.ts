import { createBridgeClient, type TableverseClient } from "@tableverse-kit/client";
import { createDevClient } from "@tableverse-kit/client/dev";
import type { executor } from "{{projectName}}-engine";

type Game = typeof executor;

function connect(): TableverseClient<Game> {
  if (import.meta.env.DEV) {
    const url = import.meta.env.VITE_TVK_DEV_URL ?? "http://localhost:5100";
    return createDevClient<Game>(url);
  }
  return createBridgeClient<Game>();
}

const client = connect();
const app = document.querySelector<HTMLElement>("#app");

const scoreButton = document.createElement("button");
scoreButton.textContent = "Score a point";
scoreButton.addEventListener("click", () => {
  void client.execute({ type: "score", input: { points: 1 } });
});

const view = document.createElement("pre");

function render(): void {
  const state = client.getView();
  view.textContent =
    state === null ? `${client.getStatus()}…` : JSON.stringify(state, null, 2);
}

if (app) {
  app.replaceChildren(scoreButton, view);
  client.subscribe(render);
  render();
}
