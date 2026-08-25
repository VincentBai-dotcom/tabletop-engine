#!/usr/bin/env node

import "tsx";

const { main } = await import("../src/main.ts");
await main();
