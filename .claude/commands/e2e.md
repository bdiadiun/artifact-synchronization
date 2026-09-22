---
description: Start both apps and run a browser scenario against them
---

Start the viewer and the host app, run the scenario named in $ARGUMENTS (default: the totals
scenario), then stop every server you started.

```
npm run viewer:link                                        # once: the fork runs the working-tree packages
npm run viewer:dev   # terminal 1, wait for "compiled successfully"
npm run dev --workspace host-app                            # terminal 2
```

Drive the page with Playwright from the session scratchpad (`pw/` holds the existing scripts:
totals, length, delete, live update, focus, restore). Read real values from the page and from
`window.services` inside the viewer iframe, take one screenshot, and report the observed numbers
and a PASS or FAIL per check. Ports 3000 and 5173 must be free before you start and free again
afterwards. The link is for the run only: `npm run viewer:unlink` restores the installed copies,
and a release is pinned in the fork only after this scenario passed on the linked tree.
