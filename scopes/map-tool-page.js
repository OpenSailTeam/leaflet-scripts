(function () {
  "use strict";

  if (typeof window === "undefined") return;
  var modules = (window.__KHMapsModules = window.__KHMapsModules || {});

  modules.runMapToolLegacy = function runMapToolLegacy() {
  (function () {
    "use strict";

    var LOT_SELECTOR = ".lot";
    var MAP_ID = "map";

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function decodeHtmlEntities(value) {
      if (!value || value.indexOf("&") === -1) return value;
      var textarea = document.createElement("textarea");
      textarea.innerHTML = value;
      return textarea.value;
    }

    function parseJsonScript(id) {
      var node = document.getElementById(id);
      if (!node) return null;
      if (
        node.tagName === "SCRIPT" &&
        node.type &&
        node.type !== "application/json"
      ) {
        return null;
      }
      try {
        var raw = decodeHtmlEntities(node.textContent || "");
        if (!raw.trim()) return null;
        return JSON.parse(raw);
      } catch (err) {
        console.warn("Failed to parse JSON in", id, err);
        return null;
      }
    }

    function parseLength(value) {
      if (!value) return null;
      var num = parseFloat(String(value).replace(/[^0-9.+-]/g, ""));
      return Number.isFinite(num) ? num : null;
    }

    function parseNumber(value) {
      if (value === undefined || value === null || value === "") return null;
      var num = parseFloat(String(value));
      return Number.isFinite(num) ? num : null;
    }

    function parseViewBox(value) {
      if (!value) return null;
      var parts = String(value)
        .trim()
        .split(/\s+/)
        .map(function (n) {
          return parseFloat(n);
        });
      if (
        parts.length !== 4 ||
        parts.some(function (n) {
          return !Number.isFinite(n);
        })
      ) {
        return null;
      }
      return {
        minX: parts[0],
        minY: parts[1],
        width: parts[2],
        height: parts[3],
      };
    }

    function getMapData(mapEl) {
      var data = parseJsonScript("map-data") || {};
      var svgUrl =
        mapEl.dataset.svgUrl || data.svgUrl || data.svg_image || data.svgImage;
      if (!svgUrl) {
        var img = document.getElementById("map-svg-source");
        if (img && img.src) {
          svgUrl = img.src;
        }
      }
      return {
        svgUrl: svgUrl,
        viewBox: mapEl.dataset.svgViewbox || data.viewBox || null,
        width: parseLength(mapEl.dataset.svgWidth || data.width),
        height: parseLength(mapEl.dataset.svgHeight || data.height),
      };
    }

    function normalizeLot(lot) {
      if (!lot) return lot;
      var coords =
        lot.googleCoordinatesJson ||
        lot.google_coordinates_json ||
        lot["google-coordinates-json"];
      if (typeof coords === "string") {
        var decoded = decodeHtmlEntities(coords);
        try {
          lot.googleCoordinatesJson = JSON.parse(decoded);
        } catch (err) {
          lot.googleCoordinatesJson = decoded;
        }
      }
      return lot;
    }

    function getLotsFromRoot(root) {
      var lots = [];
      if (!root || !root.querySelectorAll) return lots;
      root.querySelectorAll(".lot-json").forEach(function (node) {
        var raw = node.dataset.json || node.textContent;
        if (!raw) return;
        try {
          var decoded = decodeHtmlEntities(raw);
          var item = JSON.parse(decoded);
          if (item) lots.push(normalizeLot(item));
        } catch (err) {
          console.warn("Invalid lot JSON", err, raw);
        }
      });
      return lots;
    }

    function getCanonicalPageKey(url) {
      try {
        var parsed = new URL(url, window.location.href);
        return parsed.origin + parsed.pathname + parsed.search;
      } catch (err) {
        return String(url || "");
      }
    }

    function getNextPaginationUrl(doc, baseUrl) {
      if (!doc) return null;
      var selectors = [
        ".w-pagination-next:not(.w-pagination-next-disabled):not(.w--pagination-disabled)",
        ".w-pagination-next:not([aria-disabled='true'])",
        "a[rel='next']",
      ];
      for (var i = 0; i < selectors.length; i += 1) {
        var next = doc.querySelector(selectors[i]);
        if (!next) continue;
        var href = next.getAttribute("href");
        if (!href) continue;
        try {
          return new URL(href, baseUrl || window.location.href).href;
        } catch (err) {
          return null;
        }
      }
      return null;
    }

    function dedupeLots(lots) {
      var seen = {};
      var unique = [];
      lots.forEach(function (lot) {
        var slug = String(getLotSlug(lot) || "")
          .trim()
          .toLowerCase();
        var pid = String(getLotPid(lot) || "").trim();
        var key = slug || pid ? slug + "::" + pid : "";
        if (!key) {
          unique.push(lot);
          return;
        }
        if (seen[key]) return;
        seen[key] = true;
        unique.push(lot);
      });
      return unique;
    }

    async function getLotsData() {
      var json = parseJsonScript("lots-data");
      if (Array.isArray(json)) {
        return dedupeLots(json.map(normalizeLot));
      }

      var allLots = getLotsFromRoot(document);
      var nextUrl = getNextPaginationUrl(document, window.location.href);
      if (!nextUrl) return dedupeLots(allLots);

      var seenPages = {};
      seenPages[getCanonicalPageKey(window.location.href)] = true;

      while (nextUrl) {
        var pageKey = getCanonicalPageKey(nextUrl);
        if (seenPages[pageKey]) break;
        seenPages[pageKey] = true;

        try {
          var response = await fetch(nextUrl, { credentials: "same-origin" });
          if (!response.ok) {
            console.warn("Failed to fetch paginated lots page:", nextUrl);
            break;
          }
          var html = await response.text();
          var doc = new DOMParser().parseFromString(html, "text/html");
          allLots = allLots.concat(getLotsFromRoot(doc));
          nextUrl = getNextPaginationUrl(doc, nextUrl);
        } catch (err) {
          console.warn("Pagination fetch failed for lots:", nextUrl, err);
          break;
        }
      }

      return dedupeLots(allLots);
    }

    function getLotPid(lot) {
      if (!lot) return null;
      return (
        lot.pid ||
        lot.svgElementId ||
        lot.svg_element_id ||
        lot["svg-element-id"] ||
        null
      );
    }

    function buildLotsByPid(lots) {
      var lookup = {};
      lots.forEach(function (lot) {
        var pid = getLotPid(lot);
        if (pid) {
          lookup[String(pid)] = lot;
        }
      });
      return lookup;
    }

    function buildLotsBySlug(lots) {
      var lookup = {};
      lots.forEach(function (lot) {
        var slug = getLotSlug(lot);
        if (!slug) return;
        lookup[String(slug).trim().toLowerCase()] = lot;
      });
      return lookup;
    }

    function stripTabClasses(root) {
      if (!root || root.nodeType !== 1) return;
      var classes = ["w-tab-pane", "w--tab-active", "w-tab-link", "w--current"];
      classes.forEach(function (cls) {
        if (root.classList.contains(cls)) root.classList.remove(cls);
      });
      var selector = classes
        .map(function (cls) {
          return "." + cls;
        })
        .join(",");
      if (!selector) return;
      root.querySelectorAll(selector).forEach(function (el) {
        classes.forEach(function (cls) {
          el.classList.remove(cls);
        });
      });
    }

    function removeDuplicateIds(root) {
      if (!root || root.nodeType !== 1) return;
      if (root.hasAttribute("id")) root.removeAttribute("id");
      root.querySelectorAll("[id]").forEach(function (el) {
        el.removeAttribute("id");
      });
    }

    function removeShowOnMapButtons(root) {
      if (!root || root.nodeType !== 1) return;
      root.querySelectorAll(".show-on-map").forEach(function (el) {
        el.remove();
      });
    }

    function applyPopupTemplateStyles(source, clone) {
      if (!source || !clone || !source.isConnected) return;
      if (!window.getComputedStyle) return;
      var sourceStyle = window.getComputedStyle(source);
      if (sourceStyle) {
        clone.style.fontFamily = sourceStyle.fontFamily;
        clone.style.fontSize = sourceStyle.fontSize;
        clone.style.lineHeight = sourceStyle.lineHeight;
        clone.style.color = sourceStyle.color;
      }
      var sourceLinks = source.querySelectorAll("a");
      var cloneLinks = clone.querySelectorAll("a");
      var count =
        sourceLinks.length < cloneLinks.length
          ? sourceLinks.length
          : cloneLinks.length;
      for (var i = 0; i < count; i += 1) {
        var linkStyle = window.getComputedStyle(sourceLinks[i]);
        if (!linkStyle) continue;
        cloneLinks[i].style.color = linkStyle.color;
        cloneLinks[i].style.textDecorationLine = linkStyle.textDecorationLine;
      }
    }

    function getPopupSourceForButton(button) {
      if (!button) return null;
      var container =
        button.closest("[data-popup-card]") ||
        button.closest(".w-dyn-item") ||
        button.closest("[role='listitem']") ||
        button.closest(".collection-item") ||
        button.closest(".lot-card") ||
        button.closest("article") ||
        button.closest("div");
      if (!container) return null;
      if (container.hasAttribute("data-popup-card")) return container;
      var preferred = container.querySelector("[data-popup-card]");
      return preferred || container;
    }

    function getPopupSourceForSlug(slug) {
      if (!slug) return null;
      var safeSlug = CSS.escape(String(slug));
      var button = document.querySelector(
        ".show-on-map[data-lot-slug='" + safeSlug + "']",
      );
      if (button) return getPopupSourceForButton(button);
      return (
        document.querySelector(
          "[data-popup-card][data-lot-slug='" + safeSlug + "']",
        ) || null
      );
    }

    function getPopupSourceForLot(lot, preferredSource) {
      if (!lot) return preferredSource || null;
      var slug = getLotSlug(lot);
      if (preferredSource) return preferredSource;
      return getPopupSourceForSlug(slug);
    }

    function getFallbackTemplate() {
      var template = document.querySelector("[data-lot-card-template]");
      if (template) {
        var inner = template.querySelector("[data-popup-card]");
        return inner || template;
      }
      var preferred = document.querySelector("[data-popup-card]");
      if (preferred) return preferred;
      var button = document.querySelector(".show-on-map");
      if (button) return getPopupSourceForButton(button);
      var item = document.querySelector(
        ".w-dyn-item,[role='listitem'],.collection-item,.lot-card,article,div",
      );
      return item || null;
    }

    function setFirstMatchingText(card, selectors, value) {
      if (!card || value === undefined || value === null) return;
      for (var i = 0; i < selectors.length; i += 1) {
        var el = card.querySelector(selectors[i]);
        if (el) {
          el.textContent = value;
          return;
        }
      }
    }

    function setFirstMatchingHtml(card, selectors, value) {
      if (!card || value === undefined || value === null) return;
      for (var i = 0; i < selectors.length; i += 1) {
        var el = card.querySelector(selectors[i]);
        if (el) {
          el.innerHTML = value;
          return;
        }
      }
    }

    function setCardFieldText(card, fieldName, value) {
      if (!card || !fieldName) return;
      var text = value === undefined || value === null ? "" : String(value);
      card
        .querySelectorAll("[data-lot-field='" + fieldName + "']")
        .forEach(function (el) {
          el.textContent = text;
        });
    }

    function setCardFieldTextMany(card, fieldNames, value) {
      if (!Array.isArray(fieldNames)) return;
      fieldNames.forEach(function (fieldName) {
        setCardFieldText(card, fieldName, value);
      });
    }

    function fallbackCopyText(text) {
      try {
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return !!ok;
      } catch (err) {
        return false;
      }
    }

    function copyTextToClipboard(text) {
      if (!text) return Promise.resolve(false);
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function" &&
        window.isSecureContext
      ) {
        return navigator.clipboard.writeText(text).then(
          function () {
            return true;
          },
          function () {
            return fallbackCopyText(text);
          },
        );
      }
      return Promise.resolve(fallbackCopyText(text));
    }

    function setCopyButtonIcon(button, success) {
      if (!button) return;
      var svgNS = "http://www.w3.org/2000/svg";
      button.textContent = "";

      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.style.display = "block";
      svg.style.borderRadius = "inherit";
      svg.style.setProperty("background-color", "inherit", "important");
      svg.style.setProperty("background", "inherit", "important");

      var path = document.createElementNS(svgNS, "path");
      if (success) {
        path.setAttribute("d", "M20 6 9 17l-5-5");
      } else {
        path.setAttribute(
          "d",
          "M16 4h-1.2a3 3 0 0 0-5.6 0H8a2 2 0 0 0-2 2v1H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-4-1a1 1 0 0 1 .95.68l.05.17h-2l.05-.17A1 1 0 0 1 12 3Zm2 15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1v7a2 2 0 0 0 2 2h6v1Zm4-3a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v9Z",
        );
      }
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
      button.appendChild(svg);
    }

    function enhanceElementSvgIdField(card, value) {
      if (!card) return;
      var text = value === undefined || value === null ? "" : String(value);
      var selectors = [
        "[data-lot-field='elementSvgId']",
        "[data-lot-field='svgElementId']",
        "[data-lot-field='svg_element_id']",
        "[data-lot-field='svg-element-id']",
      ];
      card
        .querySelectorAll(selectors.join(","))
        .forEach(function (el) {
          el.textContent = "";

          var valueSpan = document.createElement("span");
          valueSpan.className = "lot-element-svgid-value";
          valueSpan.textContent = text;
          el.appendChild(valueSpan);

          if (!text) return;

          var controlWrap = document.createElement("span");
          controlWrap.style.position = "relative";
          controlWrap.style.display = "inline-flex";
          controlWrap.style.alignItems = "center";
          controlWrap.style.marginLeft = "0.5em";

          var tooltip = document.createElement("span");
          var tooltipId =
            "lot-svg-copy-tip-" + Math.random().toString(36).slice(2, 10);
          tooltip.id = tooltipId;
          tooltip.textContent = "Copy to clipboard";
          tooltip.setAttribute("role", "tooltip");
          tooltip.style.position = "absolute";
          tooltip.style.left = "50%";
          tooltip.style.bottom = "calc(100% + 8px)";
          tooltip.style.transform = "translateX(-50%) translateY(3px)";
          tooltip.style.whiteSpace = "nowrap";
          tooltip.style.padding = "6px 8px";
          tooltip.style.borderRadius = "6px";
          tooltip.style.background = "#1f2937";
          tooltip.style.color = "#ffffff";
          tooltip.style.fontSize = "12px";
          tooltip.style.lineHeight = "1";
          tooltip.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
          tooltip.style.opacity = "0";
          tooltip.style.pointerEvents = "none";
          tooltip.style.transition = "opacity 120ms ease, transform 120ms ease";

          var button = document.createElement("button");
          button.type = "button";
          button.className = "lot-element-svgid-copy";
          button.setAttribute("aria-label", "Copy to clipboard");
          button.setAttribute("title", "Copy to clipboard");
          button.setAttribute("aria-describedby", tooltipId);
          button.style.width = "32px";
          button.style.height = "32px";
          button.style.minWidth = "32px";
          button.style.minHeight = "32px";
          button.style.padding = "0";
          button.style.border = "1px solid #d1d5db";
          button.style.borderRadius = "8px";
          button.style.background = "#ffffff";
          button.style.color = "#374151";
          button.style.cursor = "pointer";
          button.style.display = "inline-flex";
          button.style.alignItems = "center";
          button.style.justifyContent = "center";
          button.style.transition = "background-color 120ms ease, border-color 120ms ease, color 120ms ease";
          setCopyButtonIcon(button, false);

          var successActive = false;
          var hoverActive = false;
          var resetTimer = null;
          var tooltipTimer = null;

          function showTooltip(message, timeoutMs) {
            tooltip.textContent = message;
            tooltip.style.opacity = "1";
            tooltip.style.transform = "translateX(-50%) translateY(0)";
            if (tooltipTimer) {
              clearTimeout(tooltipTimer);
              tooltipTimer = null;
            }
            if (timeoutMs && timeoutMs > 0) {
              tooltipTimer = setTimeout(function () {
                if (!hoverActive && !successActive) {
                  tooltip.style.opacity = "0";
                  tooltip.style.transform = "translateX(-50%) translateY(3px)";
                }
              }, timeoutMs);
            }
          }

          function hideTooltip() {
            if (successActive || hoverActive) return;
            tooltip.style.opacity = "0";
            tooltip.style.transform = "translateX(-50%) translateY(3px)";
          }

          function setButtonVisualState(active) {
            if (active) {
              button.style.borderColor = "#10b981";
              button.style.color = "#065f46";
              button.style.background = "#ecfdf5";
            } else {
              button.style.borderColor = "#d1d5db";
              button.style.color = "#374151";
              button.style.background = "#ffffff";
            }
          }

          button.addEventListener("mouseenter", function () {
            hoverActive = true;
            button.style.background = successActive ? "#ecfdf5" : "#f9fafb";
            showTooltip(
              successActive ? "Copied to clipboard" : "Copy to clipboard",
            );
          });

          button.addEventListener("mouseleave", function () {
            hoverActive = false;
            button.style.background = successActive ? "#ecfdf5" : "#ffffff";
            hideTooltip();
          });

          button.addEventListener("focus", function () {
            hoverActive = true;
            showTooltip(
              successActive ? "Copied to clipboard" : "Copy to clipboard",
            );
          });

          button.addEventListener("blur", function () {
            hoverActive = false;
            hideTooltip();
          });

          button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            copyTextToClipboard(text).then(function (ok) {
              if (!ok) {
                showTooltip("Unable to copy. Select text manually.", 2200);
                return;
              }

              successActive = true;
              setCopyButtonIcon(button, true);
              setButtonVisualState(true);
              button.setAttribute("aria-label", "Copied to clipboard");
              button.setAttribute("title", "Copied to clipboard");
              showTooltip("Copied to clipboard");

              if (resetTimer) clearTimeout(resetTimer);
              resetTimer = setTimeout(function () {
                successActive = false;
                setCopyButtonIcon(button, false);
                setButtonVisualState(false);
                button.setAttribute("aria-label", "Copy to clipboard");
                button.setAttribute("title", "Copy to clipboard");
                if (hoverActive) {
                  showTooltip("Copy to clipboard");
                } else {
                  tooltip.style.opacity = "0";
                  tooltip.style.transform = "translateX(-50%) translateY(3px)";
                }
              }, 3000);
            });
          });

          controlWrap.appendChild(button);
          controlWrap.appendChild(tooltip);
          el.appendChild(controlWrap);
        });
    }

    function getElementSvgIdFieldValue(lot, activeElementId) {
      if (!lot) {
        return activeElementId || "";
      }
      var value =
        lot.elementSvgId ||
        lot.element_svg_id ||
        lot["element-svg-id"] ||
        lot.svgElementId ||
        lot.svg_element_id ||
        lot["svg-element-id"] ||
        lot.pid ||
        "";
      return value || activeElementId || "";
    }

    function populatePopupCardFields(card, lot, activeElementId) {
      if (!card || !lot) return;
      var elementSvgId = getElementSvgIdFieldValue(lot, activeElementId);
      setCardFieldTextMany(
        card,
        ["elementSvgId", "svgElementId", "svg_element_id", "svg-element-id"],
        elementSvgId,
      );
      enhanceElementSvgIdField(card, elementSvgId);
    }

    function setFallbackCardContent(card, lot) {
      if (!card || !lot) return;
      var title = String(lot.name || lot.pid || "Lot");
      var status = getLotStatusLabel(lot);
      var price = formatLotPrice(getLotPrice(lot));
      var details = getLotDetailsHtml(lot);

      var headingSelectors = [
        "[data-lot-field='name']",
        "h4",
        "h3",
        "h2",
        "h1",
        "h5",
        "h6",
      ];
      var heading = null;
      for (var i = 0; i < headingSelectors.length; i += 1) {
        var candidate = card.querySelector(headingSelectors[i]);
        if (!candidate) continue;
        var text = String(candidate.textContent || "")
          .trim()
          .toLowerCase();
        if (text === "lot details") continue;
        heading = candidate;
        break;
      }
      if (heading) heading.textContent = title;

      setFirstMatchingText(
        card,
        ["[data-lot-field='status']", ".lot-status"],
        status || "",
      );
      setFirstMatchingText(
        card,
        ["[data-lot-field='price']", ".lot-info"],
        price || "",
      );
      setFirstMatchingHtml(
        card,
        ["[data-lot-field='details']", ".w-richtext", ".lot-details"],
        details || "",
      );
    }

    function buildFallbackPopupCard(lot) {
      var template = getFallbackTemplate();
      if (!template) return null;
      var clone = clonePopupCardFromSource(template);
      if (!clone) return null;
      setFallbackCardContent(clone, lot);
      return clone;
    }

    function clonePopupCardFromSource(source) {
      if (!source) return null;
      var styleSource = source;
      if (
        source.hasAttribute &&
        source.hasAttribute("data-lot-card-template")
      ) {
        var inner = source.querySelector("[data-popup-card]");
        if (inner) {
          source = inner;
          styleSource = inner;
        }
      }
      if (source.tagName === "TEMPLATE") {
        var tmplContent = source.content;
        if (tmplContent && tmplContent.firstElementChild) {
          source = tmplContent.firstElementChild;
        }
      }
      if (!source) return null;
      var clone = source.cloneNode(true);
      stripTabClasses(clone);
      removeDuplicateIds(clone);
      removeShowOnMapButtons(clone);
      applyPopupTemplateStyles(styleSource, clone);
      if (clone.hasAttribute("hidden")) clone.removeAttribute("hidden");
      if (clone.getAttribute("aria-hidden") === "true") {
        clone.removeAttribute("aria-hidden");
      }
      if (clone.style && clone.style.display === "none") {
        clone.style.removeProperty("display");
      }
      clone.classList.add("lot-popup-card");
      return clone;
    }

    function clonePopupCardForLot(lot, preferredSource, activeElementId) {
      var source = getPopupSourceForLot(lot, preferredSource || null);
      var clone = clonePopupCardFromSource(source);
      if (!clone) clone = buildFallbackPopupCard(lot);
      populatePopupCardFields(clone, lot, activeElementId);
      return clone;
    }

    function renderLotPopup(lot) {
      if (typeof window.renderLotPopup === "function") {
        return window.renderLotPopup(lot);
      }
      var title = escapeHtml(lot.name || lot.pid || "Lot");
      var statusLabel = getLotStatusLabel(lot);
      var price = formatLotPrice(getLotPrice(lot));
      var logoUrl = getLotLogoUrl(lot);
      var details = getLotDetailsHtml(lot);
      var meta = statusLabel
        ? '<div class="lot-popup__meta">' + escapeHtml(statusLabel) + "</div>"
        : "";
      var priceHtml = price
        ? '<div class="lot-popup__price">' + escapeHtml(price) + "</div>"
        : "";
      var logoHtml = logoUrl
        ? '<div class="lot-popup__logo"><img src="' +
          escapeHtml(logoUrl) +
          '" alt="' +
          title +
          ' logo"></div>'
        : "";
      var detailsHtml = details
        ? '<div class="lot-popup__details">' + details + "</div>"
        : "";
      return (
        '<div class="lot-popup">' +
        logoHtml +
        '<div class="lot-popup__title">' +
        title +
        "</div>" +
        priceHtml +
        meta +
        detailsHtml +
        "</div>"
      );
    }

    function getSvgPoint(el, x, y) {
      if (!el) return null;
      var svg = el.ownerSVGElement;
      if (
        !svg ||
        !svg.createSVGPoint ||
        !el.getScreenCTM ||
        !svg.getScreenCTM
      ) {
        return { x: x, y: y };
      }
      try {
        var point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        var elementMatrix = el.getScreenCTM();
        var svgMatrix = svg.getScreenCTM();
        if (!elementMatrix || !svgMatrix || !svgMatrix.inverse) {
          return { x: x, y: y };
        }
        var screenPoint = point.matrixTransform(elementMatrix);
        var svgPoint = screenPoint.matrixTransform(svgMatrix.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
      } catch (err) {
        return { x: x, y: y };
      }
    }

    function getElementCenter(el) {
      try {
        var bbox = el.getBBox();
        return getSvgPoint(
          el,
          bbox.x + bbox.width / 2,
          bbox.y + bbox.height / 2,
        );
      } catch (err) {
        return null;
      }
    }

    function getElementAnchor(el) {
      try {
        var bbox = el.getBBox();
        return getSvgPoint(
          el,
          bbox.x + bbox.width / 2,
          bbox.y - Math.max(12, bbox.height * 0.15),
        );
      } catch (err) {
        return null;
      }
    }

    function getPopupLatLng(el, map) {
      try {
        var rect = el.getBoundingClientRect();
        var containerRect = map.getContainer().getBoundingClientRect();
        var offset = -20;
        var x = rect.left - containerRect.left + rect.width / 2;
        var y = rect.top - containerRect.top - offset;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          return map.containerPointToLatLng([x, y]);
        }
      } catch (err) {
        // Fall back to map center if needed.
      }
      var anchor = getElementAnchor(el);
      if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
        return L.latLng(anchor.y, anchor.x);
      }
      return map.getCenter();
    }

    function getElementCenterLatLng(el, map) {
      try {
        var rect = el.getBoundingClientRect();
        var containerRect = map.getContainer().getBoundingClientRect();
        var x = rect.left - containerRect.left + rect.width / 2;
        var y = rect.top - containerRect.top + rect.height / 2;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          return map.containerPointToLatLng([x, y]);
        }
      } catch (err) {
        // Fall back to map center if needed.
      }
      var center = getElementCenter(el);
      if (center && Number.isFinite(center.x) && Number.isFinite(center.y)) {
        return L.latLng(center.y, center.x);
      }
      return map.getCenter();
    }

    function getLotStatusLabel(lot) {
      return (
        lot.statusName ||
        lot.status_name ||
        lot["status-name"] ||
        lot.status ||
        lot.customStatus ||
        lot.custom_status ||
        lot["custom-status"] ||
        ""
      );
    }

    function getLotPrice(lot) {
      return (
        lot.price ||
        lot.lotPrice ||
        lot.lot_price ||
        lot["lot-price"] ||
        lot.priceLabel ||
        lot.price_label ||
        lot["price-label"] ||
        lot.priceFormatted ||
        lot.price_formatted ||
        ""
      );
    }

    function formatLotPrice(value) {
      if (value === null || value === undefined) return "";
      if (typeof value === "number" && Number.isFinite(value)) {
        return (
          "$" +
          value.toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })
        );
      }
      var text = String(value).trim();
      if (!text) return "";
      if (/[a-zA-Z$€£¥]/.test(text)) return text;
      var numeric = parseFloat(text.replace(/[^0-9.+-]/g, ""));
      if (!Number.isFinite(numeric)) return text;
      return (
        "$" +
        numeric.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })
      );
    }

    function getLotLogoUrl(lot) {
      var url =
        lot.logoImage ||
        lot.logo_image ||
        lot.logo ||
        lot.logoUrl ||
        lot.logo_url ||
        lot["logo-url"] ||
        lot["logo-image"] ||
        lot["logo_image"] ||
        "";
      if (Array.isArray(url)) {
        url = url[0] || "";
      }
      if (url && typeof url === "object") {
        url = url.url || url.src || url.file || "";
      }
      if (!url) return "";
      var text = String(url).trim();
      if (!text) return "";
      if (
        /^https?:\/\//i.test(text) ||
        /^\/\/[^/]/.test(text) ||
        /^data:image\//i.test(text) ||
        /^blob:/i.test(text) ||
        text.charAt(0) === "/"
      ) {
        return text;
      }
      return "";
    }

    function getLotDetails(lot) {
      return (
        lot.details ||
        lot.detail ||
        lot.lotDetails ||
        lot.lot_details ||
        lot["lot-details"] ||
        lot.description ||
        lot.lotDescription ||
        lot.lot_description ||
        lot["lot-description"] ||
        lot.summary ||
        lot.lotSummary ||
        lot.lot_summary ||
        lot["lot-summary"] ||
        ""
      );
    }

    function getLotSlug(lot) {
      if (!lot) return "";
      return lot.slug || lot.lotSlug || lot.lot_slug || lot["lot-slug"] || "";
    }

    function getLotDetailsHtmlFromDom(slug) {
      if (!slug) return "";
      var el = document.getElementById(slug);
      if (!el || !el.classList || !el.classList.contains("lot-details")) {
        return "";
      }
      return String(el.innerHTML || "").trim();
    }

    function getLotDetailsHtml(lot) {
      var slug = getLotSlug(lot);
      var rich = getLotDetailsHtmlFromDom(slug);
      if (rich) return rich;
      return formatLotDetails(getLotDetails(lot));
    }

    function formatLotDetails(value) {
      var text = String(value || "").trim();
      if (!text) return "";
      return escapeHtml(text).replace(/\r?\n/g, "<br>");
    }

    function bindLotEvents(svgRoot, map, lotsByPid, lotsBySlug) {
      var lockedEl = null;
      var hoveredEl = null;
      var overPopup = false;
      var hideTimer = null;
      var boundPopupEl = null;
      var HIDE_DELAY_MS = 120;
      var popup = null;

      function clearHideTimer() {
        if (!hideTimer) return;
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      function onPopupMouseEnter() {
        overPopup = true;
        clearHideTimer();
      }

      function onPopupMouseLeave() {
        overPopup = false;
        scheduleHide();
      }

      function getActivePopupElement() {
        if (!popup || typeof popup.getElement !== "function") return null;
        return popup.getElement();
      }

      function bindPopupHoverHandlers() {
        var popupEl = getActivePopupElement();
        if (!popupEl || popupEl === boundPopupEl) return;
        if (boundPopupEl) {
          boundPopupEl.removeEventListener("mouseenter", onPopupMouseEnter);
          boundPopupEl.removeEventListener("mouseleave", onPopupMouseLeave);
        }
        boundPopupEl = popupEl;
        popupEl.addEventListener("mouseenter", onPopupMouseEnter);
        popupEl.addEventListener("mouseleave", onPopupMouseLeave);
      }

      function closePopupNow() {
        clearHideTimer();
        overPopup = false;
        if (popup) map.closePopup(popup);
      }

      function scheduleHide() {
        clearHideTimer();
        hideTimer = setTimeout(function () {
          hideTimer = null;
          if (lockedEl || hoveredEl || overPopup) return;
          closePopupNow();
        }, HIDE_DELAY_MS);
      }

      function ensurePopup() {
        if (popup) return popup;
        popup = L.popup({
          closeButton: false,
          autoPan: true,
          offset: [0, -8],
          className: "lot-popup-shell",
        });
        popup.on("remove", function () {
          if (boundPopupEl) {
            boundPopupEl.removeEventListener("mouseenter", onPopupMouseEnter);
            boundPopupEl.removeEventListener("mouseleave", onPopupMouseLeave);
            boundPopupEl = null;
          }
          overPopup = false;
          if (lockedEl) lockedEl.classList.remove("is-active");
          lockedEl = null;
        });
        return popup;
      }

      function openPopup(el, lot, lock, contentOverride) {
        var latlng = getPopupLatLng(el, map);
        ensurePopup()
          .setLatLng(latlng)
          .setContent(contentOverride || renderLotPopup(lot))
          .openOn(map);
        bindPopupHoverHandlers();
        if (!boundPopupEl) {
          setTimeout(bindPopupHoverHandlers, 0);
        }

        if (lock) {
          if (lockedEl && lockedEl !== el) {
            lockedEl.classList.remove("is-active");
          }
          lockedEl = el;
          el.classList.add("is-active");
        }
      }

      function focusLotBySlug(slug, contentOverride, preferredSource) {
        if (!slug || !lotsBySlug) return false;
        var key = String(slug).trim().toLowerCase();
        if (!key) return false;
        var lot = lotsBySlug[key];
        if (!lot) return false;
        var pid = getLotPid(lot);
        if (!pid) return false;
        var el = svgRoot.querySelector("#" + CSS.escape(pid));
        if (!el) return false;
        var center = getElementCenterLatLng(el, map);
        map.panTo(center, { animate: true });
        if (contentOverride === undefined) {
          contentOverride = clonePopupCardForLot(lot, preferredSource, el.id);
        }
        openPopup(el, lot, true, contentOverride);
        return true;
      }

      svgRoot.querySelectorAll(LOT_SELECTOR).forEach(function (el) {
        var pid = el.id;
        if (!pid || !lotsByPid[pid]) return;

        el.addEventListener("mouseenter", function () {
          el.classList.add("is-hovered");
          hoveredEl = el;
          clearHideTimer();
          if (lockedEl && lockedEl !== el) return;
          openPopup(
            el,
            lotsByPid[pid],
            false,
            clonePopupCardForLot(lotsByPid[pid], null, el.id),
          );
        });

        el.addEventListener("mouseleave", function () {
          el.classList.remove("is-hovered");
          if (hoveredEl === el) hoveredEl = null;
          scheduleHide();
        });

        el.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          clearHideTimer();

          if (lockedEl === el) {
            el.classList.remove("is-active");
            lockedEl = null;
            closePopupNow();
            return;
          }

          openPopup(
            el,
            lotsByPid[pid],
            true,
            clonePopupCardForLot(lotsByPid[pid], null, el.id),
          );
        });
      });

      map.on("click", function () {
        clearHideTimer();
        hoveredEl = null;
        overPopup = false;
        if (lockedEl) lockedEl.classList.remove("is-active");
        lockedEl = null;
        closePopupNow();
      });

      document.addEventListener("click", function (event) {
        var button = event.target.closest(".show-on-map");
        if (!button) return;
        var slug = button.getAttribute("data-lot-slug") || "";
        var preferredSource = getPopupSourceForButton(button);
        if (!focusLotBySlug(slug, undefined, preferredSource)) {
          console.warn("Unable to focus lot for slug:", slug);
        }
        event.preventDefault();
        event.stopPropagation();
      });
    }

    function addLotIdLabels(svgRoot) {
      if (!svgRoot) return;
      var svgNS = "http://www.w3.org/2000/svg";
      var group = svgRoot.querySelector("#lot-id-labels");
      if (!group) {
        group = document.createElementNS(svgNS, "g");
        group.setAttribute("id", "lot-id-labels");
        group.setAttribute("pointer-events", "none");
        svgRoot.appendChild(group);
      } else {
        group.innerHTML = "";
      }

      var lotCandidates = Array.prototype.slice.call(
        svgRoot.querySelectorAll(LOT_SELECTOR + "[id]"),
      );
      var labelTargets = lotCandidates.filter(function (el) {
        var tag = String(el.tagName || "").toLowerCase();
        return tag === "rect" || tag === "polygon";
      });
      if (!labelTargets.length) {
        labelTargets = lotCandidates;
      }

      labelTargets.forEach(function (el) {
        
        var shapeId = String(el.id || "").trim();
        if (!shapeId) return;

        var center = getElementCenter(el);
        if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
          return;
        }

        var text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", center.x);
        text.setAttribute("y", center.y);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", "10");
        text.setAttribute("font-family", "system-ui, -apple-system, 'Segoe UI', sans-serif");
        text.setAttribute("fill", "#111111");
        text.setAttribute("stroke", "#ffffff");
        text.setAttribute("stroke-width", "2");
        text.setAttribute("stroke-linejoin", "round");
        text.setAttribute("paint-order", "stroke");
        text.textContent = shapeId;
        group.appendChild(text);
      });
    }

    function initSvgMap(mapEl, mapData, lotsByPid, lotsBySlug) {
      if (!mapData.svgUrl) {
        console.warn("Missing SVG URL for map.");
        return;
      }

      var minZoom = parseNumber(mapEl.dataset.minZoom);
      if (minZoom === null) minZoom = -1;

      var map = L.map(MAP_ID, {
        crs: L.CRS.Simple,
        zoomSnap: 0.1,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 80,
        minZoom: minZoom,
        attributionControl: false,
      });
      window.addEventListener("resize", function () {
        map.invalidateSize();
      });

      function refreshMapView(boundsObj) {
        map.invalidateSize();
        map.fitBounds(boundsObj, { padding: [20, 20], animate: false });
      }

      function applyOverlay(svgElement, bounds) {
        var boundsObj = L.latLngBounds(bounds);
        var overlay = L.svgOverlay(svgElement, bounds, { interactive: true });
        overlay.addTo(map);
        refreshMapView(boundsObj);
        setTimeout(function () {
          refreshMapView(boundsObj);
        }, 100);
        map.setMaxBounds(boundsObj.pad(1.0));

        var svgRoot = overlay.getElement();
        if (svgRoot) {
          svgRoot.setAttribute("preserveAspectRatio", "xMidYMid meet");
          bindLotEvents(svgRoot, map, lotsByPid, lotsBySlug);
          addLotIdLabels(svgRoot);
        }
      }

      function applyImageFallback(bounds) {
        var boundsObj = L.latLngBounds(bounds);
        var overlay = L.imageOverlay(mapData.svgUrl, bounds).addTo(map);
        refreshMapView(boundsObj);
        setTimeout(function () {
          refreshMapView(boundsObj);
        }, 100);
        map.setMaxBounds(boundsObj.pad(1.0));
        overlay.getElement().style.imageRendering = "auto";
      }

      fetch(mapData.svgUrl)
        .then(function (response) {
          if (!response.ok) throw new Error("Failed to fetch SVG");
          return response.text();
        })
        .then(function (text) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(text, "image/svg+xml");
          var svg = doc.querySelector("svg");
          if (!svg) throw new Error("No <svg> element found");

          var viewBox = parseViewBox(
            mapData.viewBox || svg.getAttribute("viewBox"),
          );
          var width = parseLength(svg.getAttribute("width")) || mapData.width;
          var height =
            parseLength(svg.getAttribute("height")) || mapData.height;

          if (!viewBox && width && height) {
            viewBox = { minX: 0, minY: 0, width: width, height: height };
          }

          if (!viewBox) {
            console.warn(
              "SVG missing viewBox and size. Falling back to 1000x1000 bounds.",
            );
            viewBox = { minX: 0, minY: 0, width: 1000, height: 1000 };
          }

          svg.setAttribute(
            "viewBox",
            [viewBox.minX, viewBox.minY, viewBox.width, viewBox.height].join(
              " ",
            ),
          );
          svg.setAttribute("width", viewBox.width);
          svg.setAttribute("height", viewBox.height);

          var bounds = [
            [viewBox.minY, viewBox.minX],
            [viewBox.minY + viewBox.height, viewBox.minX + viewBox.width],
          ];

          applyOverlay(svg, bounds);
        })
        .catch(function (err) {
          console.warn("SVG overlay failed, using image overlay.", err);
          var fallbackBounds = [
            [0, 0],
            [mapData.height || 1000, mapData.width || 1000],
          ];
          applyImageFallback(fallbackBounds);
        });
    }

    function init() {
      var mapEl = document.getElementById(MAP_ID);
      if (!mapEl) return;
      if (typeof L === "undefined") {
        console.error("Leaflet not found. Ensure leaflet.js is loaded.");
        return;
      }

      var mapData = getMapData(mapEl);
      getLotsData()
        .then(function (lots) {
          var lotsByPid = buildLotsByPid(lots);
          var lotsBySlug = buildLotsBySlug(lots);
          initSvgMap(mapEl, mapData, lotsByPid, lotsBySlug);
        })
        .catch(function (err) {
          console.error("Failed to load lots data:", err);
          var fallbackLots = getLotsFromRoot(document);
          var lotsByPid = buildLotsByPid(fallbackLots);
          var lotsBySlug = buildLotsBySlug(fallbackLots);
          initSvgMap(mapEl, mapData, lotsByPid, lotsBySlug);
        });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
  };
})();
