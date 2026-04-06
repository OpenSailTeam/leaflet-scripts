(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  var ROOT_SELECTOR = "[data-kh-hide-empty-tabs].w-tabs";
  var TAB_SELECTOR = "[role='tab'][data-w-tab]";
  var PANEL_SELECTOR = "[role='tabpanel'][data-w-tab]";
  var EMPTY_SELECTOR = ".w-dyn-empty";
  var READY_ATTR = "data-kh-empty-tabs-ready";
  var BOUND_ATTR = "data-kh-empty-tabs-bound";
  var INITIALIZED_ATTR = "data-kh-empty-tabs-initialized";

  function uniqueValues(values) {
    return Array.from(new Set(values));
  }

  function escapeAttrValue(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  function getTabSet(root) {
    if (!root || !root.querySelectorAll) return [];

    var values = uniqueValues(
      Array.from(root.querySelectorAll(TAB_SELECTOR))
        .map(function (tab) {
          return String(tab.getAttribute("data-w-tab") || "").trim();
        })
        .filter(Boolean)
    );

    return values.map(function (value) {
      return {
        value: value,
        tab: root.querySelector(TAB_SELECTOR + '[data-w-tab="' + escapeAttrValue(value) + '"]'),
        panel: root.querySelector(PANEL_SELECTOR + '[data-w-tab="' + escapeAttrValue(value) + '"]'),
      };
    });
  }

  function isEmptyPanel(panel) {
    if (!panel || !panel.querySelector) return true;
    return !!panel.querySelector(EMPTY_SELECTOR);
  }

  function setTabVisible(tab, visible) {
    if (!tab) return;
    tab.style.display = visible ? "" : "none";
    tab.setAttribute("aria-hidden", visible ? "false" : "true");
    tab.tabIndex = visible ? 0 : -1;
  }

  function setPanelVisible(panel, visible) {
    if (!panel) return;
    panel.style.display = visible ? "block" : "none";
    panel.classList.toggle("w--tab-active", visible);
    panel.hidden = false;
    panel.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function setTabActive(tab, active, panelId) {
    if (!tab) return;
    tab.classList.toggle("w--current", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    if (panelId) {
      tab.setAttribute("aria-controls", panelId);
      tab.setAttribute("href", "#" + panelId);
    }
  }

  function deactivateAll(entries) {
    entries.forEach(function (entry) {
      if (!entry.tab || !entry.panel) return;
      setTabActive(entry.tab, false, entry.panel.id);
      setPanelVisible(entry.panel, false);
    });
  }

  function activateEntry(entries, targetValue) {
    entries.forEach(function (entry) {
      if (!entry.tab || !entry.panel) return;
      var active = entry.value === targetValue;
      setTabActive(entry.tab, active, entry.panel.id);
      setPanelVisible(entry.panel, active);
    });
  }

  function bindTab(root, entries, entry) {
    if (!entry || !entry.tab || !entry.panel) return;
    if (entry.tab.getAttribute(BOUND_ATTR) === "true") return;

    entry.tab.addEventListener(
      "click",
      function (event) {
        event.preventDefault();
        event.stopPropagation();
        activateEntry(entries, entry.value);
        root.setAttribute(READY_ATTR, "true");
      },
      true
    );

    entry.tab.setAttribute(BOUND_ATTR, "true");
  }

  function processRoot(root) {
    var hasInitialized = root.getAttribute(INITIALIZED_ATTR) === "true";
    var entries = getTabSet(root).filter(function (entry) {
      return entry.tab && entry.panel;
    });
    if (!entries.length) return;

    var visibleEntries = [];
    var activeVisibleValue = "";

    entries.forEach(function (entry) {
      if (isEmptyPanel(entry.panel)) {
        setTabVisible(entry.tab, false);
        setPanelVisible(entry.panel, false);
        setTabActive(entry.tab, false, entry.panel.id);
        return;
      }

      setTabVisible(entry.tab, true);
      if (
        entry.tab.classList.contains("w--current") ||
        entry.tab.getAttribute("aria-selected") === "true" ||
        entry.panel.classList.contains("w--tab-active")
      ) {
        activeVisibleValue = entry.value;
      }
      bindTab(root, entries, entry);
      visibleEntries.push(entry);
    });

    if (!visibleEntries.length) {
      root.style.display = "none";
      root.hidden = true;
      root.setAttribute(READY_ATTR, "true");
      return;
    }

    root.hidden = false;
    root.style.display = "";
    if (!hasInitialized) {
      deactivateAll(visibleEntries);
    } else if (activeVisibleValue) {
      activateEntry(visibleEntries, activeVisibleValue);
    } else {
      deactivateAll(visibleEntries);
    }
    root.setAttribute(INITIALIZED_ATTR, "true");
    root.setAttribute(READY_ATTR, "true");
  }

  var scheduled = false;

  function processAllRoots() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(processRoot);
  }

  function scheduleProcess() {
    if (scheduled) return;
    scheduled = true;

    var run = function () {
      scheduled = false;
      processAllRoots();
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
      return;
    }

    window.setTimeout(run, 0);
  }

  function startObserver() {
    if (typeof MutationObserver === "undefined" || !document.body) return;

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (mutation.type === "childList") {
          scheduleProcess();
          return;
        }
        if (mutation.type === "attributes") {
          scheduleProcess();
          return;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });
  }

  function init() {
    scheduleProcess();
    startObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
