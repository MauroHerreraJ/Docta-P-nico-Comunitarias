function safeJson(value) {
  return JSON.stringify(value ?? null).replace(/</g, "\\u003c");
}

/** Mismo mapa que Tracker: WebView + Leaflet + teselas de OpenStreetMap. */
export function buildRondaMapHtml(puntos = [], marcas = []) {
  const safe = (Array.isArray(puntos) ? puntos : [])
    .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
    .map((p) => ({
      id: String(p._id || ""),
      lat: Number(p.lat),
      lng: Number(p.lng),
      orden: Number(p.orden) || 0,
      label: String(p.label || "").trim(),
    }));
  const hechos = (Array.isArray(marcas) ? marcas : [])
    .filter((m) => m && !m.pending)
    .map((m) => String(m.puntoId));
  const pendientes = (Array.isArray(marcas) ? marcas : [])
    .filter((m) => m && m.pending)
    .map((m) => String(m.puntoId));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: #e2e8f0; }
    .leaflet-control-attribution { font-size: 9px; }
    .ronda-pin.leaflet-div-icon { background: transparent; border: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const points = ${safeJson(safe)};
    const hechos = new Set(${safeJson(hechos)});
    const pendientes = new Set(${safeJson(pendientes)});
    const map = L.map('map', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    function colorDe(id) {
      if (pendientes.has(id)) return '#D97706';
      if (hechos.has(id)) return '#16A085';
      return '#0F76C4';
    }
    function pinIcon(p) {
      const n = p.orden || '';
      const color = colorDe(p.id);
      return L.divIcon({
        className: 'ronda-pin',
        html: '<div style="width:26px;height:26px;border-radius:13px;background:' + color +
          ';color:#fff;font:800 11px/22px system-ui,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">' + n + '</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
    }

    const capas = [];
    points.forEach((p) => {
      capas.push(L.marker([p.lat, p.lng], { icon: pinIcon(p) }).addTo(map));
    });
    if (points.length >= 2) {
      capas.push(L.polyline(points.map((p) => [p.lat, p.lng]), {
        color: '#0F76C4',
        weight: 4,
        opacity: 0.9,
      }).addTo(map));
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 17);
    } else if (points.length > 1) {
      map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [28, 28] });
    } else {
      map.setView([-31.42, -64.19], 13);
    }

    let user = null;
    window.setUser = function (lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (!user) {
        user = L.circleMarker([lat, lng], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: '#EB7F27',
          fillOpacity: 1,
        }).addTo(map);
      } else {
        user.setLatLng([lat, lng]);
      }
    };
    window.hideUser = function () {
      if (user) {
        map.removeLayer(user);
        user = null;
      }
    };
    setTimeout(function () { map.invalidateSize(); }, 200);
  </script>
</body>
</html>`;
}
