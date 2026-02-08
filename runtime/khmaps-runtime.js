(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  var runtimeState = (window.__KHMapsRuntimeState = window.__KHMapsRuntimeState || {
    booted: false,
  });

  function bootstrapRuntime() {
    if (runtimeState.booted) return;
    runtimeState.booted = true;

    var modules = (window.__KHMapsModules = window.__KHMapsModules || {});
    var common = modules.mapCommon || {};

    var state = (window.__KHMapsState = window.__KHMapsState || {});

    function runQueuedJob(job) {
      var normalized =
        typeof common.normalizeQueueJob === "function"
          ? common.normalizeQueueJob(job)
          : { kind: typeof job === "function" ? "function" : "invalid", fn: job };

      if (normalized.kind === "function") {
        try {
          normalized.fn(window.KHMaps);
        } catch (err) {
          console.error("KHMaps queue function job failed", err);
        }
        return 1;
      }

      if (normalized.kind === "object") {
        return runObjectJob(normalized);
      }

      return 0;
    }

    function runObjectJob(job) {
      if (!window.KHMaps || typeof window.KHMaps !== "object") return 0;
      var method = window.KHMaps[job.type];
      if (typeof method !== "function") {
        console.warn("KHMaps queue object job ignored; unknown type:", job.type);
        return 0;
      }
      try {
        method(job.options);
      } catch (err) {
        console.error("KHMaps queue object job failed", job.type, err);
      }
      return 1;
    }

    function hasMapContainer() {
      return !!document.getElementById("map");
    }

    function hasAllMapsContainer() {
      return !!document.getElementById("all-maps");
    }

    function hasLeaflet() {
      if (typeof window.L !== "undefined") return true;
      console.error("Leaflet not found. Ensure leaflet.js is loaded.");
      return false;
    }

    function deferUntilDomReady(stateKey, callback) {
      if (document.readyState !== "loading") return false;
      if (state[stateKey]) return true;
      state[stateKey] = true;
      document.addEventListener(
        "DOMContentLoaded",
        function () {
          state[stateKey] = false;
          try {
            callback();
          } catch (err) {
            console.error("KHMaps deferred init failed", err);
          }
        },
        { once: true },
      );
      return true;
    }

    function ensureContainerMode(mapEl, mode) {
      if (!mapEl) return false;
      var existing = mapEl.getAttribute("data-khmaps-initialized");
      if (existing && existing !== mode) {
        console.warn(
          "KHMaps container already initialized with different mode:",
          existing,
          "requested:",
          mode,
        );
        return false;
      }
      if (existing === mode) return false;
      mapEl.setAttribute("data-khmaps-initialized", mode);
      return true;
    }

    function runLegacy(name) {
      var fn = modules[name];
      if (typeof fn !== "function") {
        console.warn("KHMaps scope not loaded for", name);
        return false;
      }
      fn();
      return true;
    }

    if (!window.KHMaps) {
      window.KHMaps = {
        initMapPage: function initMapPage(options) {
          if (!hasMapContainer()) {
            deferUntilDomReady("mapPageDeferred", function () {
              window.KHMaps.initMapPage(options);
            });
            return false;
          }
          if (!hasLeaflet()) return false;
          if (state.mapPageInitialized) return false;

          var mapEl = document.getElementById("map");
          if (!ensureContainerMode(mapEl, "map-page")) return false;

          state.mapPageOptions = options || {};
          state.mapPageInitialized = true;
          try {
            if (!runLegacy("runMapPageLegacy")) throw new Error("map-page module missing");
            return true;
          } catch (err) {
            state.mapPageInitialized = false;
            mapEl.removeAttribute("data-khmaps-initialized");
            console.error("KHMaps initMapPage failed", err);
            return false;
          }
        },

        initMapToolPage: function initMapToolPage(options) {
          if (!hasMapContainer()) {
            deferUntilDomReady("mapToolDeferred", function () {
              window.KHMaps.initMapToolPage(options);
            });
            return false;
          }
          if (!hasLeaflet()) return false;
          if (state.mapToolInitialized) return false;

          var mapEl = document.getElementById("map");
          if (!ensureContainerMode(mapEl, "map-tool")) return false;

          state.mapToolOptions = options || {};
          state.mapToolInitialized = true;
          try {
            if (!runLegacy("runMapToolLegacy")) throw new Error("map-tool module missing");
            return true;
          } catch (err) {
            state.mapToolInitialized = false;
            mapEl.removeAttribute("data-khmaps-initialized");
            console.error("KHMaps initMapToolPage failed", err);
            return false;
          }
        },

        initAllMapsPage: function initAllMapsPage(options) {
          if (!hasAllMapsContainer()) {
            deferUntilDomReady("allMapsDeferred", function () {
              window.KHMaps.initAllMapsPage(options);
            });
            return false;
          }
          if (!hasLeaflet()) return false;
          if (state.allMapsInitialized) return false;

          var mapEl = document.getElementById("all-maps");
          if (!ensureContainerMode(mapEl, "all-maps")) return false;

          state.allMapsOptions = options || {};
          state.allMapsInitialized = true;
          try {
            if (!runLegacy("runAllMapsLegacy")) throw new Error("all-maps module missing");
            return true;
          } catch (err) {
            state.allMapsInitialized = false;
            mapEl.removeAttribute("data-khmaps-initialized");
            console.error("KHMaps initAllMapsPage failed", err);
            return false;
          }
        },

        initDefaultSort: function initDefaultSort(options) {
          if (state.defaultSortInitialized) return false;
          state.defaultSortOptions = options || {};
          state.defaultSortInitialized = true;
          try {
            if (!runLegacy("runDefaultSortLegacy")) throw new Error("default-sort module missing");
            return true;
          } catch (err) {
            state.defaultSortInitialized = false;
            console.error("KHMaps initDefaultSort failed", err);
            return false;
          }
        },
      };
    }

    var pendingJobs = [];
    if (Array.isArray(window.KHMapsQueue)) {
      pendingJobs = window.KHMapsQueue.slice();
    }

    window.KHMapsQueue = {
      push: function push(job) {
        return runQueuedJob(job);
      },
    };

    pendingJobs.forEach(function (job) {
      runQueuedJob(job);
    });
  }

  window.__KHMapsBootstrapRuntime = bootstrapRuntime;
})();
