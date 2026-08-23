# @tableverse-kit/client

Create one typed client for a Tableverse game frontend:

```ts
import { createTableverseClient } from "@tableverse-kit/client";
import type { executor } from "my-game-engine";

type Game = typeof executor;

export const client = createTableverseClient<Game>();
```

The client selects the supported connection automatically, so the same construction call works locally and after publishing.

Read the [client documentation](../docs/client/overview.mdx) for methods, local session options, and subscriptions.
