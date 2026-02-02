import os
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, render_template, g

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "feedback.db")

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db:
        db.close()

def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            grau TEXT NOT NULL,
            created_at TEXT NOT NULL,
            weekday TEXT NOT NULL
        )
    """)
    db.commit()
    db.close()

@app.route("/")
def kiosk():
    return render_template("kiosk.html")

@app.route("/api/feedback", methods=["POST"])
def feedback():
    data = request.get_json()
    grau = data.get("grau")

    now = datetime.now()
    db = get_db()
    db.execute(
        "INSERT INTO feedback (grau, created_at, weekday) VALUES (?, ?, ?)",
        (grau, now.isoformat(timespec="seconds"), now.strftime("%A"))
    )
    db.commit()

    return jsonify(ok=True, message="Obrigado!")

@app.route("/admin")
def admin():
    db = get_db()
    rows = db.execute("SELECT * FROM feedback ORDER BY created_at DESC").fetchall()
    return render_template("admin.html", rows=rows)

@app.route("/api/stats")
def stats():
    db = get_db()
    rows = db.execute("""
        SELECT grau, COUNT(*) as total
        FROM feedback
        GROUP BY grau
    """).fetchall()

    return jsonify({r["grau"]: r["total"] for r in rows})

init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
