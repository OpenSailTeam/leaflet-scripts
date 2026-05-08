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
- `snippets/parcels-deeplink-inline.js`: inline script source for `/maps/parcels` deep-linking.
- `global-body.js`: backward-compatible shim (deprecated).

## Parcels -> map popup deep-link

Use `snippets/parcels-deeplink-inline.js` on the `/maps/parcels` page (Webflow footer custom code or embedded script) to append:
- `khLotSlug` (primary) from `data-kh-lot-slug` or `data-lot-slug`
- `khLotName` (fallback) from `[data-lot-field='name']`

The script targets `a[data-popup-card][href*='/map/']`, preserves existing query/hash params, and rebinds on DOM mutations (Jetboost/list updates).

Example include:

```html
<script src="https://cdn.jsdelivr.net/gh/OpenSailTeam/leaflet-scripts@main/snippets/parcels-deeplink-inline.js"></script>
```

## Map tool assignment editor

`initMapToolPage` now renders an assignment editor inside shape popups.

- Managers can search lots by title, slug, or shape-id fields.
- Popups support assigning a selected lot, clearing assignment, and saving.
- Saves are posted to Zapier via browser-safe form `POST` (`no-cors`).

Webhook URL resolution:
- Required on the map container:

```html
<div id="map" data-assignment-webhook-url="https://hooks.zapier.com/hooks/catch/..."></div>
```

Webhook payload keys:
- `eventType` (`shape_lot_assignment_update`)
- `timestamp`
- `pageUrl`
- `shape.elementSvgId`
- `currentAssignment` (`lotSlug`, `lotName`, `lotPid`) or `null`
- `nextAssignment` (`lotSlug`, `lotName`, `lotPid`) or `null`
- `selectionMeta.queryText`
- `selectionMeta.duplicateDetected`
- `selectionMeta.duplicateShapeIds`
- `payloadJson` (full JSON payload serialized as a string form field)

## Troubleshooting

- If changes do not appear immediately, hard refresh and allow jsDelivr cache propagation.
- `@main` updates quickly but is not immutable. Use tags for deterministic releases when needed.
- If fullscreen plugin fails to load, map runtime still boots without fullscreen controls.
