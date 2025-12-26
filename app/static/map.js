// ==================================================
// MAP INITIALIZATION
// ==================================================
const map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// ==================================================
// GLOBAL STATE
// ==================================================
const SESSION_ID = crypto.randomUUID(); // dibuat SEKALI
const UPDATE_INTERVAL = 5000; // ms

console.log("SESSION ID:", SESSION_ID);

// GPS STATE
let gpsMarker = null;
let gpsAccuracyCircle = null;
let gpsPolyline = null;
let gpsRoutePoints = [];
let firstFix = true;
let lastLatLng = null;
let ipMarker = null;
let trackingTimer = null;
let trackingActive = false;

// UI STATUS ELEMENTS
const latEl = document.getElementById("latValue");
const lngEl = document.getElementById("lngValue");
const timeEl = document.getElementById("timeValue");

// =====================
// BASE MAP LAYERS
// =====================
const baseLayers = {
  Default: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }),

  Satelit: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "© Esri" }
  ),

  "Medan (Terrain)": L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenTopoMap" }
  ),

  "Transportasi Umum": L.tileLayer(
    "https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=YOUR_API_KEY",
    { attribution: "© Thunderforest" }
  ),

  Bersepeda: L.tileLayer(
    "https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=YOUR_API_KEY",
    { attribution: "© Thunderforest" }
  ),
};

const wildfireLayer = L.tileLayer(
  "https://firms.modaps.eosdis.nasa.gov/mapserver/wmts/fires/1.0.0/default/{time}/{tilematrixset}/{z}/{y}/{x}.png",
  { attribution: "NASA FIRMS" }
);

// =====================
// LAYER CONTROL
// =====================
const gpsRouteLayer = L.layerGroup();
const airQualityLayer = L.layerGroup(); // placeholder dulu

L.control
  .layers(
    baseLayers,
    {
      "GPS Route": gpsRouteLayer,
      "Kebakaran Hutan": wildfireLayer,
      "Kualitas Udara": airQualityLayer,
    },
    { collapsed: false }
  )
  .addTo(map);

// Default layer
baseLayers["Default"].addTo(map);

// ==================================================
// TRACKING CONTROL
// ==================================================
function startTracking() {
  if (!navigator.geolocation) {
    alert("Geolocation tidak didukung browser");
    return;
  }

  if (trackingActive) return;
  trackingActive = true;

  requestLocation(); // ambil lokasi pertama
  trackingTimer = setInterval(requestLocation, UPDATE_INTERVAL);
}

function stopTracking() {
  if (trackingTimer) {
    clearInterval(trackingTimer);
    trackingTimer = null;
  }
  trackingActive = false;
}

// ==================================================
// GEOLOCATION
// ==================================================
function requestLocation() {
  navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });
}

function onLocationSuccess(pos) {
  const { latitude, longitude, accuracy } = pos.coords;

  // Simpan rute GPS
  gpsRoutePoints.push([latitude, longitude]);
  const MAX_POINTS = 1000;
  if (gpsRoutePoints.length > MAX_POINTS) {
    gpsRoutePoints.shift(); // hapus titik paling lama
  }

  // Kirim ke backend
  sendLocationToServer(latitude, longitude, accuracy);

  // Update peta GPS
  updateGPSMap(latitude, longitude, accuracy);
}

function onLocationError(err) {
  console.error("GPS error:", err.message);
}

// ==================================================
// BACKEND COMMUNICATION
// ==================================================
function sendLocationToServer(lat, lng, accuracy) {
  fetch("/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: SESSION_ID,
      lat,
      lng,
      accuracy,
    }),
  })
    .then((res) => res.json())
    .then((data) => console.log("Server:", data))
    .catch((err) => console.error("Fetch error:", err));
}

function updateStatusCard(lat, lng) {
  if (latEl) latEl.innerText = lat.toFixed(6);
  if (lngEl) lngEl.innerText = lng.toFixed(6);
  if (timeEl) timeEl.innerText = new Date().toLocaleTimeString("id-ID");
}

// ==================================================
// GPS MAP UPDATE
// ==================================================
function animateMarker(marker, from, to, duration = 1000) {
  const start = performance.now();

  function animate(time) {
    const progress = Math.min((time - start) / duration, 1);

    const lat = from.lat + (to.lat - from.lat) * progress;
    const lng = from.lng + (to.lng - from.lng) * progress;

    marker.setLatLng([lat, lng]);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function updateGPSMap(lat, lng, accuracy) {
  const newLatLng = L.latLng(lat, lng);
  if (lastLatLng && lastLatLng.distanceTo(newLatLng) < Math.max(accuracy, 2))
    return;

  // Smooth center map (JANGAN pakai setView)
  if (firstFix) {
    map.flyTo(newLatLng, 16, {
      animate: true,
      duration: 1.5,
      easeLinearity: 0.25,
    });
    firstFix = false;
  } else {
    map.flyTo(newLatLng, map.getZoom(), {
      animate: true,
      duration: 0.8,
      easeLinearity: 0.4,
    });
  }

  // Marker GPS
  if (!gpsMarker) {
    gpsMarker = L.marker(newLatLng, {
      title: "GPS Position",
    })
      .addTo(map)
      .bindPopup("📍 GPS Position");

    lastLatLng = newLatLng;
  } else if (lastLatLng) {
    animateMarker(gpsMarker, lastLatLng, newLatLng);
    lastLatLng = newLatLng;
  } else {
    gpsMarker.setLatLng(newLatLng);
    lastLatLng = newLatLng;
  }

  // Akurasi GPS
  if (!gpsAccuracyCircle) {
    gpsAccuracyCircle = L.circle(newLatLng, {
      radius: accuracy,
      color: "blue",
      fillOpacity: 0.25,
    }).addTo(map);
  } else {
    gpsAccuracyCircle.setLatLng(newLatLng);
    gpsAccuracyCircle.setRadius(accuracy);
  }

  // Polyline GPS
  if (!gpsPolyline) {
    gpsPolyline = L.polyline(gpsRoutePoints, {
      color: "blue",
      weight: 4,
    });

    gpsRouteLayer.addLayer(gpsPolyline);
  } else {
    gpsPolyline.setLatLngs(gpsRoutePoints);
  }

  // Status UI
  updateStatusCard(lat, lng);
}

// ==================================================
// IP TRACKING
// ==================================================
function trackIP() {
  const ip = document.getElementById("ipInput").value.trim();

  if (!ip) {
    alert("Masukkan IP terlebih dahulu");
    return;
  }

  fetch("/track-ip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ip }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        alert(data.error);
        return;
      }

      const { lat, lng, city, country } = data;
      updateIPMap(lat, lng, city, country);
    })
    .catch(() => alert("Gagal melacak IP"));
}

// ==================================================
// IP MAP UPDATE
// ==================================================
function updateIPMap(lat, lng, city, country) {
  map.setView([lat, lng], 10);

  // Marker IP (tidak mengganggu GPS)
  if (ipMarker) {
    map.removeLayer(ipMarker);
  }

  ipMarker = L.circleMarker([lat, lng], {
    radius: 8,
    color: "red",
    fillColor: "orange",
    fillOpacity: 0.85,
  })
    .addTo(map)
    .bindPopup(
      `🌐 IP Location<br>
       ${city || "-"}, ${country || "-"}<br>
       Lat: ${lat}<br>Lng: ${lng}`
    )
    .openPopup();
}
