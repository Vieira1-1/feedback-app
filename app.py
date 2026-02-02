import os
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, render_template, g, Response

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "feedback.db")

_last_click_by_ip = {}
COOLDOWN_SECONDS = 2.5


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
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


def client_ip(req):
    xf = req.headers.get("X-Forwarded-For", "")
    if xf:
        return xf.split(",")[0].strip()
    return req.remote_addr or "unknown"


def allow_click(ip: str) -> bool:
    now = datetime.utcnow().timestamp()
    last = _last_click_by_ip.get(ip, 0)
    if (now - last) < COOLDOWN_SECONDS:
        return False
    _last_click_by_ip[ip] = now
    return True


@app.route("/")
def kiosk():
    return render_template("kiosk.html")


@app.route("/admin")
def admin():
    return render_template("admin.html")


@app.route("/api/feedback", methods=["POST"])
def api_feedback():
    data = request.get_json(silent=True) or {}
    grau = (data.get("grau") or "").strip()

    valid = {"MUITO_SATISFEITO", "SATISFEITO", "INSATISFEITO"}
    if grau not in valid:
        return jsonify(ok=False, message="Grau inválido."), 400

    ip = client_ip(request)
    if not allow_click(ip):
        return jsonify(ok=False, message="Aguarda um momento…"), 429

    now = datetime.now()
    created_at = now.isoformat(timespec="seconds")
    weekday = now.strftime("%A")

    db = get_db()
    db.execute(
        "INSERT INTO feedback (grau, created_at, weekday) VALUES (?, ?, ?)",
        (grau, created_at, weekday),
    )
    db.commit()

    return jsonify(ok=True, message="Obrigado pelo seu feedback!")


@app.route("/api/stats")
def api_stats():
    db = get_db()

    rows = db.execute("""
        SELECT grau, COUNT(*) as total
        FROM feedback
        GROUP BY grau
        ORDER BY total DESC
    """).fetchall()
    totals = {r["grau"]: r["total"] for r in rows}

    rows2 = db.execute("""
        SELECT substr(created_at, 1, 10) as day, COUNT(*) as total
        FROM feedback
        GROUP BY day
        ORDER BY day DESC
        LIMIT 7
    """).fetchall()
    last7 = list(reversed([{"day": r["day"], "total": r["total"]} for r in rows2]))

    rows3 = db.execute("""
        SELECT weekday, COUNT(*) as total
        FROM feedback
        GROUP BY weekday
        ORDER BY total DESC
    """).fetchall()
    by_weekday = [{"weekday": r["weekday"], "total": r["total"]} for r in rows3]

    return jsonify(ok=True, totals=totals, last7=last7, by_weekday=by_weekday)


@app.route("/api/export.csv")
def export_csv():
    db = get_db()
    rows = db.execute("SELECT id, grau, created_at, weekday FROM feedback ORDER BY id DESC").fetchall()

    def generate():
        yield "id,grau,created_at,weekday\n"
        for r in rows:
            yield f'{r["id"]},{r["grau"]},{r["created_at"]},{r["weekday"]}\n'

    return Response(generate(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=feedback.csv"})


# MUITO IMPORTANTE: garantir BD/tabela no arranque (local + Render)
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

