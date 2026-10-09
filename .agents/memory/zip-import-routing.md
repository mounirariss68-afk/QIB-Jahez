---
name: ZIP import routing
description: Preview routing conflicts when running the complete imported Jahiz application.
---
An imported app can serve its page successfully while its API fails because a starter artifact still owns the API URL prefix.

**Why:** Jahiz responded correctly on its own port, but preview API requests went to the stopped starter service and returned 502. Moving that route fixed requests, but a shell-launched process still left Replit's preview reporting that the app was not running.

**How to apply:** Use a managed service for the imported application and verify its running state, the proxied page, and the proxied API. Managed artifact commands execute from the artifact directory, so change to the imported app's root before invoking its supplied Run script. Preserve the supplied app and Run command; resolve service configuration rather than rewriting working source.

When starting a supplied secondary workflow, Replit may automatically replace its explicit external-port mapping with the internal port. Verify the public endpoint after startup, not just the local listener.

**Why:** The supplied Expo workflow started successfully, but its external mapping changed from 3000 to 8081, leaving the printed phone URL unreachable. Restoring the supplied configuration through the validated configuration callback made the public Metro status and Expo manifest respond without another restart.

**How to apply:** If the supplied phone URL fails while Metro is healthy, compare the live port mappings with the intended public URL. Do not treat a local listener as proof of phone connectivity.

A validated mapping restoration can be temporary: the platform changed the Expo mapping back to the internal port after the successful public checks. Do not assume one successful status/manifest request proves that a manually restored mapping will persist.

**Why:** The user subsequently could not open the mobile app; Metro was still running locally, but the printed external URL failed because the mapping had reverted.

**How to apply:** If the user has prohibited port or script changes, explain the mismatch and obtain approval before adjusting connection settings. Do not repeatedly restore the same mapping and report the link as durably fixed.

Prefer matching Metro's internal port to a supported public external port rather than depending on an automatically rewritten mapping. Replit's HTTPS endpoint also needs an `exps://` Expo Go link; Expo's generated plain `exp://` link can request HTTP instead.

**Why:** The public HTTPS manifest and native bundle succeeded after aligning the ports, while the plain HTTP endpoint returned an error. The console still generated a plain `exp://` QR even though the bundler proxy URL used HTTPS.

**How to apply:** Check the public manifest and its actual native bundle URL, then provide a QR encoding the secure Expo Go link. Preserve app code and package versions when fixing connection-only problems.
