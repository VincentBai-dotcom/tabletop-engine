import { Type, type Static } from "@sinclair/typebox";

/**
 * The CLI-facing build vocabulary, deliberately coarser than the platform's
 * stored status: `tvk upload` polls to a terminal state and does not
 * distinguish a timeout from any other failure.
 */
export const BuildStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("building"),
  Type.Literal("ready"),
  Type.Literal("failed"),
]);

export type BuildStatus = Static<typeof BuildStatusSchema>;

export const BuildStepSchema = Type.Object({
  name: Type.String(),
  status: BuildStatusSchema,
  startedAt: Type.Union([Type.String(), Type.Null()]),
  finishedAt: Type.Union([Type.String(), Type.Null()]),
});

export type BuildStep = Static<typeof BuildStepSchema>;

/** `GET /builds/:buildId` — polled every ≈2s by `tvk upload` until terminal. */
export const BuildResponseSchema = Type.Object({
  buildId: Type.String(),
  status: BuildStatusSchema,
  steps: Type.Array(BuildStepSchema),
  error: Type.Union([Type.String(), Type.Null()]),
  logsUrl: Type.Union([Type.String(), Type.Null()]),
});

export type BuildResponse = Static<typeof BuildResponseSchema>;
