(function () {
  "use strict";

  if (typeof window === "undefined") return;
  var modules = (window.__KHMapsModules = window.__KHMapsModules || {});

  modules.runMapPageLegacy = function runMapPageLegacy() {
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

    function normalizePhase(phase) {
      if (!phase) return phase;
      if (phase.pdf && typeof phase.pdf === "object") {
        phase.pdf = phase.pdf.url || phase.pdf.file || "";
      }
      if (phase.sortOrder !== undefined && phase.sortOrder !== null) {
        var parsed = Number(phase.sortOrder);
        phase.sortOrder = Number.isFinite(parsed) ? parsed : phase.sortOrder;
      }
      if (typeof phase.swatchOutline === "string") {
        phase.swatchOutline = phase.swatchOutline.toLowerCase() === "true";
      }
      return phase;
    }

    function normalizeLotType(type) {
      if (!type) return type;
      if (type.swatchColor && typeof type.swatchColor === "object") {
        type.swatchColor = type.swatchColor.value || type.swatchColor.hex || "";
      }
      if (type.sortOrder !== undefined && type.sortOrder !== null) {
        var parsed = Number(type.sortOrder);
        type.sortOrder = Number.isFinite(parsed) ? parsed : type.sortOrder;
      }
      if (typeof type.swatchOutline === "string") {
        type.swatchOutline = type.swatchOutline.toLowerCase() === "true";
      }
      return type;
    }

    function getMapPhasesData() {
      var phases = [];
      document.querySelectorAll(".map-phases-json").forEach(function (node) {
        var raw = node.dataset.json || node.textContent;
        if (!raw) return;
        try {
          var decoded = decodeHtmlEntities(raw);
          var item = JSON.parse(decoded);
          if (item) phases.push(normalizePhase(item));
        } catch (err) {
          console.warn("Invalid map phase JSON", err, raw);
        }
      });
      return phases;
    }

    function getLotTypesData() {
      var types = [];
      document.querySelectorAll(".lot-types-json").forEach(function (node) {
        var raw = node.dataset.json || node.textContent;
        if (!raw) return;
        try {
          var decoded = decodeHtmlEntities(raw);
          var item = JSON.parse(decoded);
          if (item) types.push(normalizeLotType(item));
        } catch (err) {
          console.warn("Invalid lot type JSON", err, raw);
        }
      });
      return types;
    }

    function extractLotType(lot) {
      if (!lot) return null;

      var raw =
        lot.lotType ||
        lot.lot_type ||
        lot["lot-type"] ||
        lot.type ||
        lot.lotTypeSlug ||
        lot.lot_type_slug ||
        lot["lot-type-slug"] ||
        null;

      var label =
        lot.lotTypeName || lot.lot_type_name || lot["lot-type-name"] || "";
      var slug =
        lot.lotTypeSlug || lot.lot_type_slug || lot["lot-type-slug"] || "";
      var color =
        lot.lotTypeColor || lot.lot_type_color || lot["lot-type-color"] || "";
      var outline =
        lot.lotTypeOutline || lot.lot_type_outline || lot["lot-type-outline"];
      var sortOrder =
        lot.lotTypeSort || lot.lot_type_sort || lot["lot-type-sort"];

      if (raw && typeof raw === "object") {
        label = label || raw.name || "";
        slug = slug || raw.slug || "";
        color = color || raw.swatchColor || raw.color || "";
        outline =
          outline !== undefined && outline !== null
            ? outline
            : raw.swatchOutline;
        sortOrder = sortOrder || raw.sortOrder;
      } else if (typeof raw === "string") {
        slug = slug || raw;
        label = label || raw;
      }

      if (color && typeof color === "object") {
        color = color.value || color.hex || "";
      }

      if (typeof outline === "string") {
        outline = outline.toLowerCase() === "true";
      }

      if (!color && slug) {
        var lower = String(slug).toLowerCase();
        if (lower === "multi-family") color = "#cdb366";
        if (lower === "highway-commercial") color = "#ff9f7e";
        if (lower === "light-industrial") color = "#cfb9ea";
      }

      if (!label) return null;

      return normalizeLotType({
        name: label,
        slug: slug,
        swatchColor: color,
        swatchOutline: outline,
        sortOrder: sortOrder,
      });
    }

    function getLotsData() {
      var lots = [];
      var json = parseJsonScript("lots-data");
      if (Array.isArray(json)) {
        return json.map(normalizeLot);
      }
      document.querySelectorAll(".lot-json").forEach(function (node) {
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

    function getTabLabelForLotType(typeSlug) {
      if (!typeSlug) return "";
      var key = String(typeSlug).trim().toLowerCase();
      key = key.replace(/_/g, "-").replace(/\s+/g, "-");
      if (!key) return "";
      if (key === "multi-family") return "Multi-family";
      if (key === "highway-commercial") return "Highway Commercial";
      if (key === "light-industrial") return "Light Industrial";
      return "";
    }

    function getTabPanelByLabel(label) {
      if (!label) return null;
      return document.querySelector(
        ".w-tab-pane[data-w-tab='" + CSS.escape(String(label)) + "']",
      );
    }

    function getPopupSourceForSlugInPanel(slug, panel) {
      if (!slug || !panel) return null;
      var safeSlug = CSS.escape(String(slug));
      var button = panel.querySelector(
        ".show-on-map[data-lot-slug='" + safeSlug + "']",
      );
      if (!button) return null;
      return getPopupSourceForButton(button);
    }

    function getPopupSourceForLot(lot, preferredSource) {
      if (!lot) return preferredSource || null;
      var slug = getLotSlug(lot);
      var typeSlug = getLotTypeSlug(lot);
      var typeLabel = getTabLabelForLotType(typeSlug);
      if (typeLabel) {
        var typePanel = getTabPanelByLabel(typeLabel);
        var typed = getPopupSourceForSlugInPanel(slug, typePanel);
        if (typed) return typed;
      }
      if (preferredSource) return preferredSource;
      var allPanel = getTabPanelByLabel("All Lots");
      var fallback = getPopupSourceForSlugInPanel(slug, allPanel);
      return fallback || getPopupSourceForSlug(slug);
    }

    function getFallbackTemplate() {
      var template = document.querySelector("[data-lot-card-template]");
      if (template) {
        var inner = template.querySelector("[data-popup-card]");
        return inner || template;
      }
      var panel = getTabPanelByLabel("All Lots");
      if (!panel) return null;
      var preferred = panel.querySelector("[data-popup-card]");
      if (preferred) return preferred;
      var button = panel.querySelector(".show-on-map");
      if (button) return getPopupSourceForButton(button);
      var item = panel.querySelector(
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

    function clonePopupCardForSlug(slug) {
      return clonePopupCardFromSource(getPopupSourceForSlug(slug));
    }

    function clonePopupCardForLot(lot, preferredSource) {
      var source = getPopupSourceForLot(lot, preferredSource || null);
      var clone = clonePopupCardFromSource(source);
      if (!clone) clone = buildFallbackPopupCard(lot);
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

    function getSvgPointFromScreen(svg, x, y) {
      if (!svg || !svg.createSVGPoint || !svg.getScreenCTM) return null;
      try {
        var point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        var svgMatrix = svg.getScreenCTM();
        if (!svgMatrix || !svgMatrix.inverse) return null;
        var svgPoint = point.matrixTransform(svgMatrix.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
      } catch (err) {
        return null;
      }
    }

    function getSvgLengthFromScreen(svg, lengthPx) {
      if (!svg) return null;
      var start = getSvgPointFromScreen(svg, 0, 0);
      var end = getSvgPointFromScreen(svg, lengthPx, 0);
      if (!start || !end) return null;
      return Math.abs(end.x - start.x);
    }

    function getSvgDeltaFromScreen(svg, deltaX, deltaY) {
      if (!svg) return null;
      var start = getSvgPointFromScreen(svg, 0, 0);
      var end = getSvgPointFromScreen(svg, deltaX, deltaY);
      if (!start || !end) return null;
      return {
        x: end.x - start.x,
        y: end.y - start.y,
      };
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

    function getLotStatusColor(lot) {
      return lot.statusColor || lot.status_color || lot["status-color"] || "";
    }

    function getLotMarkerOffset(lot, axis) {
      if (!lot) return 0;
      var value = null;
      if (axis === "x") {
        value = lot.markerOffsetX;
        if (value === undefined || value === null || value === "") {
          value = lot.marker_offset_x;
        }
        if (value === undefined || value === null || value === "") {
          value = lot["marker-offset-x"];
        }
      } else {
        value = lot.markerOffsetY;
        if (value === undefined || value === null || value === "") {
          value = lot.marker_offset_y;
        }
        if (value === undefined || value === null || value === "") {
          value = lot["marker-offset-y"];
        }
      }
      var parsed = parseNumber(value);
      return Number.isFinite(parsed) ? parsed : 0;
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

    function getLotTypeSlug(lot) {
      if (!lot) return "";
      var raw =
        lot.lotType ||
        lot.lot_type ||
        lot["lot-type"] ||
        lot.type ||
        lot.lotTypeSlug ||
        lot.lot_type_slug ||
        lot["lot-type-slug"] ||
        "";
      if (raw && typeof raw === "object") {
        return raw.slug || raw.value || raw.name || raw.title || "";
      }
      return String(raw || "");
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

    function getLotStatusSort(lot) {
      var value = lot.statusSort || lot.status_sort || lot["status-sort"];
      if (value === "" || value === null || value === undefined) return null;
      var parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
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

      function scrollMapIntoView() {
        if (!map || !map.getContainer) return;
        var container = map.getContainer();
        if (!container || !container.scrollIntoView) return;
        var prefersReducedMotion =
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        container.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
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
          contentOverride = clonePopupCardForLot(lot, preferredSource);
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
            clonePopupCardForLot(lotsByPid[pid], null),
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
            clonePopupCardForLot(lotsByPid[pid], null),
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

    function addStatusDots(svgRoot, map, lotsByPid) {
      if (!svgRoot) return;
      var svgNS = "http://www.w3.org/2000/svg";
      var group = svgRoot.querySelector("#lot-status-dots");
      if (!group) {
        group = document.createElementNS(svgNS, "g");
        group.setAttribute("id", "lot-status-dots");
        group.setAttribute("pointer-events", "none");
        svgRoot.appendChild(group);
      } else {
        group.innerHTML = "";
      }

      var radiusPx = 4;
      var strokePx = 1;
      var radius = getSvgLengthFromScreen(svgRoot, radiusPx);
      var strokeWidth = getSvgLengthFromScreen(svgRoot, strokePx);
      if (!Number.isFinite(radius) || radius <= 0) radius = 4;
      if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) strokeWidth = 1;

      svgRoot.querySelectorAll(LOT_SELECTOR).forEach(function (el) {
        var pid = el.id;
        var lot = pid ? lotsByPid[pid] : null;
        if (!lot) return;

        var color = getLotStatusColor(lot);
        if (!color) return;

        var rect = el.getBoundingClientRect();
        var offsetX = getLotMarkerOffset(lot, "x");
        var offsetY = getLotMarkerOffset(lot, "y");
        var centerX = rect.left + rect.width / 2 + offsetX;
        var centerY = rect.top + rect.height / 2 + offsetY;
        var svgPoint = getSvgPointFromScreen(svgRoot, centerX, centerY);
        if (!svgPoint) {
          var fallback = getElementCenter(el);
          if (fallback) {
            var svgOffset = getSvgDeltaFromScreen(svgRoot, offsetX, offsetY);
            if (svgOffset) {
              fallback.x += svgOffset.x;
              fallback.y += svgOffset.y;
            }
            svgPoint = fallback;
          }
        }
        if (!svgPoint) return;

        var circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", svgPoint.x);
        circle.setAttribute("cy", svgPoint.y);
        circle.setAttribute("r", radius);
        circle.setAttribute("fill", color);
        circle.setAttribute("stroke-width", strokeWidth);
        circle.setAttribute("vector-effect", "non-scaling-stroke");
        group.appendChild(circle);
      });

      function updateDotSizes() {
        var newRadius = getSvgLengthFromScreen(svgRoot, radiusPx);
        var newStroke = getSvgLengthFromScreen(svgRoot, strokePx);
        if (!Number.isFinite(newRadius) || newRadius <= 0) return;
        if (!Number.isFinite(newStroke) || newStroke <= 0) newStroke = 1;
        group.querySelectorAll("circle").forEach(function (circle) {
          circle.setAttribute("r", newRadius);
          circle.setAttribute("stroke-width", newStroke);
        });
      }

      if (map && map.on) {
        map.on("zoom", updateDotSizes);
        map.on("resize", updateDotSizes);
      }
    }

    function addLegend(map, lots, phases, svgRoot, lotTypes) {
      var phaseList = Array.isArray(phases) ? phases.slice() : [];
      var typeList =
        Array.isArray(lotTypes) && lotTypes.length ? lotTypes.slice() : [];
      var entries = {};
      lots.forEach(function (lot) {
        var label = getLotStatusLabel(lot);
        var color = getLotStatusColor(lot);
        if (!label || !color) return;
        var key = String(label).toLowerCase();
        if (!entries[key]) {
          entries[key] = {
            label: label,
            color: color,
            sort: getLotStatusSort(lot),
          };
        }
      });

      if (!typeList.length) {
        lots.forEach(function (lot) {
          var typeInfo = extractLotType(lot);
          if (typeInfo) typeList.push(typeInfo);
        });
      }

      var typeEntries = {};
      typeList.forEach(function (type) {
        var key = String(type.slug || type.name || "").toLowerCase();
        if (!key) return;
        if (!typeEntries[key]) {
          typeEntries[key] = {
            name: type.name || type.slug || "",
            slug: type.slug || "",
            color: type.swatchColor || "",
            outline: !!type.swatchOutline,
            sort: type.sortOrder,
          };
        }
      });

      var typeListUnique = Object.values(typeEntries);
      typeListUnique.sort(function (a, b) {
        if (a.sort !== undefined && b.sort !== undefined)
          return a.sort - b.sort;
        if (a.sort !== undefined) return -1;
        if (b.sort !== undefined) return 1;
        return String(a.name).localeCompare(String(b.name));
      });

      var statusList = Object.values(entries);
      var hasPhases = phaseList.length > 0;
      var hasTypes = typeListUnique.length > 0;
      var hasStatuses = statusList.length > 0;
      if (!hasPhases && !hasTypes && !hasStatuses) return;

      statusList.sort(function (a, b) {
        if (a.sort !== null && b.sort !== null) return a.sort - b.sort;
        if (a.sort !== null) return -1;
        if (b.sort !== null) return 1;
        return String(a.label).localeCompare(String(b.label));
      });

      phaseList = phaseList.filter(function (phase) {
        if (!phase || !phase.svgId) return false;
        if (!svgRoot) return true;
        return !!svgRoot.querySelector("#" + CSS.escape(phase.svgId));
      });
      phaseList.sort(function (a, b) {
        var aSort = a.sortOrder;
        var bSort = b.sortOrder;
        if (aSort !== undefined && bSort !== undefined) return aSort - bSort;
        if (aSort !== undefined) return -1;
        if (bSort !== undefined) return 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      var legend = L.control({ position: "bottomright" });
      legend.onAdd = function () {
        var div = L.DomUtil.create("div", "map-legend");
        var title = document.createElement("div");
        title.className = "map-legend__title";
        title.textContent = "Legend";
        div.appendChild(title);

        if (phaseList.length) {
          var phaseTitle = document.createElement("div");
          phaseTitle.className = "map-legend__section-title";
          phaseTitle.textContent = "Phase Legend";
          div.appendChild(phaseTitle);

          phaseList.forEach(function (phase) {
            var row = document.createElement("div");
            row.className = "map-legend__item";
            row.dataset.svgId = phase.svgId || "";
            row.dataset.phaseName = phase.name || "";

            var swatch = document.createElement("span");
            swatch.className = "map-legend__swatch";
            if (phase.swatchOutline) {
              swatch.classList.add("map-legend__swatch--outline");
              if (phase.swatchColor) {
                swatch.style.borderColor = phase.swatchColor;
              }
            } else if (phase.swatchColor) {
              swatch.style.background = phase.swatchColor;
            }

            var label = document.createElement("span");
            label.textContent = phase.name || "";
            row.appendChild(swatch);
            row.appendChild(label);

            if (phase.pdf) {
              var link = document.createElement("a");
              link.className = "map-legend__link";
              link.href = phase.pdf;
              link.target = "_blank";
              link.rel = "noopener";
              link.textContent = phase.pdfText || "View PDF";
              row.appendChild(link);
            }

            row.addEventListener("click", function (event) {
              if (event.target && event.target.closest("a")) {
                return;
              }
              var svgId = phase.svgId;
              if (!svgId || !svgRoot) return;
              var target = svgRoot.querySelector("#" + CSS.escape(svgId));
              if (!target) return;
              try {
                var bbox = target.getBBox();
                var bounds = L.latLngBounds(
                  L.latLng(bbox.y, bbox.x),
                  L.latLng(bbox.y + bbox.height, bbox.x + bbox.width),
                );
                map.fitBounds(bounds, { padding: [20, 20], animate: true });
              } catch (err) {
                console.warn("Unable to focus phase", svgId, err);
              }
              event.preventDefault();
              event.stopPropagation();
            });

            div.appendChild(row);
          });
        }

        if (typeListUnique.length) {
          var typeTitle = document.createElement("div");
          typeTitle.className = "map-legend__section-title";
          typeTitle.textContent = "Lot Types";
          div.appendChild(typeTitle);

          typeListUnique.forEach(function (type) {
            var row = document.createElement("div");
            row.className = "map-legend__item";
            row.dataset.typeSlug = type.slug || "";

            var swatch = document.createElement("span");
            swatch.className = "map-legend__swatch map-legend__swatch--type";
            if (type.outline) {
              swatch.classList.add("map-legend__swatch--outline");
              if (type.color) {
                swatch.style.borderColor = type.color;
              }
            } else if (type.color) {
              swatch.style.background = type.color;
            }

            var label = document.createElement("span");
            label.textContent = type.name || type.slug || "";
            row.appendChild(swatch);
            row.appendChild(label);
            div.appendChild(row);
          });
        }

        if (statusList.length) {
          var statusTitle = document.createElement("div");
          statusTitle.className = "map-legend__section-title";
          statusTitle.textContent = "Lot Status";
          div.appendChild(statusTitle);
        }

        statusList.forEach(function (item) {
          var row = document.createElement("div");
          row.className = "map-legend__item";
          var swatch = document.createElement("span");
          swatch.className = "map-legend__swatch";
          swatch.style.background = item.color;
          var label = document.createElement("span");
          label.textContent = item.label;
          row.appendChild(swatch);
          row.appendChild(label);
          div.appendChild(row);
        });

        return div;
      };
      legend.addTo(map);
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
      var fullscreenControl = null;
      if (L.control && L.control.fullscreen) {
        fullscreenControl = L.control.fullscreen({ position: "topright" });
      } else if (L.Control && (L.Control.Fullscreen || L.Control.FullScreen)) {
        var FullscreenClass = L.Control.Fullscreen || L.Control.FullScreen;
        fullscreenControl = new FullscreenClass({ position: "topright" });
      }
      if (fullscreenControl) {
        fullscreenControl.addTo(map);
      } else {
        console.warn("Leaflet fullscreen control not available.");
      }
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
          addStatusDots(svgRoot, map, lotsByPid);
          addLegend(
            map,
            Object.values(lotsByPid),
            getMapPhasesData(),
            svgRoot,
            getLotTypesData(),
          );
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
      var lots = getLotsData();
      var lotsByPid = buildLotsByPid(lots);
      var lotsBySlug = buildLotsBySlug(lots);
      initSvgMap(mapEl, mapData, lotsByPid, lotsBySlug);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
  };
})();
