# Resolution Model Decisions

This is a living design document for the resolution model topic.

Update this file whenever a resolution-model design decision is agreed during discussion so future work can rely on persisted repo context instead of session memory.

## Agreed So Far

### Default resolution scope

The first version should use direct sequencing as the default resolution model.

Current high-level direction:

- games should resolve effects directly in sequence by default
- the kernel should not force an always-on stack or generic queue model in the first version
- richer resolution structures can be added later for games that genuinely need them

Implication:

- the first kernel can stay simple and broadly applicable
- ordinary ordered effect chains do not need to be modeled as a stack by default
- later stack-like or queue-like systems remain possible extensions rather than baseline assumptions

Rationale:

- many tabletop games only need straightforward ordered resolution
- internal-step chaining and queued triggers do not by themselves require a stack model
- this keeps the first kernel easier to reason about while leaving room for more advanced resolution later

### Extension path

If a game later needs richer resolution than direct sequencing, the exact extension shape should remain open for now.

Current high-level direction:

- the kernel should not yet commit to queue-only or stack-only as the single future extension path
- richer resolution may later take the form of a queue, a stack, or another explicit pending-work model depending on what later topics and implementation experience show

Implication:

- direct sequencing is the only locked default for now
- richer resolution remains a future design space rather than a prematurely fixed abstraction

Rationale:

- the right richer model depends on later work around triggers, steps, interruptions, and real implementation experience
- keeping the extension path open avoids overcommitting before the first working kernel exists

## Current discussion

We are discussing the near-term design goals in strict order.

Current topic:

4. resolution model
