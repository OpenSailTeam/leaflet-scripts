/*
  Deprecated compatibility shim.
  Use khmaps-loader.js instead:
  https://cdn.jsdelivr.net/gh/OpenSailTeam/leaflet-scripts@main/khmaps-loader.js
*/
(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  var shimState = (window.__KHMapsShimState = window.__KHMapsShimState || {
    warned: false,
    loading: false,
  });

  if (!shimState.warned) {
    shimState.warned = true;
    console.warn(
      "global-body.js is deprecated. Switch to khmaps-loader.js for split scoped modules.",
    );
  }

  if (shimState.loading) return;
  shimState.loading = true;

  function getShimBaseUrl() {
    var current = document.currentScript;
    if (current && current.src) {
      return current.src.replace(/[^/?#]+(\?.*)?$/, "");
    }
    var tag = document.querySelector('script[src*="global-body.js"]');
    if (tag && tag.src) {
      return tag.src.replace(/[^/?#]+(\?.*)?$/, "");
    }
    return "";
  }

  var baseUrl = getShimBaseUrl();
  if (!baseUrl) {
    console.error("KHMaps shim could not resolve base URL for khmaps-loader.js");
    return;
  }

  var src = baseUrl + "khmaps-loader.js";
  var existing = document.querySelector('script[data-khmaps-src="' + src + '"]');
  if (existing) return;

  var script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset.khmapsSrc = src;
  script.addEventListener("error", function (err) {
    console.error("KHMaps shim failed to load khmaps-loader.js", err);
  });
  (document.head || document.body || document.documentElement).appendChild(script);
})();
