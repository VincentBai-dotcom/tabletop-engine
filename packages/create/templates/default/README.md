# {{projectName}}

A Tableverse project scaffolded with `create-tableverse`. It is a pnpm
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

Start the local rules server and frontend:

```sh
pnpm dev
```

The frontend connects to the local server and re-renders on every state change.
Edit `engine/src` to change the rules and `client/src` to change the UI.
