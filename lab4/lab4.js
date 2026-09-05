/*
 * Four views of RoBERTa sentiment on 1,500 ChatGPT tweets (Dec 2022 to Feb 2023):
 *   1. Weekly line chart: one line per sentiment, trend over time
 *   2. Weekly polarity line: average sentiment score (net mood) per week
 *   3. Influence-tier grouped bars: sentiment share within each follower tier
 *   4. Model-confidence histogram: distribution of the winning-class probability
 * Note: sentiment values are model-generated estimates, not ground-truth labels.
 * Data feeds: ../data/sentiment_by_week.csv , ../data/polarity_by_week.csv ,
 *              ../data/sentiment_by_tier.csv , ../data/sentiment_confidence.csv
 */

// Fixed sentiment order + palette.
const SENTIMENTS = ["Negative", "Neutral", "Positive"];
const COLOR = d3
  .scaleOrdinal()
  .domain(SENTIMENTS)
  .range(["#e15759", "#bab0ac", "#59a14f"]);

// Shared tooltip.
const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

function showTip(html, event) {
  tooltip.html(html).style("opacity", 1);
  moveTip(event);
}
function moveTip(event) {
  tooltip
    .style("left", event.pageX + 14 + "px")
    .style("top", event.pageY - 10 + "px");
}
function hideTip() {
  tooltip.style("opacity", 0);
}

// A reusable legend. Pass `items` to customize; each item is
// {label, color, line?, dashed?}. Defaults to the three sentiment swatches.
function drawLegend(svg, x, y, items, spacing) {
  items = items || SENTIMENTS.map((s) => ({ label: s, color: COLOR(s) }));
  spacing = spacing || 110;
  const g = svg.append("g").attr("transform", `translate(${x},${y})`);
  items.forEach((it, i) => {
    const row = g.append("g").attr("transform", `translate(${i * spacing},0)`);
    if (it.line) {
      row
        .append("line")
        .attr("x1", 0)
        .attr("x2", 16)
        .attr("y1", 7)
        .attr("y2", 7)
        .attr("stroke", it.color)
        .attr("stroke-width", it.dashed ? 2.5 : 2)
        .attr("stroke-dasharray", it.dashed ? "5,4" : null);
    } else {
      row
        .append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 3)
        .attr("fill", it.color);
    }
    row
      .append("text")
      .attr("x", 22)
      .attr("y", 12)
      .attr("class", "legend-text")
      .text(it.label);
  });
}

// Pivot the long weekly feed -> one wide object per week (shared by both
// the stacked-bar and line views so they stay perfectly consistent).
function pivotWeekly(rows) {
  const byWeek = d3.rollup(
    rows,
    (v) => {
      const o = { week: v[0].week };
      SENTIMENTS.forEach((s) => (o[s] = 0));
      v.forEach((d) => (o[d.sentiment] = d.count));
      o.total = SENTIMENTS.reduce((a, s) => a + o[s], 0);
      return o;
    },
    (d) => d.week
  );
  return Array.from(byWeek.values()).sort((a, b) =>
    d3.ascending(a.week, b.week)
  );
}

