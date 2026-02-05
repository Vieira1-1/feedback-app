// Respeitar altura do canvas (CSS)
Chart.defaults.maintainAspectRatio = false;

// Texto/linhas do gráfico bem visíveis
Chart.defaults.color = "rgba(255,255,255,.92)";
Chart.defaults.borderColor = "rgba(255,255,255,.12)";
Chart.defaults.plugins.legend.labels.color = "rgba(255,255,255,.92)";
Chart.defaults.plugins.tooltip.titleColor = "rgba(255,255,255,.95)";
Chart.defaults.plugins.tooltip.bodyColor = "rgba(255,255,255,.92)";

// Paleta (3 estados)
const COLORS = {
  MUITO_SATISFEITO: { bg: "rgba(46,229,157,.75)", border: "rgba(46,229,157,1)" },
  SATISFEITO:       { bg: "rgba(255,214,74,.80)", border: "rgba(255,214,74,1)" },
  INSATISFEITO:     { bg: "rgba(255,77,109,.78)", border: "rgba(255,77,109,1)" }
};

function labelGrau(g){
  if (g === "MUITO_SATISFEITO") return "Muito satisfeito";
  if (g === "SATISFEITO") return "Satisfeito";
  if (g === "INSATISFEITO") return "Insatisfeito";
  return g;
}

async function fetchStats(params = {}){
  const url = new URL("/api/stats", window.location.origin);
  Object.entries(params).forEach(([k,v]) => {
    if (v) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  return await res.json();
}

function buildDatasetFromTotals(totals){
  const keys = ["MUITO_SATISFEITO", "SATISFEITO", "INSATISFEITO"];
  const labels = keys.map(labelGrau);
  const values = keys.map(k => totals[k] ?? 0);
  const bg = keys.map(k => COLORS[k].bg);
  const border = keys.map(k => COLORS[k].border);
  return { keys, labels, values, bg, border };
}

const AXES = {
  scales: {
    x: {
      ticks: { color: "rgba(255,255,255,.92)" },
      grid: { color: "rgba(255,255,255,.08)" }
    },
    y: {
      ticks: { color: "rgba(255,255,255,.92)" },
      grid: { color: "rgba(255,255,255,.08)" }
    }
  },
  plugins: {
    legend: { labels: { color: "rgba(255,255,255,.92)" } }
  }
};

let pieChart, barChart, lineChart, weekdayChart, compareChart;

function renderMainCharts(data){
  const { totals, last7, by_weekday } = data;

  const ds = buildDatasetFromTotals(totals);

  // PIE / DOUGHNUT
  const pieCtx = document.getElementById("chartPie");
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: ds.labels,
      datasets: [{
        data: ds.values,
        backgroundColor: ds.bg,
        borderColor: "rgba(255,255,255,.20)",
        borderWidth: 2
      }]
    },
    options: {
      plugins: {
        legend: { labels: { color: "rgba(255,255,255,.92)" } }
      }
    }
  });

  // BAR
  const barCtx = document.getElementById("chartBar");
  if (barChart) barChart.destroy();
  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ds.labels,
      datasets: [{
        data: ds.values,
        backgroundColor: ds.bg,
        borderColor: ds.border,
        borderWidth: 1.5,
        borderRadius: 10
      }]
    },
    options: AXES
  });

  // LINE (últimos 7 dias)
  const lineCtx = document.getElementById("chartLine");
  const lLabels = (last7 || []).map(x => x.day);
  const lValues = (last7 || []).map(x => x.total);
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: lLabels,
      datasets: [{
        label: "Total",
        data: lValues,
        borderColor: "rgba(57,179,255,1)",
        backgroundColor: "rgba(57,179,255,.18)",
        fill: true,
        tension: 0.25,
        pointRadius: 3
      }]
    },
    options: {
      ...AXES,
      plugins: { legend: { display: false } }
    }
  });

  // WEEKDAY BAR
  const wCtx = document.getElementById("chartWeekday");
  const wLabels = (by_weekday || []).map(x => x.weekday);
  const wValues = (by_weekday || []).map(x => x.total);
  if (weekdayChart) weekdayChart.destroy();
  weekdayChart = new Chart(wCtx, {
    type: "bar",
    data: {
      labels: wLabels,
      datasets: [{
        label: "Total",
        data: wValues,
        backgroundColor: "rgba(255,255,255,.14)",
        borderColor: "rgba(255,255,255,.28)",
        borderWidth: 1.2,
        borderRadius: 10
      }]
    },
    options: {
      ...AXES,
      plugins: { legend: { display: false } }
    }
  });
}

function renderCompare(compare){
  const card = document.getElementById("compareCard");
  const label = document.getElementById("compareLabel");
  const ctx = document.getElementById("chartCompare");

  if (!compare){
    card.style.display = "none";
    if (compareChart) compareChart.destroy();
    compareChart = null;
    return;
  }

  card.style.display = "block";
  label.textContent = `${compare.day1} vs ${compare.day2}`;

  const keys = ["MUITO_SATISFEITO", "SATISFEITO", "INSATISFEITO"];
  const labels = keys.map(labelGrau);

  const d1 = keys.map(k => compare.totals1[k] ?? 0);
  const d2 = keys.map(k => compare.totals2[k] ?? 0);

  if (compareChart) compareChart.destroy();
  compareChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: compare.day1,
          data: d1,
          backgroundColor: "rgba(57,179,255,.35)",
          borderColor: "rgba(57,179,255,1)",
          borderWidth: 1.2,
          borderRadius: 10
        },
        {
          label: compare.day2,
          data: d2,
          backgroundColor: "rgba(46,229,157,.30)",
          borderColor: "rgba(46,229,157,1)",
          borderWidth: 1.2,
          borderRadius: 10
        }
      ]
    },
    options: AXES
  });
}

(async () => {
  const selectedDay = (window.__ADMIN_CONTEXT__ && window.__ADMIN_CONTEXT__.selectedDay) || "";

  const data = await fetchStats(selectedDay ? { day: selectedDay } : {});
  if (data && data.ok){
    renderMainCharts(data);
  }

  const d1 = document.getElementById("day1");
  const d2 = document.getElementById("day2");
  const btn = document.getElementById("btnCompare");

  if (btn) {
    btn.addEventListener("click", async () => {
      const day1 = d1.value;
      const day2 = d2.value;
      if (!day1 || !day2) return;

      const cmp = await fetchStats({ day1, day2 });
      if (cmp && cmp.ok){
        renderCompare(cmp.compare);
      }
    });
  }
})();
