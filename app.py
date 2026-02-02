import os
import sqlite3
from datetime import datetime, date
from flask import Flask, request, jsonify, render_template, g, Response

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "feedback.db")


# ---------------- DB helpers ----------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
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


def iso_today():
    return date.today().isoformat()


def normalize_grau(grau: str) -> str:
    if not isinstance(grau, str):
        return ""
    grau = grau.strip().upper()
    valid = {"MUITO_SATISFEITO", "SATISFEITO", "INSATISFEITO"}
    return grau if grau in valid else ""


# ---------------- Pages ----------------

@app.route("/")
def kiosk():
    return render_template("kiosk.html")


@app.route("/admin")
def admin():
    # filtros (tabela)
    selected_day = request.args.get("day") or ""
    today = iso_today()

    # paginação
    page = int(request.args.get("page", 1))
    page = max(page, 1)
    per_page = 10
    offset = (page - 1) * per_page

    where = ""
    params = []

    if selected_day:
        where = "WHERE substr(created_at, 1, 10)=?"
        params.append(selected_day)

    db = get_db()

    rows = db.execute(
        f"SELECT * FROM feedback {where} "
        "ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (*params, per_page, offset)
    ).fetchall()

    total = db.execute(
        f"SELECT COUNT(*) FROM feedback {where}",
        params
    ).fetchone()[0]

    pages = (total + per_page - 1) // per_page

    return render_template(
        "admin.html",
        rows=rows,
        page=page,
        pages=pages,
        today=today,
        selected_day=selected_day
    )


# ---------------- Public API ----------------

@app.route("/api/feedback", methods=["POST"])
def api_feedback():
    data = request.get_json(silent=True) or {}
    grau = normalize_grau(data.get("grau", ""))

    if not grau:
        return jsonify(ok=False, message="Grau inválido."), 400

    now = datetime.now()
    created_at = now.isoformat(timespec="seconds")
    weekday = now.strftime("%A")  # Monday, Tuesday... (podes traduzir no front)

    db = get_db()
    db.execute(
        "INSERT INTO feedback (grau, created_at, weekday) VALUES (?, ?, ?)",
        (grau, created_at, weekday)
    )
    db.commit()

    return jsonify(ok=True, message="Obrigado pelo seu feedback!")


# ---------------- Stats API (Chart.js) ----------------

@app.route("/api/stats")
def api_stats():
    """
    Retorna:
    - totals: contagens por grau (geral ou por dia)
    - percents: percentagens por grau
    - by_weekday: contagens por weekday (geral ou por dia)
    - last7: total por dia (últimos 7 dias)
    - compare: comparação entre dois dias (opcional)
    Query params:
      day=YYYY-MM-DD (filtra tudo para esse dia)
      day1=YYYY-MM-DD&day2=YYYY-MM-DD (comparação)
    """
    day = request.args.get("day") or ""
    day1 = request.args.get("day1") or ""
    day2 = request.args.get("day2") or ""

    db = get_db()

    def totals_for(day_filter: str):
        where = ""
        params = []
        if day_filter:
            where = "WHERE substr(created_at, 1, 10)=?"
            params.append(day_filter)

        rows = db.execute(
            f"SELECT grau, COUNT(*) AS total FROM feedback {where} GROUP BY grau",
            params
        ).fetchall()

        totals = {r["grau"]: int(r["total"]) for r in rows}
        total_all = sum(totals.values())

        # garantir keys sempre presentes (para os gráficos não “saltarem”)
        for k in ["MUITO_SATISFEITO", "SATISFEITO", "INSATISFEITO"]:
            totals.setdefault(k, 0)

        percents = {}
        for k, v in totals.items():
            percents[k] = round((v / total_all) * 100, 1) if total_all else 0.0

        by_weekday_rows = db.execute(
            f"SELECT weekday, COUNT(*) AS total FROM feedback {where} GROUP BY weekday",
            params
        ).fetchall()
        by_weekday = [{"weekday": r["weekday"], "total": int(r["total"])} for r in by_weekday_rows]

        return totals, percents, by_weekday

    totals, percents, by_weekday = totals_for(day)

    # últimos 7 dias (sempre global)
    last7_rows = db.execute("""
        SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS total
        FROM feedback
        GROUP BY day
        ORDER BY day DESC
        LIMIT 7
    """).fetchall()
    last7 = list(reversed([{"day": r["day"], "total": int(r["total"])} for r in last7_rows]))

    compare = None
    if day1 and day2:
        t1, p1, _ = totals_for(day1)
        t2, p2, _ = totals_for(day2)
        compare = {
            "day1": day1,
            "day2": day2,
            "totals1": t1,
            "percents1": p1,
            "totals2": t2,
            "percents2": p2
        }

    return jsonify(
        ok=True,
        day=day,
        totals=totals,
        percents=percents,
        by_weekday=by_weekday,
        last7=last7,
        compare=compare
    )


# ---------------- Export CSV ----------------

@app.route("/admin/export")
def export_csv():
    db = get_db()
    rows = db.execute("SELECT * FROM feedback ORDER BY created_at DESC").fetchall()

    def generate():
        yield "id,grau,created_at,weekday\n"
        for r in rows:
            yield f'{r["id"]},{r["grau"]},{r["created_at"]},{r["weekday"]}\n'

    return Response(
        generate(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=feedback.csv"}
    )


# ---------------- Start ----------------

init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