// ----------------------------------------------------------------------
// Chart 1: Weekly line view (one line per sentiment)
// ----------------------------------------------------------------------
function lineChart(rows) {
  const data = pivotWeekly(rows);

  const margin = { top: 20, right: 20, bottom: 70, left: 55 };
  const width = 820 - margin.left - margin.right;
  const height = 420 - margin.top - margin.bottom;

  const svg = d3
    .select("#chart-line")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // scalePoint over the same week labels as the bar chart -> visually aligned.
  const x = d3
    .scalePoint()
    .domain(data.map((d) => d.week))
    .range([0, width])
    .padding(0.5);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d3.max(SENTIMENTS, (s) => d[s]))])
    .nice()
    .range([height, 0]);

  // Gridlines for readability.
  svg
    .append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(""))
    .call((g) => g.select(".domain").remove())
    .selectAll("line")
    .attr("stroke", "#eef1f4");

  const line = d3
    .line()
    .x((d) => x(d.week))
    .curve(d3.curveMonotoneX);

  // One coloured line per sentiment.
  SENTIMENTS.forEach((s) => {
    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", COLOR(s))
      .attr("stroke-width", 2)
      .attr("d", line.y((d) => y(d[s])));
  });

  // Hover dots for every sentiment series.
  SENTIMENTS.forEach((key) => {
    svg
      .append("g")
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", (d) => x(d.week))
      .attr("cy", (d) => y(d[key]))
      .attr("r", 3.2)
      .attr("fill", COLOR(key))
      .on("mouseover", (event, d) => {
        showTip(
          `<b>Week of ${d.week}</b><br>${key}: <b>${d[key]}</b><br>(${(
            (d[key] / d.total) *
            100
          ).toFixed(1)}% of week)`,
          event
        );
      })
      .on("mousemove", moveTip)
      .on("mouseout", hideTip);
  });

  // Axes.
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y).ticks(6));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .text("Tweet count");

  const legendItems = SENTIMENTS.map((s) => ({
    label: s,
    color: COLOR(s),
    line: true,
  }));
  drawLegend(
    d3.select("#chart-line svg"),
    margin.left,
    height + margin.top + 55,
    legendItems,
    130
  );
}

// ----------------------------------------------------------------------
// Chart 2: Weekly average polarity (net mood, uses sentiment_score)
// ----------------------------------------------------------------------
// Collapses each week to the mean of sentiment_score = P(pos) - P(neg).
// Above 0 = net-positive week, below 0 = net-negative. A polarity axis,
// distinct from the count chart's "how many tweets" question.
function polarityChart(rows) {
  const data = rows
    .slice()
    .sort((a, b) => d3.ascending(a.week, b.week));

  const margin = { top: 20, right: 20, bottom: 70, left: 55 };
  const width = 820 - margin.left - margin.right;
  const height = 380 - margin.top - margin.bottom;

  const svg = d3
    .select("#chart-polarity")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Same week domain as Chart 1 so the two time views line up visually.
  const x = d3
    .scalePoint()
    .domain(data.map((d) => d.week))
    .range([0, width])
    .padding(0.5);

  // y always includes 0 (the net-neutral line) plus the data range + padding.
  const ext = d3.extent(data, (d) => d.avg);
  const yMin = Math.min(0, ext[0]);
  const yMax = Math.max(0, ext[1]);
  const pad = (yMax - yMin) * 0.18 || 0.05;
  const y = d3
    .scaleLinear()
    .domain([yMin - pad, yMax + pad])
    .range([height, 0]);

  // Gridlines.
  svg
    .append("g")
    .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(""))
    .call((g) => g.select(".domain").remove())
    .selectAll("line")
    .attr("stroke", "#eef1f4");

  // Net-neutral reference line at 0.
  svg
    .append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .attr("stroke", "#8a9099")
    .attr("stroke-width", 1.25)
    .attr("stroke-dasharray", "5,4");
  svg
    .append("text")
    .attr("x", width)
    .attr("y", y(0) - 5)
    .attr("text-anchor", "end")
    .attr("fill", "#8a9099")
    .attr("font-size", "11px")
    .text("net neutral (0)");

  const line = d3
    .line()
    .x((d) => x(d.week))
    .y((d) => y(d.avg))
    .curve(d3.curveMonotoneX);

  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#b07aa1")
    .attr("stroke-width", 2.5)
    .attr("d", line);

  // Hover dots (green if net-positive that week, red if net-negative).
  svg
    .append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.week))
    .attr("cy", (d) => y(d.avg))
    .attr("r", 3.6)
    .attr("fill", (d) => (d.avg >= 0 ? "#59a14f" : "#e15759"))
    .on("mouseover", (event, d) => {
      showTip(
        `<b>Week of ${d.week}</b><br>Avg polarity: <b>${d.avg >= 0 ? "+" : ""}${d.avg.toFixed(
          3
        )}</b><br>(${d.n} tweets)`,
        event
      );
    })
    .on("mousemove", moveTip)
    .on("mouseout", hideTip);

  // Axes.
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("+.2f")));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -42)
    .attr("text-anchor", "middle")
    .text("Avg sentiment score (-1 to +1)");
}

