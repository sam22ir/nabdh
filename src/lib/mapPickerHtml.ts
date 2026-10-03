// Leaflet + OpenStreetMap picker, rendered inside a WebView (native) or an
// iframe (web). No API key. Attribution is shown by Leaflet's control.
// Messages out: { type: 'pin', lat, lng } whenever the pin is placed or moved.

export type Coordinates = { latitude: number; longitude: number };

// Center of Algiers; used when we have no position yet.
export const DEFAULT_MAP_CENTER: Coordinates = { latitude: 36.7538, longitude: 3.0588 };

function num(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function buildMapPickerHtml(initial: Coordinates | null): string {
  const center = initial ?? DEFAULT_MAP_CENTER;
  const lat = num(center.latitude);
  const lng = num(center.longitude);
  const zoom = initial ? 16 : 11;
  return `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map').setView([${lat}, ${lng}], ${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
var marker = null;
function post(message) {
  var text = JSON.stringify(message);
  if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(text); }
  else { window.parent.postMessage(text, '*'); }
}
function setPin(latlng) {
  if (marker) { marker.setLatLng(latlng); }
  else {
    marker = L.marker(latlng, { draggable: true }).addTo(map);
    marker.on('dragend', function () {
      var p = marker.getLatLng();
      post({ type: 'pin', lat: p.lat, lng: p.lng });
    });
  }
  post({ type: 'pin', lat: latlng.lat, lng: latlng.lng });
}
map.on('click', function (e) { setPin(e.latlng); });
${initial ? `setPin(L.latLng(${lat}, ${lng}));` : ''}
</script>
</body></html>`;
}

export function parsePinMessage(raw: string): Coordinates | null {
  try {
    const data = JSON.parse(raw) as { type?: string; lat?: number; lng?: number };
    if (data.type !== 'pin') return null;
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    return { latitude: data.lat, longitude: data.lng };
  } catch {
    return null;
  }
}
