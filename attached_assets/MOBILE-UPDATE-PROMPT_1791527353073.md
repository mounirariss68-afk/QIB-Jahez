# Replit prompt — add QIB Mobile (demo, Expo Go) to the running Jahiz project

For the Replit project that is already running Jahiz. Three steps; only step 2 needs the Agent.

1. **Upload the update.** In the Replit file tree, drag `qib-jahiz-mobile-update.zip` into the project root (next to `package.json`). Wait until it appears in the tree.
2. **Paste the text below the line into Replit's Agent** and send it.
3. **Make the development URL public for the phone.** Open **Developer tools → Networking** and switch **Private development URL** off. (Expo Go on your phone is not signed in to Replit; with the private setting on, it is redirected to a sign-in page and the app cannot load.) Switch it back on after the demo if you prefer.

Then, in the workflow picker next to the **Run** button, start **QIB Mobile (Expo Go)**. The first start installs the mobile app's packages (about a minute) and prints a QR code in that workflow's console. Install **Expo Go** on your phone (App Store / Google Play) and scan the code: iPhone with the Camera app, Android from inside Expo Go. Keep the **Jahiz** workflow running at the same time; the phone reads from it.

After the update, open Settings in Jahiz and press **Reset the demo** once (about a minute): the new seed gives the employer in scenario 2 exactly its fourteen staff.

---

I uploaded `qib-jahiz-mobile-update.zip` to the project root. It adds a phone mock-up (an Expo app in `apps/mobile`) and its API to this project. Apply it as follows and change nothing else.

1. Unzip `qib-jahiz-mobile-update.zip` into the project root, overwriting the files it contains. It adds `apps/mobile/` (the Expo app), `apps/server/src/api/mobile.ts`, `tools/replit-mobile.sh`, `MOBILE-UPDATE-PROMPT.md` and `design/DESIGN.md`, and replaces `.replit`, `package.json`, `README.md`, `.gitignore`, `apps/server/src/index.ts`, `apps/server/src/agents/muwathiq.ts` and `apps/server/src/seed/base.ts`. Then delete the zip file. Do not edit, reformat or "improve" any of these files, and do not touch any other file.

2. `apps/mobile` is a standalone package with its own `package.json`, deliberately not part of the root npm workspaces. Do not run `npm install` for it yourself and do not add it to the root workspaces: `tools/replit-mobile.sh` installs it on first start. Do not add, remove or upgrade any package anywhere.

3. Make sure two workflows exist as `.replit` defines them: **Jahiz** (the Run button) running `bash tools/replit-run.sh` and waiting for port 5000, and **QIB Mobile (Expo Go)** running `bash tools/replit-mobile.sh` and waiting for port 8081. Port 5000 stays on external port 80; port 8081 must be exposed on external port 3000, exactly as `.replit` says. If the workflow definitions in `.replit` are not picked up by this workspace, create the same two workflows through the workspace's workflow settings, with those exact commands, and leave `.replit` as it is.

4. Restart the **Jahiz** workflow so the server picks up `/api/mobile`. Confirm `GET /api/mobile/customers` on the app's URL returns a list of demo customers.

5. Start the **QIB Mobile (Expo Go)** workflow. When Metro is up, show me the QR code or the `exp://` / `https://…:3000` link it printed. If the start fails because a port is in use, stop and tell me; do not change the ports or the script.

6. Tell me whether this app's development URL is set to private (Developer tools → Networking). Do not change that setting yourself; if it is private, tell me so I switch it off for the phone.

Do not add any API key or secret. Do not run or edit the database. When everything is running, summarise in three lines what is up and stop.
