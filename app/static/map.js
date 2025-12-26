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

// IP STATE
let ipMarker = null;

// Tracking control
let trackingTimer = null;
let trackingActive = false;

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

// ==================================================
// GPS MAP UPDATE
// ==================================================
function updateGPSMap(lat, lng, accuracy) {
  map.setView([lat, lng], 16);

  // Marker GPS
  if (!gpsMarker) {
    gpsMarker = L.marker([lat, lng], {
      title: "GPS Position",
    })
      .addTo(map)
      .bindPopup("📍 GPS Position");
  } else {
    gpsMarker.setLatLng([lat, lng]);
  }

  // Akurasi GPS
  if (!gpsAccuracyCircle) {
    gpsAccuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: "blue",
      fillOpacity: 0.15,
    }).addTo(map);
  } else {
    gpsAccuracyCircle.setLatLng([lat, lng]);
    gpsAccuracyCircle.setRadius(accuracy);
  }

  // Polyline GPS
  if (!gpsPolyline) {
    gpsPolyline = L.polyline(gpsRoutePoints, {
      color: "blue",
      weight: 4,
    }).addTo(map);
  } else {
    gpsPolyline.setLatLngs(gpsRoutePoints);
  }
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
