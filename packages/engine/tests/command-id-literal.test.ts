import { expectTypeOf, test } from "vitest";
import { createCommandFactory, t } from "../src/index.ts";

class S {
  readonly _ = 0;
}

test("built command preserves its commandId literal", () => {
  const define = createCommandFactory<S>();
  const cmd = define({
    commandId: "buy_card",
    commandSchema: t.object({ cardId: t.number() }),
  })
    .validate(() => ({ ok: true as const }))
    .execute(() => {})
    .build();

  expectTypeOf(cmd.commandId).toEqualTypeOf<"buy_card">();

  // Input type still flows (structurally { cardId: number }); asserted via
  // assignment rather than toEqualTypeOf, whose strict identity check trips on
  // the schema's `& {}` intersection.
  const input: { cardId: number } = cmd.commandSchema.static;
  void input;
});
