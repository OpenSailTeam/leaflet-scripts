/*
  KHMaps loader for jsDelivr.
  Include this single file site-wide:
  https://cdn.jsdelivr.net/gh/OpenSailTeam/leaflet-scripts@main/khmaps-loader.js
*/
(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  var state = (window.__KHMapsLoaderState = window.__KHMapsLoaderState || {
    started: false,
    booted: false,
    scripts: {},
  });

  var LEAFLET_SRC = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  var FULLSCREEN_SRC = "https://unpkg.com/leaflet.fullscreen/dist/Control.FullScreen.umd.js";

  function getLoaderBaseUrl() {
    var current = document.currentScript;
    if (current && current.src) {
      return current.src.replace(/[^/?#]+(\?.*)?$/, "");
    }

    var tag = document.querySelector('script[src*="khmaps-loader.js"]');
    if (tag && tag.src) {
      return tag.src.replace(/[^/?#]+(\?.*)?$/, "");
    }

    return "";
  }

  var BASE_URL = getLoaderBaseUrl();

  function isLeafletLoaded() {
    return typeof window.L !== "undefined";
  }

  function isFullscreenLoaded() {
    return !!(
      window.L &&
      ((window.L.control && window.L.control.fullscreen) ||
        (window.L.Control && (window.L.Control.Fullscreen || window.L.Control.FullScreen)))
    );
  }

  function loadScript(src, isLoadedCheck) {
    if (typeof isLoadedCheck === "function" && isLoadedCheck()) {
      return Promise.resolve();
    }

    if (state.scripts[src]) {
      return state.scripts[src];
    }

    state.scripts[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-khmaps-src="' + src + '"]');
      if (existing) {
        if (existing.getAttribute("data-khmaps-loaded") === "true") {
          resolve();
          return;
        }
        existing.addEventListener("load", function () {
          existing.setAttribute("data-khmaps-loaded", "true");
          resolve();
        });
        existing.addEventListener("error", function (err) {
          reject(err || new Error("Failed loading script: " + src));
        });
        return;
      }

      var script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.khmapsSrc = src;
      script.addEventListener("load", function () {
        script.setAttribute("data-khmaps-loaded", "true");
        resolve();
      });
      script.addEventListener("error", function (err) {
        reject(err || new Error("Failed loading script: " + src));
      });
      (document.head || document.body || document.documentElement).appendChild(script);
    });

    return state.scripts[src];
  }

  function loadInternal(path) {
    if (!BASE_URL) {
      return Promise.reject(new Error("Unable to resolve khmaps-loader base URL"));
    }
    return loadScript(BASE_URL + path);
  }

  function unique(list) {
    var out = [];
    var seen = {};
    list.forEach(function (item) {
      if (!item || seen[item]) return;
      seen[item] = true;
      out.push(item);
    });
    return out;
  }

  function getQueueSnapshot() {
    if (Array.isArray(window.KHMapsQueue)) {
      return window.KHMapsQueue.slice();
    }
    return [];
  }

  function resolveRequiredScopes() {
    var modules = window.__KHMapsModules || {};
    var common = modules.mapCommon || {};
    var toScope = common.scopeForJobType;
    var fallback = common.inferFallbackScopes;

    var queue = getQueueSnapshot();
    var scopes = [];
    var hasObjectJobs = false;
    var hasFunctionJobs = false;

    queue.forEach(function (job) {
      if (typeof job === "function") {
        hasFunctionJobs = true;
        return;
      }
      if (!job || typeof job !== "object") {
        return;
      }
      if (!job.type) return;
      hasObjectJobs = true;
      var scope = typeof toScope === "function" ? toScope(job.type) : null;
      if (scope) scopes.push(scope);
    });

    if (!hasObjectJobs || hasFunctionJobs) {
      var fallbackScopes = typeof fallback === "function" ? fallback() : [];
      scopes = scopes.concat(fallbackScopes);
    }

    return unique(scopes);
  }

  function loadScopesSequentially(scopes) {
    var scopeToFile = {
      "map-page": "scopes/map-page.js",
      "map-tool-page": "scopes/map-tool-page.js",
      "all-maps-page": "scopes/all-maps-page.js",
      "default-sort": "scopes/default-sort.js",
    };

    var chain = Promise.resolve();
    scopes.forEach(function (scope) {
      var file = scopeToFile[scope];
      if (!file) return;
      chain = chain.then(function () {
        return loadInternal(file);
      });
    });

    return chain;
  }

  function bootRuntime() {
    if (state.booted) return;
    state.booted = true;

    if (typeof window.__KHMapsBootstrapRuntime === "function") {
      window.__KHMapsBootstrapRuntime();
      return;
    }

    console.error("KHMaps runtime bootstrap function missing.");
  }

  function start() {
    if (state.started) return;
    state.started = true;

    loadScript(LEAFLET_SRC, isLeafletLoaded)
      .then(function () {
        return loadScript(FULLSCREEN_SRC, isFullscreenLoaded).catch(function (err) {
          console.warn("KHMaps fullscreen plugin failed to load", err);
        });
      })
      .then(function () {
        return loadInternal("scopes/map-common.js");
      })
      .then(function () {
        var scopes = resolveRequiredScopes();
        return loadScopesSequentially(scopes);
      })
      .then(function () {
        return loadInternal("runtime/khmaps-runtime.js");
      })
      .then(function () {
        bootRuntime();
      })
      .catch(function (err) {
        console.error("KHMaps loader failed", err);
      });
  }

  start();
})();