// ----------------------------------------------------------------------
// Chart 3: Influence-tier grouped (side-by-side) bars by share
// ----------------------------------------------------------------------
function tierGroupedChart(rows) {
  const TIER_ORDER = ["Micro (<1k)", "Mid (1k-100k)", "Macro (>100k)"];

  // tier -> sentiment -> {share, count}, plus n per tier.
  const nByTier = d3.rollup(
    rows,
    (v) => d3.sum(v, (d) => d.count),
    (d) => d.follower_tier
  );
  const lookup = d3.rollup(
    rows,
    (v) => ({ share: v[0].share, count: v[0].count }),
    (d) => d.follower_tier,
    (d) => d.sentiment
  );

  const margin = { top: 20, right: 20, bottom: 70, left: 55 };
  const width = 820 - margin.left - margin.right;
  const height = 380 - margin.top - margin.bottom;

  const svg = d3
    .select("#chart-tier-grouped")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // x0 = tier groups; x1 = sentiment within each group.
  const x0 = d3
    .scaleBand()
    .domain(TIER_ORDER)
    .range([0, width])
    .paddingInner(0.25);
  const x1 = d3
    .scaleBand()
    .domain(SENTIMENTS)
    .range([0, x0.bandwidth()])
    .padding(0.08);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(rows, (d) => d.share)])
    .nice()
    .range([height, 0]);

  // Gridlines.
  svg
    .append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
    .call((g) => g.select(".domain").remove())
    .selectAll("line")
    .attr("stroke", "#eef1f4");

  svg
    .append("g")
    .selectAll("g")
    .data(TIER_ORDER)
    .join("g")
    .attr("transform", (t) => `translate(${x0(t)},0)`)
    .selectAll("rect")
    .data((t) =>
      SENTIMENTS.map((s) => ({
        tier: t,
        sentiment: s,
        share: lookup.get(t).get(s).share,
        count: lookup.get(t).get(s).count,
        n: nByTier.get(t),
      }))
    )
    .join("rect")
    .attr("x", (d) => x1(d.sentiment))
    .attr("y", (d) => y(d.share))
    .attr("width", x1.bandwidth())
    .attr("height", (d) => y(0) - y(d.share))
    .attr("fill", (d) => COLOR(d.sentiment))
    .on("mouseover", (event, d) => {
      showTip(
        `<b>${d.tier}</b> (n=${d.n})<br>${d.sentiment}: <b>${(
          d.share * 100
        ).toFixed(1)}%</b> (${d.count} tweets)`,
        event
      );
    })
    .on("mousemove", moveTip)
    .on("mouseout", hideTip);

  // Axes.
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0));

  // Sample-size (n=) label under each tier group.
  svg
    .append("g")
    .selectAll("text")
    .data(TIER_ORDER)
    .join("text")
    .attr("x", (t) => x0(t) + x0.bandwidth() / 2)
    .attr("y", height + 36)
    .attr("text-anchor", "middle")
    .attr("fill", "#57606a")
    .attr("font-size", "11px")
    .text((t) => `n=${nByTier.get(t)}`);

  svg.append("g").call(d3.axisLeft(y).ticks(5, "%"));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .text("Share within tier");

  drawLegend(
    d3.select("#chart-tier-grouped svg"),
    margin.left,
    height + margin.top + 50
  );
}

