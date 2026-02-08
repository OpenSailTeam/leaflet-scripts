# leaflet-scripts

Scoped KH map runtime files for Webflow, served via jsDelivr.

## Install (Webflow site footer)

```html
<script src="https://cdn.jsdelivr.net/gh/OpenSailTeam/leaflet-scripts@main/khmaps-loader.js"></script>
```

This single loader file will:
- ensure Leaflet + fullscreen dependencies are available,
- load required scoped runtime files,
- bootstrap `window.KHMaps`,
- drain `window.KHMapsQueue`.

## Queue contract

Supported jobs:

1. Function job (legacy, still supported):

```js
window.KHMapsQueue = window.KHMapsQueue || [];
window.KHMapsQueue.push(function (KHMaps) {
  KHMaps.initMapPage({ fullscreen: true, legend: true, statusDots: true });
});
```

2. Object job (recommended):

```js
window.KHMapsQueue = window.KHMapsQueue || [];
window.KHMapsQueue.push({ type: "initMapPage", options: { fullscreen: true, legend: true, statusDots: true } });
window.KHMapsQueue.push({ type: "initDefaultSort" });
```

Supported object job types:
- `initMapPage`
- `initMapToolPage`
- `initAllMapsPage`
- `initDefaultSort`

## File layout

- `khmaps-loader.js`: entrypoint loader.
- `runtime/khmaps-runtime.js`: KHMaps API + queue draining.
- `scopes/map-common.js`: shared queue/scope helpers.
- `scopes/map-page.js`: map template runtime.
- `scopes/map-tool-page.js`: map tool runtime.
- `scopes/all-maps-page.js`: all maps runtime.
- `scopes/default-sort.js`: Jetboost sort runtime.
- `global-body.js`: backward-compatible shim (deprecated).

## Troubleshooting

- If changes do not appear immediately, hard refresh and allow jsDelivr cache propagation.
- `@main` updates quickly but is not immutable. Use tags for deterministic releases when needed.
- If fullscreen plugin fails to load, map runtime still boots without fullscreen controls.
