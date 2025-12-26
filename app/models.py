from app import db
from datetime import datetime

class RoutePoint(db.Model):
    __tablename__ = "routes"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(36), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    accuracy = db.Column(db.Float)
    source = db.Column(db.String(10))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
