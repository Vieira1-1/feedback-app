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
  return { labels, values };
}

let pieChart, barChart, lineChart, weekdayChart, compareChart;

function renderMainCharts(data){
  const { totals, last7, by_weekday } = data;

  // Pie
  const ds = buildDatasetFromTotals(totals);
  const pieCtx = document.getElementById("chartPie");
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type: "doughnut",
    data: { labels: ds.labels, datasets: [{ data: ds.values }] }
  });

  // Bar
  const barCtx = document.getElementById("chartBar");
  if (barChart) barChart.destroy();
  barChart = new Chart(barCtx, {
    type: "bar",
    data: { labels: ds.labels, datasets: [{ data: ds.values }] }
  });

  // Line last7
  const lineCtx = document.getElementById("chartLine");
  const lLabels = (last7 || []).map(x => x.day);
  const lValues = (last7 || []).map(x => x.total);
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(lineCtx, {
    type: "line",
    data: { labels: lLabels, datasets: [{ data: lValues }] }
  });

  // Weekday bar
  const wCtx = document.getElementById("chartWeekday");
  const wLabels = (by_weekday || []).map(x => x.weekday);
  const wValues = (by_weekday || []).map(x => x.total);
  if (weekdayChart) weekdayChart.destroy();
  weekdayChart = new Chart(wCtx, {
    type: "bar",
    data: { labels: wLabels, datasets: [{ data: wValues }] }
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
        { label: compare.day1, data: d1 },
        { label: compare.day2, data: d2 }
      ]
    }
  });
}

(async () => {
  const selectedDay = (window.__ADMIN_CONTEXT__ && window.__ADMIN_CONTEXT__.selectedDay) || "";

  // Charts principais (se day estiver selecionado, mostramos stats desse dia)
  const data = await fetchStats(selectedDay ? { day: selectedDay } : {});
  if (data && data.ok){
    renderMainCharts(data);
  }

  // Comparação
  const d1 = document.getElementById("day1");
  const d2 = document.getElementById("day2");
  const btn = document.getElementById("btnCompare");

  btn.addEventListener("click", async () => {
    const day1 = d1.value;
    const day2 = d2.value;
    if (!day1 || !day2) return;

    const cmp = await fetchStats({ day1, day2 });
    if (cmp && cmp.ok){
      renderCompare(cmp.compare);
    }
  });
})();
