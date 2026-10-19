---
name: ZIP import routing
description: Preview routing conflicts when running the complete imported Jahiz application.
---
An imported app can serve its page successfully while its API fails because a starter artifact still owns the API URL prefix.

**Why:** Jahiz responded correctly on its own port, but preview API requests went to the stopped starter service and returned 502. Moving that route fixed requests, but a shell-launched process still left Replit's preview reporting that the app was not running.

**How to apply:** Use a managed service for the imported application and verify its running state, the proxied page, and the proxied API. Managed artifact commands execute from the artifact directory, so change to the imported app's root before invoking its supplied Run script. Preserve the supplied app and Run command; resolve service configuration rather than rewriting working source.

After task merges, a successful setup/reconciliation result alone does not prove every managed service is running.

**Why:** Reconciliation reported success while the API workflow was marked finished, even though its endpoint still responded. Explicitly restarting the managed API workflow restored both its running state and healthy endpoint.

**How to apply:** Check the API and Expo workflow states as well as HTTP responses after reconciliation. Start the existing managed API service if needed rather than launching a duplicate server or changing the supplied Run command.

When starting a supplied secondary workflow, Replit may automatically replace its explicit external-port mapping with the internal port. Verify the public endpoint after startup, not just the local listener.

**Why:** The supplied Expo workflow started successfully, but its external mapping changed from 3000 to 8081, leaving the printed phone URL unreachable. Restoring the supplied configuration through the validated configuration callback made the public Metro status and Expo manifest respond without another restart.

**How to apply:** If the supplied phone URL fails while Metro is healthy, compare the live port mappings with the intended public URL. Do not treat a local listener as proof of phone connectivity.

A validated mapping restoration can be temporary: the platform changed the Expo mapping back to the internal port after the successful public checks. Do not assume one successful status/manifest request proves that a manually restored mapping will persist.

**Why:** The user subsequently could not open the mobile app; Metro was still running locally, but the printed external URL failed because the mapping had reverted.

**How to apply:** If the user has prohibited port or script changes, explain the mismatch and obtain approval before adjusting connection settings. Do not repeatedly restore the same mapping and report the link as durably fixed.

Prefer matching Metro's internal port to a supported public external port rather than depending on an automatically rewritten mapping. Replit's HTTPS endpoint also needs an `exps://` Expo Go link; Expo's generated plain `exp://` link can request HTTP instead.

**Why:** The public HTTPS manifest and native bundle succeeded after aligning the ports, while the plain HTTP endpoint returned an error. The console still generated a plain `exp://` QR even though the bundler proxy URL used HTTPS.

**How to apply:** Check the public manifest and its actual native bundle URL, then provide a QR encoding the secure Expo Go link. Preserve app code and package versions when fixing connection-only problems.

Do not equate successful agent-side manifest and bundle requests with a successful physical-phone launch.

**Why:** The compatible iPhone Expo Go client rejected the manifest, and the user reported seeing Jahiz in Safari at the explicit secondary-port URL even while agent-side public requests returned Expo JSON.

**How to apply:** Treat the device report as an unresolved discrepancy, not as proof of an outdated client. Isolate the Expo connection behind a separate standard-HTTPS host when secondary-port behavior differs, and distinguish server verification from physical-device verification in the handoff.

Physical iPhone development-server launches require Expo Go and Expo CLI to be signed into the same Expo account. Signing out on the phone is not an anonymous-preview workaround.

**Why:** After the tunnel delivered the manifest successfully, the phone explicitly rejected the unsigned-in CLI. Expo's official troubleshooting documentation confirms that both sides must be signed in, even though the server keeps running without an account warning.

**How to apply:** Ask the user to run `npx expo login` themselves in the mobile package's Shell directory, using the same account as Expo Go, then tap Try Again. Do not request passwords or store account names. First-time sign-in does not require a server restart; switching accounts does.

Reference: https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/

Mobile connectivity verification must cover the customer API and sign-in home payload, not only the Expo manifest and JavaScript bundle.

**Why:** The native welcome screen opened on the user's iPhone, but its customer picker remained blank even though agent-side requests to the separate Replit API returned customers.

**How to apply:** Prefer routing demo API requests through the same working HTTPS connection as the native bundle when phone behavior differs. Verify the bundled public API setting and the customer list/home responses through that connection, while preserving the imported native source and dependencies.