// ----------------------------------------------------------------------
// Chart 4: Model-confidence histogram (Optional Extension)
// ----------------------------------------------------------------------
// Distribution of the winning-class probability across all tweets. Answers
// "how often is RoBERTa confident vs. uncertain?" before we trust the labels.
function confidenceHistogram(values) {
  const LOW = 0.5; // low-confidence threshold
  const total = values.length;

  const margin = { top: 20, right: 20, bottom: 70, left: 55 };
  const width = 820 - margin.left - margin.right;
  const height = 380 - margin.top - margin.bottom;

  const svg = d3
    .select("#chart-confidence")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // A 3-class softmax winner sits in [~0.33, 1.0]; bin in even 0.05 steps.
  const x = d3.scaleLinear().domain([0.33, 1.0]).range([0, width]);
  const thresholds = d3.range(0.35, 1.001, 0.05);
  const bins = d3
    .bin()
    .domain(x.domain())
    .thresholds(thresholds)(values);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (b) => b.length)])
    .nice()
    .range([height, 0]);

  // Gridlines.
  svg
    .append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
    .call((g) => g.select(".domain").remove())
    .selectAll("line")
    .attr("stroke", "#eef1f4");

  // Shade the low-confidence region (left of the threshold).
  svg
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", x(LOW))
    .attr("height", height)
    .attr("fill", "#e15759")
    .attr("opacity", 0.06);

  // Bars: red-ish if below threshold, steel blue otherwise.
  svg
    .append("g")
    .selectAll("rect")
    .data(bins)
    .join("rect")
    .attr("x", (d) => x(d.x0) + 1)
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr("height", (d) => y(0) - y(d.length))
    .attr("fill", (d) => (d.x1 <= LOW ? "#e15759" : "#4e79a7"))
    .on("mouseover", (event, d) => {
      showTip(
        `<b>${d.x0.toFixed(2)} to ${d.x1.toFixed(2)}</b><br>${d.length} tweets` +
          `<br>(${((d.length / total) * 100).toFixed(1)}% of all)`,
        event
      );
    })
    .on("mousemove", moveTip)
    .on("mouseout", hideTip);

  // Dashed threshold line at 0.50.
  svg
    .append("line")
    .attr("x1", x(LOW))
    .attr("x2", x(LOW))
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#b42318")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "5,4");

  const lowPct = (d3.sum(bins.filter((b) => b.x1 <= LOW), (b) => b.length) /
    total) *
    100;
  svg
    .append("text")
    .attr("x", x(LOW) + 6)
    .attr("y", 14)
    .attr("fill", "#b42318")
    .attr("font-size", "11px")
    .text(`< 0.50 low confidence (${lowPct.toFixed(1)}%)`);

  // Axes.
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format(".2f")));

  svg.append("g").call(d3.axisLeft(y).ticks(5));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .text("Confidence (winning-class probability)");

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .text("Tweet count");
}

// ----------------------------------------------------------------------
// Load all feeds, then draw.
// ----------------------------------------------------------------------
Promise.all([
  d3.csv("../data/sentiment_by_week.csv", (d) => ({
    week: d.week,
    sentiment: d.sentiment,
    count: +d.count,
  })),
  d3.csv("../data/polarity_by_week.csv", (d) => ({
    week: d.week,
    avg: +d.avg_score,
    n: +d.n,
  })),
  d3.csv("../data/sentiment_by_tier.csv", (d) => ({
    follower_tier: d.follower_tier,
    sentiment: d.sentiment,
    count: +d.count,
    share: +d.share,
  })),
  d3.csv("../data/sentiment_confidence.csv", (d) => +d.sentiment_confidence),
])
  .then(([weekRows, polarityRows, tierRows, confidenceRows]) => {
    lineChart(weekRows);
    polarityChart(polarityRows);
    tierGroupedChart(tierRows);
    confidenceHistogram(confidenceRows);
  })
  .catch((err) => {
    d3.select("#error").style("display", "block").text(
      "Could not load data. Serve this folder over HTTP (e.g. `python -m http.server`) rather than opening the file directly. Details: " +
        err
    );
  });
