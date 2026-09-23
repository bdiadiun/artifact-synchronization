# OHIF 3.12.x: service availability at extension `preRegistration`

Question: at the moment our bridge extension's `preRegistration` runs, are
`measurementService`, `toolGroupService`, `cornerstoneViewportService`,
`viewportGridService`, `displaySetService` guaranteed present on
`servicesManager.services`?

## Mechanics

`ServicesManager.registerService` writes `this.services[service.name]`
synchronously: `viewer/platform/core/src/services/ServicesManager.ts:46`
(`this.services[service.name] = service.create(...)`); the service is live
as soon as the call returns.

`ExtensionManager.registerExtensions` runs a sequential `for` loop, awaiting
each `registerExtension` in turn (`viewer/platform/core/src/extensions/ExtensionManager.ts:215-240`);
inside it, `preRegistration` is awaited before module registration continues
(`ExtensionManager.ts:276-283`). Extension N+1's `preRegistration` cannot
start before extension N's has fully resolved.

`appInit.js` registers `MeasurementService`, `DisplaySetService`, and
`ViewportGridService` directly via `servicesManager.registerServices([...])`
(`viewer/platform/app/src/appInit.js:64-79`, entries at lines 69, 71, 74).
That call finishes before `extensionManager.registerExtensions(...)` is even
called, at line 94 — no extension's `preRegistration` can run earlier.

`toolGroupService` and `cornerstoneViewportService` are not in that core
list; `@ohif/extension-cornerstone` registers them itself, inside its own
`preRegistration` (`viewer/extensions/cornerstone/src/index.tsx:193-194`),
synchronously, before that call returns.

`viewer/platform/app/pluginConfig.json` lists `@ohif/extension-cornerstone`
at index 1 and `@bdiadiun/ohif-extension-loader` last (index 14).
Since `registerExtensions` is sequential, cornerstone's `preRegistration`
has already completed by the time the adapter's starts.

The adapter registers our bridge extension from inside its own
`preRegistration`, via `registerChildren`, which `await`s
`extensionManager.registerExtension(child)` per child in a `for` loop
(`packages/ohif-extension-loader/src/registerChildren.ts:5-14`). This nests our
bridge's `preRegistration` one level deeper but does not change the
ordering: it still runs after the adapter's slot in the top-level list,
i.e. after cornerstone.

## Table

| service                      | registered by                                | guaranteed           | why                                                     |
| ---------------------------- | -------------------------------------------- | -------------------- | ------------------------------------------------------- |
| `measurementService`         | `@ohif/core`, `appInit.js:70`                | yes                  | core list resolves before any extension loads           |
| `displaySetService`          | `@ohif/core`, `appInit.js:71`                | yes                  | same                                                    |
| `viewportGridService`        | `@ohif/core`, `appInit.js:74`                | yes                  | same                                                    |
| `toolGroupService`           | cornerstone preRegistration, `index.tsx:194` | yes, order-dependent | sequential loop; adapter is last in `pluginConfig.json` |
| `cornerstoneViewportService` | cornerstone preRegistration, `index.tsx:193` | yes, order-dependent | same                                                    |

## Conclusion

All five services exist on `servicesManager.services` by the time our
bridge extension's `preRegistration` runs, under the current
`pluginConfig.json` order. The three core services are unconditionally
guaranteed — registered before any extension runs at all. `toolGroupService`
and `cornerstoneViewportService` are conditionally guaranteed: the guarantee
rests on extension order in `pluginConfig.json`, not a language contract, so
it is a config invariant worth protecting (a comment in `pluginConfig.json`,
or one runtime guard at bridge startup) rather than a type-system fact. The
architect can type all five as required in `OhifServices`; keep one narrow
runtime check for the two order-dependent services, and drop the "service
unavailable" branches for the other three.
