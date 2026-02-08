(function () {
  "use strict";

  if (typeof window === "undefined") return;
  var modules = (window.__KHMapsModules = window.__KHMapsModules || {});

  modules.runAllMapsLegacy = function runAllMapsLegacy() {
  (function () {
    "use strict";

    var MAP_CONTAINER_ID = "all-maps";
    var MAP_ITEM_SELECTOR = ".map-json";
    var POPUP_ID = "all-maps-popup";
    var POPUP_FALLBACK_ID = "svg-popup";

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

    function toNumber(value) {
      var num = parseFloat(value);
      return Number.isFinite(num) ? num : null;
    }

    function normalizeCoords(raw) {
      if (!raw) return [];
      var coords = raw;
      if (typeof raw === "string") {
        var decoded = decodeHtmlEntities(raw);
        try {
          coords = JSON.parse(decoded);
        } catch (err) {
          return [];
        }
      }
      if (!Array.isArray(coords)) return [];
      var output = [];
      coords.forEach(function (point) {
        if (!point) return;
        var lat = toNumber(point.lat || point.latitude);
        var lng = toNumber(point.lng || point.lon || point.longitude);
        if (lat === null || lng === null) return;
        output.push([lat, lng]);
      });
      return output;
    }

    function normalizeMapItem(item, mapEl) {
      if (!item) return null;
      var name = item.name || item.title || "";
      var slug = item.slug || item.mapSlug || "";
      var url =
        item.url ||
        item.link ||
        item.permalink ||
        item.href ||
        "";
      if (!url && slug && mapEl) {
        var base = mapEl.dataset.mapBaseUrl || "";
        if (base) {
          url = base.replace(/\/?$/, "/") + String(slug).replace(/^\//, "");
        }
      }
      var color =
        item.googleColor ||
        item.google_color ||
        item["google-color"] ||
        item.color ||
        "";
      var dealInformation =
        item.dealInformation ||
        item.deal_information ||
        item["deal-information"] ||
        item.deal_info ||
        "";
      var coordsRaw =
        item.googleCoordinatesJson ||
        item.google_coordinates_json ||
        item["google-coordinates-json"] ||
        item.googleCoordinates ||
        item.google_coordinates ||
        null;
      var coords = normalizeCoords(coordsRaw);
      return {
        name: name,
        slug: slug,
        url: url,
        color: color,
        dealInformation: dealInformation,
        coordinates: coords,
      };
    }

    function getMapsData(mapEl) {
      var items = [];
      var json = parseJsonScript("all-maps-data");
      if (Array.isArray(json)) {
        json.forEach(function (item) {
          var normalized = normalizeMapItem(item, mapEl);
          if (normalized) items.push(normalized);
        });
        return items;
      }
      document.querySelectorAll(MAP_ITEM_SELECTOR).forEach(function (node) {
        if (
          node.tagName === "SCRIPT" &&
          node.type &&
          node.type !== "application/json"
        ) {
          return;
        }
        var raw = node.dataset.json || node.textContent;
        if (!raw) return;
        try {
          var decoded = decodeHtmlEntities(raw);
          var item = JSON.parse(decoded);
          var normalized = normalizeMapItem(item, mapEl);
          if (normalized) items.push(normalized);
        } catch (err) {
          console.warn("Invalid map JSON", err, raw);
        }
      });
      return items;
    }

    function getPopupElement() {
      return (
        document.getElementById(POPUP_ID) ||
        document.getElementById(POPUP_FALLBACK_ID)
      );
    }

    function setFirstMatchText(root, selectors, value) {
      if (!root) return;
      for (var i = 0; i < selectors.length; i += 1) {
        var el = root.querySelector(selectors[i]);
        if (!el) continue;
        el.textContent = value || "";
        return;
      }
    }

    function setFirstMatchLink(root, selectors, href, text) {
      if (!root) return;
      for (var i = 0; i < selectors.length; i += 1) {
        var el = root.querySelector(selectors[i]);
        if (!el) continue;
        if (href) {
          el.setAttribute("href", href);
          el.removeAttribute("aria-disabled");
          el.style.display = "";
        } else {
          el.setAttribute("href", "#");
          el.setAttribute("aria-disabled", "true");
          el.style.display = "none";
        }
        if (text && !el.textContent.trim()) {
          el.textContent = text;
        }
        return;
      }
    }

    function setPopupHeaderColor(root, color) {
      if (!root || !color) return;
      var header =
        root.querySelector("[data-map-header]") ||
        root.querySelector(".head") ||
        root.querySelector(".map-boundary-popup__header");
      if (!header) return;
      header.style.background = color;
    }

    function renderPopupContent(data, popup) {
      if (!popup || !data) return;
      setFirstMatchText(popup, ["[data-map-field='name']", ".head h3", "h3"], data.name || "");
      setFirstMatchText(
        popup,
        ["[data-map-field='deal']", ".deal_info", ".deal-info"],
        data.dealInformation || "",
      );
      setFirstMatchLink(
        popup,
        ["[data-map-field='link']", ".btn-list a", "a"],
        data.url || "",
        "View area",
      );
      setPopupHeaderColor(popup, data.color || "");
    }

    function createLeafletPopup(map) {
      return L.popup({
        closeButton: false,
        autoPan: false,
        offset: [0, -8],
        className: "map-boundary-popup",
      });
    }

    function buildLeafletContent(data) {
      if (typeof window.renderAllMapsPopup === "function") {
        return window.renderAllMapsPopup(data);
      }
      var title = data.name ? String(data.name) : "Map";
      var info = data.dealInformation ? String(data.dealInformation) : "";
      var link = data.url ? String(data.url) : "";
      var headerStyle = data.color ? ' style="background:' + data.color + ';"' : "";
      var html =
        '<div class="map-boundary-popup__header"' +
        headerStyle +
        '><div class="map-boundary-popup__title">' +
        title +
        "</div></div>";
      html += '<div class="map-boundary-popup__body">';
      if (info) {
        html +=
          '<div class="map-boundary-popup__info">' +
          info +
          "</div>";
      }
      if (link) {
        html +=
          '<a class="map-boundary-popup__link" href="' +
          link +
          '">View area</a>';
      }
      html += "</div>";
      return '<div class="map-boundary-popup__content">' + html + "</div>";
    }

    function ensureContainerPosition(mapEl) {
      if (!mapEl || !window.getComputedStyle) return;
      var computed = window.getComputedStyle(mapEl);
      if (computed && computed.position === "static") {
        mapEl.style.position = "relative";
      }
    }

    function init() {
      var mapEl = document.getElementById(MAP_CONTAINER_ID);
      if (!mapEl) return;
      if (typeof L === "undefined") {
        console.error("Leaflet not found. Ensure leaflet.js is loaded.");
        return;
      }

      ensureContainerPosition(mapEl);

      var mapsData = getMapsData(mapEl);
      var defaultCenter = [52.33, -106.58];
      var defaultZoom = 12;
      if (mapEl.dataset.mapCenter) {
        var parts = mapEl.dataset.mapCenter.split(",");
        if (parts.length === 2) {
          var lat = toNumber(parts[0]);
          var lng = toNumber(parts[1]);
          if (lat !== null && lng !== null) {
            defaultCenter = [lat, lng];
          }
        }
      }
      if (mapEl.dataset.mapZoom) {
        var zoom = toNumber(mapEl.dataset.mapZoom);
        if (zoom !== null) defaultZoom = zoom;
      }

      var map = L.map(MAP_CONTAINER_ID);
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
      var useTiles = mapEl.dataset.useTiles !== "false";
      if (useTiles) {
        var tileUrl =
          mapEl.dataset.tileUrl ||
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        var tileAttribution =
          mapEl.dataset.tileAttribution ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
        L.tileLayer(tileUrl, {
          attribution: tileAttribution,
          maxZoom: 19,
        }).addTo(map);
      }

      var boundaryPane = map.createPane("map-boundaries");
      boundaryPane.style.zIndex = 400;

      var popupEl = getPopupElement();
      var usingDomPopup = !!popupEl;
      var leafletPopup = usingDomPopup ? null : createLeafletPopup(map);
      var lockedLayer = null;
      var hoveredLayer = null;
      var activeLayer = null;
      var overPopup = false;
      var hideTimer = null;
      var boundPopupEl = null;
      var HIDE_DELAY_MS = 120;

      function clearHideTimer() {
        if (!hideTimer) return;
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      function getActivePopupElement() {
        if (usingDomPopup && popupEl) return popupEl;
        if (leafletPopup && typeof leafletPopup.getElement === "function") {
          return leafletPopup.getElement();
        }
        return null;
      }

      function onPopupMouseEnter() {
        overPopup = true;
        clearHideTimer();
      }

      function onPopupMouseLeave() {
        overPopup = false;
        scheduleHide();
      }

      function bindPopupHoverHandlers() {
        var activePopupEl = getActivePopupElement();
        if (!activePopupEl || activePopupEl === boundPopupEl) return;
        if (boundPopupEl) {
          boundPopupEl.removeEventListener("mouseenter", onPopupMouseEnter);
          boundPopupEl.removeEventListener("mouseleave", onPopupMouseLeave);
        }
        boundPopupEl = activePopupEl;
        boundPopupEl.addEventListener("mouseenter", onPopupMouseEnter);
        boundPopupEl.addEventListener("mouseleave", onPopupMouseLeave);
      }

      if (popupEl) {
        popupEl.style.display = "none";
        popupEl.style.position = "absolute";
        bindPopupHoverHandlers();
      }

      if (leafletPopup) {
        leafletPopup.on("remove", function () {
          if (boundPopupEl) {
            boundPopupEl.removeEventListener("mouseenter", onPopupMouseEnter);
            boundPopupEl.removeEventListener("mouseleave", onPopupMouseLeave);
            boundPopupEl = null;
          }
          overPopup = false;
        });
      }

      function closePopupNow() {
        clearHideTimer();
        overPopup = false;
        activeLayer = null;
        if (!popupEl && leafletPopup) {
          map.closePopup(leafletPopup);
          return;
        }
        if (!popupEl) return;
        popupEl.style.display = "none";
      }

      function hidePopup(force) {
        if (lockedLayer && !force) return;
        closePopupNow();
      }

      function scheduleHide() {
        clearHideTimer();
        hideTimer = setTimeout(function () {
          hideTimer = null;
          if (!lockedLayer && !hoveredLayer && !overPopup) {
            hidePopup(true);
          }
        }, HIDE_DELAY_MS);
      }

      function getPopupCenterLatLng(layer) {
        if (!layer || !map || !map.latLngToContainerPoint) {
          return layer && layer.getBounds ? layer.getBounds().getCenter() : null;
        }

        // Use projected bounds center so popup positioning matches on-screen polygon center.
        // This avoids noticeable vertical offset in EPSG:3857 for taller south/north polygons.
        var bounds = layer.getBounds();
        var northEast = map.latLngToContainerPoint(bounds.getNorthEast());
        var southWest = map.latLngToContainerPoint(bounds.getSouthWest());
        var centerPoint = L.point(
          (northEast.x + southWest.x) / 2,
          (northEast.y + southWest.y) / 2,
        );
        return map.containerPointToLatLng(centerPoint);
      }

      function showPopup(layer, lock, anchorLatLng) {
        if (!layer || !layer.__mapData) return;
        clearHideTimer();
        var data = layer.__mapData;
        var center = anchorLatLng || getPopupCenterLatLng(layer);
        if (!center) center = layer.getBounds().getCenter();
        if (usingDomPopup && popupEl) {
          renderPopupContent(data, popupEl);
          var point = map.latLngToContainerPoint(center);
          var offsetX = toNumber(popupEl.dataset.offsetX) || 0;
          var offsetY = toNumber(popupEl.dataset.offsetY) || 0;
          popupEl.style.left = point.x + offsetX + "px";
          popupEl.style.top = point.y + offsetY + "px";
          popupEl.style.display = "block";
        } else if (leafletPopup) {
          leafletPopup
            .setLatLng(center)
            .setContent(buildLeafletContent(data))
            .openOn(map);
          bindPopupHoverHandlers();
          if (!boundPopupEl) {
            setTimeout(bindPopupHoverHandlers, 0);
          }
        }
        activeLayer = layer;
        if (lock) lockedLayer = layer;
      }

      var bounds = null;
      mapsData.forEach(function (item) {
        if (!item.coordinates || item.coordinates.length < 3) return;
        var color = item.color || "#b0d973";
        var polygon = L.polygon(item.coordinates, {
          color: color,
          weight: 3,
          opacity: 0.8,
          fillColor: color,
          fillOpacity: 0.35,
          pane: "map-boundaries",
        }).addTo(map);
        polygon.__mapData = item;
        bounds = bounds ? bounds.extend(polygon.getBounds()) : polygon.getBounds();

        polygon.on("mouseover", function (event) {
          if (lockedLayer && lockedLayer !== polygon) return;
          hoveredLayer = polygon;
          clearHideTimer();
          showPopup(polygon, false, event && event.latlng);
        });
        polygon.on("mouseout", function () {
          if (hoveredLayer === polygon) hoveredLayer = null;
          scheduleHide();
        });
        polygon.on("click", function (event) {
          clearHideTimer();
          if (lockedLayer === polygon) {
            lockedLayer = null;
            hoveredLayer = null;
            hidePopup(true);
            if (event) {
              L.DomEvent.stop(event);
              if (event.originalEvent) {
                event.originalEvent.preventDefault();
                event.originalEvent.stopPropagation();
              }
            }
            return;
          }
          lockedLayer = null;
          hoveredLayer = polygon;
          if (activeLayer === polygon) {
            lockedLayer = polygon;
          } else {
            showPopup(polygon, true, event && event.latlng);
          }
          if (event) {
            L.DomEvent.stop(event);
            if (event.originalEvent) {
              event.originalEvent.preventDefault();
              event.originalEvent.stopPropagation();
            }
          }
        });
      });

      if (bounds) {
        map.fitBounds(bounds, { padding: [20, 20] });
      } else {
        map.setView(defaultCenter, defaultZoom);
      }

      map.on("click", function () {
        hoveredLayer = null;
        lockedLayer = null;
        hidePopup(true);
      });
      map.on("dragstart", function () {
        hoveredLayer = null;
        if (!lockedLayer) hidePopup(true);
      });
      map.on("zoomstart", function () {
        hoveredLayer = null;
        if (!lockedLayer) hidePopup(true);
      });
      window.addEventListener("resize", function () {
        map.invalidateSize();
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
