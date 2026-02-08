(function () {
  "use strict";

  if (typeof window === "undefined") return;

  var modules = (window.__KHMapsModules = window.__KHMapsModules || {});

  function normalizeQueueJob(job) {
    if (typeof job === "function") {
      return { kind: "function", fn: job };
    }

    if (!job || typeof job !== "object") {
      return { kind: "invalid" };
    }

    var type = String(job.type || "").trim();
    if (!type) {
      return { kind: "invalid" };
    }

    return {
      kind: "object",
      type: type,
      options: job.options,
      raw: job,
    };
  }

  function scopeForJobType(type) {
    switch (String(type || "")) {
      case "initMapPage":
        return "map-page";
      case "initMapToolPage":
        return "map-tool-page";
      case "initAllMapsPage":
        return "all-maps-page";
      case "initDefaultSort":
        return "default-sort";
      default:
        return null;
    }
  }

  function inferFallbackScopes() {
    var scopes = [];
    if (typeof document === "undefined") return scopes;

    if (document.getElementById("all-maps")) {
      scopes.push("all-maps-page");
    }

    if (document.getElementById("map")) {
      scopes.push("map-page", "map-tool-page", "default-sort");
    }

    return scopes;
  }

  modules.mapCommon = {
    normalizeQueueJob: normalizeQueueJob,
    scopeForJobType: scopeForJobType,
    inferFallbackScopes: inferFallbackScopes,
  };
})();
