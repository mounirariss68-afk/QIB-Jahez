---
name: ZIP import routing
description: Preview routing conflicts when running the complete imported Jahiz application.
---
An imported app can serve its page successfully while its API fails because a starter artifact still owns the API URL prefix.

**Why:** Jahiz responded correctly on its own port, but preview API requests went to the stopped starter service and returned 502. Moving the starter route away resolved the conflict without changing Jahiz.

**How to apply:** Check both the proxied page and API before declaring an import operational. Preserve the supplied app and Run command; resolve conflicting artifact routing rather than rewriting working source.
