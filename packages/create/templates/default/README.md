# {{projectName}}

A Tableverse project scaffolded with `create-tableverse-kit`. It is a pnpm
workspace with two packages:

- **`engine/`** — your game's rules: state, commands, events, and stage flow,
  built with `@tableverse-kit/engine`. This is what the platform runs.
- **`client/`** — the frontend that renders the game, built with Vite. It talks
  to the rules through `@tableverse-kit/client` and never runs the engine
  itself.

## Develop

```sh
pnpm install
```

In one terminal, run the local rules server:

```sh
pnpm dev:server
```

In another, serve the frontend:

```sh
pnpm dev:web
```

The frontend connects to the local server and re-renders on every state change.
Edit `engine/src` to change the rules and `client/src` to change the UI.
