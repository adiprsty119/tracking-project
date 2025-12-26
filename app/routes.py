from flask import request, jsonify, render_template
from flask import current_app as app
from app import db
from app.models import RoutePoint
import requests

# =============================
# CACHE LOKASI TERAKHIR (OPSIONAL)
# =============================
last_location = {
    "lat": None,
    "lng": None,
    "accuracy": None
}


# =============================
# HALAMAN UTAMA
# =============================
@app.route("/")
def index():
    return render_template("index.html")


# =============================
# GPS TRACKING (POST)
# =============================
@app.route("/location", methods=["POST"])
def receive_location():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    lat = data.get("lat")
    lng = data.get("lng")
    acc = data.get("accuracy")
    session_id = data.get("session_id")

    # VALIDASI KETAT
    if lat is None or lng is None or not session_id:
        return jsonify({"error": "Invalid data"}), 400

    try:
        point = RoutePoint(
            session_id=session_id,
            latitude=float(lat),
            longitude=float(lng),
            accuracy=float(acc) if acc else None,
            source="gps"
        )

        db.session.add(point)
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        print("DB ERROR:", e)
        return jsonify({"error": "Database error"}), 500

    # Update cache
    last_location.update({
        "lat": lat,
        "lng": lng,
        "accuracy": acc
    })

    print(f"[GPS] {lat}, {lng} (±{acc}m)")

    return jsonify({"status": "saved"})


# =============================
# GPS TRACKING (GET - CACHE)
# =============================
@app.route("/location", methods=["GET"])
def get_location():
    return jsonify(last_location)


# =============================
# IP TRACKING
# =============================
@app.route("/track-ip", methods=["POST"])
def track_ip():
    data = request.get_json(silent=True)

    if not data or not data.get("ip"):
        return jsonify({"success": False, "error": "IP tidak valid"}), 400

    ip = data["ip"]

    try:
        res = requests.get(
            f"http://ip-api.com/json/{ip}",
            timeout=5
        ).json()
    except Exception as e:
        print("GeoIP ERROR:", e)
        return jsonify({"success": False, "error": "GeoIP service error"}), 500

    if res.get("status") != "success":
        return jsonify({"success": False, "error": "IP tidak ditemukan"}), 404

    # SIMPAN KE DATABASE
    try:
        point = RoutePoint(
            session_id="ip-manual",
            latitude=res["lat"],
            longitude=res["lon"],
            accuracy=None,
            source="ip"
        )

        db.session.add(point)
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        print("DB ERROR:", e)
        return jsonify({"success": False, "error": "Database error"}), 500

    print(f"[IP] {ip} → {res['lat']}, {res['lon']}")

    return jsonify({
        "success": True,
        "lat": res["lat"],
        "lng": res["lon"],
        "city": res.get("city"),
        "country": res.get("country")
    })
