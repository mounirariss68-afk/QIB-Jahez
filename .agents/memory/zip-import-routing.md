---
name: ZIP import routing
description: Preview routing conflicts when running the complete imported Jahiz application.
---
An imported app can serve its page successfully while its API fails because a starter artifact still owns the API URL prefix.

**Why:** Jahiz responded correctly on its own port, but preview API requests went to the stopped starter service and returned 502. Moving that route fixed requests, but a shell-launched process still left Replit's preview reporting that the app was not running.

**How to apply:** Use a managed service for the imported application and verify its running state, the proxied page, and the proxied API. Managed artifact commands execute from the artifact directory, so change to the imported app's root before invoking its supplied Run script. Preserve the supplied app and Run command; resolve service configuration rather than rewriting working source.

When starting a supplied secondary workflow, Replit may automatically replace its explicit external-port mapping with the internal port. Verify the public endpoint after startup, not just the local listener.

**Why:** The supplied Expo workflow started successfully, but its external mapping changed from 3000 to 8081, leaving the printed phone URL unreachable. Restoring the supplied configuration through the validated configuration callback made the public Metro status and Expo manifest respond without another restart.

**How to apply:** If the supplied phone URL fails while Metro is healthy, compare the live port mappings with the imported configuration. Restore the intended mapping through the validated configuration tooling; do not change the app's scripts or choose different ports.
