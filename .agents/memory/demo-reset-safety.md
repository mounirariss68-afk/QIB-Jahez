---
name: Demo reset safety
description: Long demo resets can outlive the web request; avoid duplicate destructive resets.
---

Do not repeat a demo reset just because its web request returns a gateway error.

**Why:** A reset request returned HTTP 502 while the server continued rebuilding the synthetic customers and replaying history. Sending another reset then would destroy data underneath the rebuild already in progress.

**How to apply:** Check server progress first, then monitor the existing operation read-only. Confirm that history replay, the scenario snapshot, and clock persistence have finished before reporting success. The presence of customer records or a new seed timestamp alone is not proof of completion. Do not restart the server during a healthy rebuild.
