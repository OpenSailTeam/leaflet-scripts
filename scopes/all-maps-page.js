(function () {
  "use strict";

  if (typeof window === "undefined") return;
  var modules = (window.__KHMapsModules = window.__KHMapsModules || {});

  modules.runAllMapsLegacy = function runAllMapsLegacy() {
  (function () {
    "use strict";

    var MAP_CONTAINER_ID = "all-maps";
    var MAP_ITEM_SELECTOR = ".map-json";

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

    function pickFirstDefined(values) {
      for (var i = 0; i < values.length; i += 1) {
        var value = values[i];
        if (value === undefined || value === null || value === "") continue;
        return value;
      }
      return null;
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
        popupOffsetX: pickFirstDefined([
          item.popupOffsetX,
          item.popup_offset_x,
          item["popup-offset-x"],
        ]),
        popupOffsetY: pickFirstDefined([
          item.popupOffsetY,
          item.popup_offset_y,
          item["popup-offset-y"],
        ]),
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

    function createLeafletPopup() {
      return L.popup({
        closeButton: false,
        autoPan: true,
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

      var popup = null;
      var lockedLayer = null;
      var hoveredLayer = null;
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
        if (!popup || typeof popup.getElement !== "function") return null;
        return popup.getElement();
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
        var popupEl = getActivePopupElement();
        if (!popupEl || popupEl === boundPopupEl) return;
        if (boundPopupEl) {
          boundPopupEl.removeEventListener("mouseenter", onPopupMouseEnter);
          boundPopupEl.removeEventListener("mouseleave", onPopupMouseLeave);
        }
        boundPopupEl = popupEl;
        boundPopupEl.addEventListener("mouseenter", onPopupMouseEnter);
        boundPopupEl.addEventListener("mouseleave", onPopupMouseLeave);
      }

      function ensurePopup() {
        if (popup) return popup;
        popup = createLeafletPopup();
        popup.on("remove", function () {
          if (boundPopupEl) {
            boundPopupEl.removeEventListener("mouseenter", onPopupMouseEnter);
            boundPopupEl.removeEventListener("mouseleave", onPopupMouseLeave);
            boundPopupEl = null;
          }
          overPopup = false;
          lockedLayer = null;
        });
        return popup;
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
          if (lockedLayer || hoveredLayer || overPopup) return;
          closePopupNow();
        }, HIDE_DELAY_MS);
      }

      function getPopupOffset(data, axis) {
        if (!data) return 0;
        var value = axis === "x" ? data.popupOffsetX : data.popupOffsetY;
        if (value === undefined || value === null || value === "") return 0;
        var parsed = toNumber(value);
        return parsed === null ? 0 : parsed;
      }

      function getPopupLatLng(layer) {
        if (!layer || !map || !map.latLngToContainerPoint) {
          return layer && layer.getBounds ? layer.getBounds().getCenter() : null;
        }

        try {
          var data = layer.__mapData || null;
          var bounds = layer.getBounds();
          var northEast = map.latLngToContainerPoint(bounds.getNorthEast());
          var southWest = map.latLngToContainerPoint(bounds.getSouthWest());
          var offset = -20;
          var popupOffsetX = getPopupOffset(data, "x");
          var popupOffsetY = getPopupOffset(data, "y");
          var x = (northEast.x + southWest.x) / 2 + popupOffsetX;
          var y = northEast.y - offset + popupOffsetY;
          if (Number.isFinite(x) && Number.isFinite(y)) {
            return map.containerPointToLatLng([x, y]);
          }
        } catch (err) {
          // Fall back to bounds center if needed.
        }

        return layer.getBounds().getCenter();
      }

      function showPopup(layer, lock) {
        if (!layer || !layer.__mapData) return;
        clearHideTimer();
        var data = layer.__mapData;
        var center = getPopupLatLng(layer);
        if (!center) center = layer.getBounds().getCenter();
        ensurePopup()
          .setLatLng(center)
          .setContent(buildLeafletContent(data))
          .openOn(map);
        bindPopupHoverHandlers();
        if (!boundPopupEl) {
          setTimeout(bindPopupHoverHandlers, 0);
        }
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
          showPopup(polygon, false);
        });
        polygon.on("mouseout", function () {
          if (hoveredLayer === polygon) hoveredLayer = null;
          scheduleHide();
        });
        polygon.on("click", function (event) {
          clearHideTimer();
          if (lockedLayer === polygon) {
            lockedLayer = null;
            closePopupNow();
            if (event) {
              L.DomEvent.stop(event);
              if (event.originalEvent) {
                event.originalEvent.preventDefault();
                event.originalEvent.stopPropagation();
              }
            }
            return;
          }
          hoveredLayer = polygon;
          showPopup(polygon, true);
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
        clearHideTimer();
        hoveredLayer = null;
        overPopup = false;
        lockedLayer = null;
        closePopupNow();
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
