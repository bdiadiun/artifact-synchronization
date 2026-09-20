# OHIF packaging and extension registration (fork at `v3.12.17`)

Read-only research in the submodule `viewer/`, branch `scoring`. Paths are relative to `viewer/`.

## 1. How are extensions registered, and when?

**Verdict: the list is fixed when the webpack config is evaluated (build start); nothing can be added to an already-built bundle this way.**

- `platform/app/pluginConfig.json:70` (our entry) is read by `platform/app/.webpack/writePluginImportsFile.js:1` (`require('../pluginConfig.json')`), invoked at the top level of the config file — `platform/app/.webpack/webpack.pwa.js:36`, and `rsbuild.config.ts:102`.
- It writes the git-ignored `platform/app/src/pluginImports.js` (`writePluginImportsFile.js:171`; `.gitignore:46`) with name pushes (`:50-62`) and one literal `await import("<packageName>")` per package (`:89-94`); webpack resolves each statically, so the chunk set is compile-time.
- Consumed at `platform/app/src/index.js:18`, registered at `platform/app/src/appInit.js:93-94` (`loadModules([...defaultExtensions, ...appConfig.extensions])` → `registerExtensions`), awaited before modes load (`:104`).

## 2. Is there runtime extension loading?

**Verdict: yes, one escape hatch — `window.config.extensions`, resolved by a native dynamic `import()`, usable with a URL or a global.**

- `appConfig.extensions` is merged into the build-time list (`appInit.js:93`); `appConfig` is `window.config` (`platform/app/src/index.js:23-37`), set by the runtime script `app-config.js` (copied at `webpack.pwa.js:118`; `dist/index.html` loads `src="/app-config.js"`); default empty at `platform/app/public/config/default.js:7`.
- A config file can be fetched after load: `platform/app/src/loadDynamicConfig.js:1-22` (`dangerouslyUseDynamicConfig.enabled` + a `configUrl` query parameter matching a regex).
- String entries fall through to `writePluginImportsFile.js:98` (`window.browserImportFunction(module)`) = plain `import(moduleId)` at `platform/app/public/html-templates/index.html:202-204`; the global variant is documented at `:210-215`. No module federation and no `window.extensionManager`, so a remote module brings its own `@ohif/core`/React and must register before `appInit` finishes.

## 3. Can `platform/app` be packaged and consumed by another application?

**Verdict: only as static files served at a domain root, not as an importable npm dependency.**

- Not private: `platform/app/package.json:11-13` (`publishConfig.access: "public"`), `:46-49` (`files: ["dist","README.md"]`); but `:9` `"main": "dist/index.umd.js"` names a file the build never produces. Production build: `:21`,`:27` webpack → `webpack.pwa.js:64-67` (`path: DIST_DIR`, `[name].bundle.[chunkhash].js`) plus `index.html` (`:125`).
- Built locally, `platform/app/dist` is **199 MB**: `ort/` 136 MB, `dicom-microscopy-viewer/` 20 MB, `app.bundle.<hash>.js` 15 MB, 102 top-level entries. URLs are absolute — `publicPath: PUBLIC_URL` default `'/'` (`webpack.pwa.js:19,67`), `dist/index.html` → `src="/app.bundle.<hash>.js"`, `platform/app/src/utils/publicUrl.ts:1`.
- Workable: serve `dist` at the root of its own port, configured by replacing `app-config.js` after install. Breaks: `import` of the package (dead `main`); sub-path hosting without a rebuild with `PUBLIC_URL`; npm size at 199 MB; the root-scoped service worker (`init-service-worker.js`).

## 4. Smallest permanent fork change

**Verdict: the two registration lines can stay frozen for behaviour routed through commands, customizations and service subscriptions; they reopen for a new module getter, a new id, or anything a mode names by string.**

- Free: `preRegistration` receives `servicesManager`, `commandsManager`, `extensionManager`, `appConfig` (`platform/core/src/extensions/ExtensionManager.ts:276-286`), so an internal handler registry, subscriptions, later `commandsManager.registerCommand` (`platform/core/src/classes/CommandsManager.ts:96`) and `setCustomizations` (`platform/core/src/services/CustomizationService/CustomizationService.ts:203`) need no fork edit.
- Reopens the diff: `onModeEnter`/`onModeExit`, captured once (`ExtensionManager.ts:288-294`); the `id` (`:260-273`); a `get*Module` property absent at registration (`:454-460`); anything a mode names statically, e.g. `modes/longitudinal/src/index.ts:15-16,32` (a `panelModule` string in `rightPanels`) — shipping a panel means editing a mode. A version bump still touches `platform/app/package.json:67` unless the range is loose (then only `yarn.lock`).

## 5. What the interface requires statically

**Verdict: only the `id`, the lifecycle hooks and the presence of the `get*Module` functions; everything they return is computed when they are called.**

- Interface `ExtensionManager.ts:44-53` (`preRegistration`, `getCommandsModule`, `getCustomizationModule`, `onModeEnter`, …); a missing `id` throws (`:262-266`). Module types are the fixed list `platform/core/src/extensions/MODULE_TYPES.js:1-14`; the manager iterates all of them and skips absent getters (`:297-341`, `:454-460`).
- Runtime-decidable: command definitions, panel components, customization values — each getter runs with the live managers (`:454-471`). A customization entry named `default` is applied at registration (`extensions/scoring-bridge/src/getCustomizationModule.tsx:27-38`); later changes go through `setCustomizations`.

## Design implications

- Treat the viewer as a deployed static site, not a library; embed it by URL, as the host does today.
- If it must be "installed", ship only `dist` served at a port root; never `import` `@ohif/app`.
- The fork diff stays at two lines while new behaviour arrives as commands, customizations and service subscriptions inside the adapter's own registry.
- A panel, viewport or toolbar slot pulls a mode file into the diff — prefer customizations.
- `window.config.extensions` works but duplicates `@ohif/core`/React; experiments only.
