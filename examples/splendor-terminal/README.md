# splendor-terminal

Playable terminal client for the Splendor example game.

Run it with:

```bash
bun run --cwd examples/splendor-terminal start
```

The client runs one local in-memory match with:

- `you`
- `bot-1`
- `bot-2`
- `bot-3`

It consumes the kernel's command discovery APIs to prompt for command families
and follow-up inputs.

The terminal client stays on the plain executor/session model. It does not need
to know whether the Splendor rules package is authored against plain state or a
decorated root-state facade.
