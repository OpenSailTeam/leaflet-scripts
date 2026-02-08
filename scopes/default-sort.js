(function () {
  "use strict";

  if (typeof window === "undefined") return;
  var modules = (window.__KHMapsModules = window.__KHMapsModules || {});

  modules.runDefaultSortLegacy = function runDefaultSortLegacy() {
  (function () {
    "use strict";

    var SELECTOR = "select#field.w-select";
    var FALLBACK_SELECTOR = "select.w-select";
    var TARGET_INDEX = 1;
    var MAX_ATTEMPTS = 120;
    var RETRY_DELAY_MS = 100;
    var applied = false;

    function triggerSortEvents(selectEl) {
      selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function getSelect() {
      return (
        document.querySelector(SELECTOR) ||
        document.querySelector(FALLBACK_SELECTOR)
      );
    }

    function isJetboostReady() {
      var jetboost = window.Jetboost;
      if (!jetboost) return false;
      if (jetboost.initComplete === true) return true;
      if (
        jetboost.loaded === true &&
        Array.isArray(jetboost.boosters) &&
        jetboost.boosters.length > 0
      ) {
        return true;
      }
      return false;
    }

    function applyDefaultSort(attempt) {
      if (applied) return;

      var selectEl = getSelect();

      if (
        !selectEl ||
        !selectEl.options ||
        selectEl.options.length <= TARGET_INDEX
      ) {
        if (attempt < MAX_ATTEMPTS) {
          window.setTimeout(function () {
            applyDefaultSort(attempt + 1);
          }, RETRY_DELAY_MS);
        }
        return;
      }

      var targetOption = selectEl.options[TARGET_INDEX];
      if (!targetOption || !targetOption.value) return;
      if (!isJetboostReady()) {
        if (attempt < MAX_ATTEMPTS) {
          window.setTimeout(function () {
            applyDefaultSort(attempt + 1);
          }, RETRY_DELAY_MS);
        }
        return;
      }

      if (
        selectEl.selectedIndex !== TARGET_INDEX ||
        selectEl.value !== targetOption.value
      ) {
        selectEl.selectedIndex = TARGET_INDEX;
        selectEl.value = targetOption.value;
      }

      triggerSortEvents(selectEl);
      window.setTimeout(function () {
        triggerSortEvents(selectEl);
      }, 120);
      applied = true;
    }

    function init() {
      window.setTimeout(function () {
        applyDefaultSort(0);
      }, 0);
    }

    if (document.readyState !== "loading") {
      init();
    }

    document.addEventListener("DOMContentLoaded", init);
    window.addEventListener("load", init);
  })();
  };
})();
