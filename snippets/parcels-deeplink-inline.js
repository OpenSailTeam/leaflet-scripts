(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (typeof URL === "undefined" || typeof URLSearchParams === "undefined") {
    return;
  }

  var CARD_SELECTOR = "a[data-popup-card][href*='/map/']";
  var NAME_SELECTOR = "[data-lot-field='name']";
  var BOUND_ATTR = "data-kh-deeplink-bound";

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function isAbsoluteHref(value) {
    var href = String(value || "").trim();
    if (!href) return false;
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href) || /^\/\//.test(href);
  }

  function readLotName(card) {
    if (!card || !card.querySelector) return "";
    var el = card.querySelector(NAME_SELECTOR);
    if (!el) return "";
    return normalizeName(el.textContent);
  }

  function readLotSlug(card) {
    if (!card) return "";
    return String(card.dataset.khLotSlug || card.dataset.lotSlug || "").trim();
  }

  function buildSignature(baseHref, slug, name) {
    return [baseHref, slug, name].join("::");
  }

  function toCleanUrl(rawHref) {
    var url = new URL(rawHref, window.location.href);
    url.searchParams.delete("khLotSlug");
    url.searchParams.delete("khLotName");
    return url;
  }

  function toOutputHref(url, rawHref) {
    if (isAbsoluteHref(rawHref)) return url.href;
    return url.pathname + url.search + url.hash;
  }

  function bindCard(card) {
    if (!card || !card.getAttribute) return;

    var rawHref = card.getAttribute("href") || "";
    if (!rawHref) return;

    var baseUrl = null;
    try {
      baseUrl = toCleanUrl(rawHref);
    } catch (err) {
      return;
    }

    if (!/\/map\//i.test(baseUrl.pathname)) return;

    var lotSlug = readLotSlug(card);
    var lotName = readLotName(card);
    if (!lotSlug && !lotName) return;

    var baseHref = toOutputHref(baseUrl, rawHref);
    var signature = buildSignature(baseHref, lotSlug, lotName);
    if (card.getAttribute(BOUND_ATTR) === signature) return;

    if (lotSlug) {
      baseUrl.searchParams.set("khLotSlug", lotSlug);
    }
    if (lotName) {
      baseUrl.searchParams.set("khLotName", lotName);
    }

    var nextHref = toOutputHref(baseUrl, rawHref);
    card.setAttribute("href", nextHref);
    card.setAttribute(BOUND_ATTR, signature);
  }

  function bindAllCards() {
    document.querySelectorAll(CARD_SELECTOR).forEach(bindCard);
  }

  var scheduled = false;
  function scheduleBind() {
    if (scheduled) return;
    scheduled = true;
    var run = function () {
      scheduled = false;
      bindAllCards();
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
      return;
    }
    window.setTimeout(run, 0);
  }

  function startObserver() {
    if (typeof MutationObserver === "undefined" || !document.body) return;
    var observer = new MutationObserver(function () {
      scheduleBind();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "data-kh-lot-slug", "data-lot-slug"],
    });
  }

  function init() {
    bindAllCards();
    startObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
