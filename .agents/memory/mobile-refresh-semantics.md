---
name: Mobile refresh semantics
description: Why user pulls, demo polls, and post-action updates have different request semantics.
---
Keep demo polling on its six-second cadence, skipping busy ticks rather than accumulating requests or waiting six seconds after each response.

**Why:** Demo messages should still appear promptly after fast responses; slow responses must not build up a backlog. This fixes the verified refresh indicator behavior, not an unconfirmed Expo restart.

**How to apply:** Keep polls and action-driven updates silent. A pull may share a pending request, but an update after a customer action must fetch data newer than any request started before that action. Preserve these distinctions when changing the mobile session lifecycle.
