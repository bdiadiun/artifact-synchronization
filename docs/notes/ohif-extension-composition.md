# Can one extension host others? (fork at `v3.12.17`)

Read-only research in `viewer/`, branch `scoring`; paths relative to `viewer/`. Extends `ohif-packaging.md` (build-time extension list), not repeated here. `EM` = `platform/core/src/extensions/ExtensionManager.ts`; `Mode` = `platform/app/src/routes/Mode/Mode.tsx`; `CS` = `platform/core/src/services/CustomizationService/CustomizationService.ts`.

## 1. What does `preRegistration` receive?

**The five managers plus its own configuration, and `extensionManager` itself is among them; `peerImport` is declared but never passed.** `EM:276-286` passes `servicesManager`, `serviceProvidersManager`, `commandsManager`, `hotkeysManager`, `extensionManager: this`, `appConfig`, `configuration`, and is `await`ed (`:277`), so async setup is allowed. `ExtensionParams` also declares `peerImport` (`:33`), absent from that literal, so a host extension cannot load a package by name through the hook. Module getters get a smaller set that also includes `extensionManager` (`EM:454-461`).

## 2. Can `registerExtension` be called from inside `preRegistration`, or later?

**Supported, not merely tolerated: public (`EM:251`), re-entrant, idempotent per id, and OHIF itself calls it after the initial pass.** The outer loop iterates the _argument array_ (`EM:225-241`), never `registeredExtensionIds`, so a nested call cannot disturb it. Each call is self-contained: throw on null (`:256-258`), throw on a missing `id` (`:262-267`), `log.warn` + early `return` on a duplicate id (`:269-274`), hooks captured (`:288-294`), module loop (`:297-341`), `registeredExtensionIds.push` last (`:344`). A nested child lands in that list before its parent, which only shifts `onModeEnter` / `onModeExit` order (`EM:168-180`, `:183-199`). Precedent: `Mode:89-95` registers a mode's extensions after `appInit` (`platform/app/src/appInit.js:94`).

## 3. Which module types still take effect when registration happens late?

Late = during another extension's `preRegistration` inside `appInit`, before any mode is entered.

- **Commands** — yes, applied at once (`EM:307-309`, `:618-655`).
- **Customizations** — yes: `modulesMap` filled (`EM:519-528`), and `init` re-reads `getRegisteredExtensionIds()` on every mode enter (`CS:112-132`, `:141-144`).
- **Hanging protocols** — yes: auto-added at registration (`EM:486-495`); `reset()` / `onModeEnter()` keep `protocols` (`.../HangingProtocolService/HangingProtocolService.ts:156-168`).
- **Utilities, contexts, state sync, layout templates** — yes, resolved by string at call time (`EM:359-361`; `modes/basic/src/initToolGroups.ts:14`, `Mode:344-347`, `:378-392`).
- **Data sources** — the module registers (`EM:597-615`), but `addDataSource` fires only for definitions in the `dataSources` argument, i.e. `appConfig.dataSources` (`appInit.js:94`); a nested call passes none, so call `addDataSource` explicitly (`EM:531-540`).
- **Panels / viewports / SOP class handlers** — lookup is late (`PanelService.tsx:49`, `extensions/default/src/ViewerLayout/index.tsx:92,121`, `DisplaySetService.ts:357`), but the names come from the mode (`modes/longitudinal/src/index.ts:14-18,31-39`; `Mode:180`) — earlier note confirmed.
- **Toolbar** — split: `evaluate` handlers land at registration (`EM:501-509`, `ToolbarService.ts:145-146`) and are read when a section is built (`:706-718`, `:748-751`); buttons come from the mode.

## 4. What identifies an extension, and what breaks with related ids?

**`extension.id` namespaces modules but not commands.** Module ids are `${extensionId}.${moduleType}.${element.name}` (`EM:519-524`, `:600`); a nameless element throws (`:521-523`); a repeated id is skipped with a warning (`:269-274`). Commands are flat `context[commandName]` (`platform/core/src/classes/CommandsManager.ts:110-119`) — a second extension using the same command name silently overwrites the first. Customization keys are global too; only the `.customizationModule.default|global` entry is scoped (`CS:120,126`).

## 5. Ordering and dependencies

**No resolver.** A sequential loop, with a comment that no `postInit` hook exists (`EM:219-241`); order is the array order from `pluginConfig.json` → generated `platform/app/src/pluginImports.js:11-14` → `appInit.js:93`. A mode's `extensionDependencies` (`modes/longitudinal/src/index.ts:20-24`) is registered if absent (`Mode:67,89-95`), but its versions are checked nowhere. A host extension registering its own children does get a deterministic order: its slot, children first.

## Verdict

One adapter extension, registered once in the fork, importing our packages statically and calling `extensionManager.registerExtension(child)` per child inside `preRegistration`, works at `v3.12.17`. Each child keeps its own id, commands, customizations, hanging protocols, utilities and toolbar evaluators, so a new capability becomes a change in our packages only. Still needs the fork: the single `pluginConfig.json` entry and workspace dependency for the adapter (`loadModule` is generated from literals — `ohif-packaging.md` §1); any panel, viewport or toolbar button, which a mode must name; and a data source, which needs an explicit `addDataSource`.

## Design implications

- Make the fork's one extension entry an adapter; ship features as its child extensions.
- Register children in `preRegistration`: `extensionManager` is in scope, registration is re-entrant.
- Distinct id per child, and prefix command names — ids do not namespace commands.
- Import children statically; `peerImport` is not available in `preRegistration`.
- Anything a mode names (panel, viewport, SOP handler, toolbar button) stays a fork edit; prefer commands, customizations and service subscriptions.
