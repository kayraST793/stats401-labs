// Individual project - Visualization Critique and Redesign
// Redesign of a FRED dual-axis chart (Federal Funds Rate vs. CPI).
//
// The original overlays a percent rate on one y-axis and a price index on a
// second y-axis, which manufactures a false correlation and hides inflation.
// This redesign fixes that by:
//   1. converting CPI into year-over-year inflation (a percent rate);
//   2. plotting both series on a single, shared percent axis;
//   3. adding a zero line, direct labels, and a shared hover readout.
// Both series are now in the same unit, so one honest axis is legitimate and
// the real relationship between inflation and the policy rate is visible.

const parseDate = d3.timeParse("%Y-%m-%d");

d3.csv(
    "../data/fred_fedfunds_cpi.csv",
    d => ({
        date: parseDate(d.observation_date),
        fedfunds: d.FEDFUNDS === "" ? null : +d.FEDFUNDS,
        cpi: d.CPIAUCSL === "" ? null : +d.CPIAUCSL,
        recession: d.USREC === "1"
    })
).then(raw => {

    // Year-over-year CPI inflation: percent change from twelve months earlier.
    // (Monthly data, so the value twelve rows back is the same month last year.)
    raw.forEach((d, i) => {
        const prev = raw[i - 12];
        d.inflation = (i >= 12 && prev.cpi != null && d.cpi != null)
            ? (d.cpi - prev.cpi) / prev.cpi * 100
            : null;
    });

    // NBER recessions (USREC = 1): collapse runs of recession months into
    // [start, end] intervals so each one draws as a single shaded band.
    const recessions = [];
    let start = null;
    raw.forEach((d, i) => {
        if (d.recession && start === null) {
            start = d.date;
        } else if (!d.recession && start !== null) {
            recessions.push({ start, end: raw[i - 1].date });
            start = null;
        }
    });
    if (start !== null) {
        recessions.push({ start, end: raw[raw.length - 1].date });
    }

    // Keep only months where both series exist, so the two lines share a span.
    const data = raw.filter(d => d.fedfunds != null && d.inflation != null);

    drawChart(data, recessions);
});

function drawChart(data, recessions) {

    const series = [
        { key: "fedfunds",  label: "Federal Funds Rate",            endLabel: "Federal Funds Rate", color: "#1f77b4" },
        { key: "inflation", label: "CPI inflation (year-over-year)", endLabel: "CPI inflation (YoY)", color: "#d62728" }
    ];

    const width = 900;
    const height = 500;
    const margin = { top: 30, right: 160, bottom: 50, left: 60 };

    const svg = d3.select("#chart")
        .append("svg")
        .attr("class", "redesign-svg")
        .attr("width", width)
        .attr("height", height);

    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([margin.left, width - margin.right]);

    // One shared percent axis covering both series.
    const yMin = d3.min(data, d => Math.min(d.fedfunds, d.inflation));
    const yMax = d3.max(data, d => Math.max(d.fedfunds, d.inflation));
    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yMin), yMax])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // NBER recession bands, drawn first so they sit behind everything else.
    // Each band is clipped to the visible time span.
    const [domainStart, domainEnd] = xScale.domain();
    svg.append("g")
        .attr("class", "recessions")
        .selectAll("rect")
        .data(recessions.filter(r => r.end >= domainStart && r.start <= domainEnd))
        .join("rect")
        .attr("class", "recession-band")
        .attr("x", r => xScale(r.start < domainStart ? domainStart : r.start))
        .attr("y", margin.top)
        .attr("width", r =>
            xScale(r.end > domainEnd ? domainEnd : r.end) -
            xScale(r.start < domainStart ? domainStart : r.start))
        .attr("height", height - margin.top - margin.bottom);

    // Axes.
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yScale).tickFormat(d => d + "%"));

    // Y-axis title.
    svg.append("text")
        .attr("class", "axis-title")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margin.top + height - margin.bottom) / 2)
        .attr("y", 16)
        .text("Percent per year");

    // Zero reference line (inflation can go negative; the rate cannot).
    svg.append("line")
        .attr("class", "zero-line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", yScale(0))
        .attr("y2", yScale(0));

    // One line per series.
    series.forEach(s => {
        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d[s.key]));

        svg.append("path")
            .datum(data)
            .attr("class", "series-line")
            .attr("stroke", s.color)
            .attr("d", line);

        // Direct label at the right end, so no separate legend lookup is needed.
        const last = data[data.length - 1];
        svg.append("text")
            .attr("class", "series-label")
            .attr("x", width - margin.right + 8)
            .attr("y", yScale(last[s.key]))
            .attr("dy", "0.32em")
            .attr("fill", s.color)
            .text(s.endLabel);
    });

    // Shared hover readout: a vertical guide, a dot per series, and a tooltip.
    const tooltip = d3.select("#tooltip");
    const bisectDate = d3.bisector(d => d.date).center;
    const fmtDate = d3.timeFormat("%b %Y");

    const focus = svg.append("g")
        .attr("class", "focus")
        .style("display", "none");

    focus.append("line")
        .attr("class", "focus-line")
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom);

    focus.selectAll("circle")
        .data(series)
        .join("circle")
        .attr("class", "focus-dot")
        .attr("r", 4)
        .attr("fill", s => s.color);

    svg.append("rect")
        .attr("class", "overlay")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom)
        .on("mouseenter", () => focus.style("display", null))
        .on("mousemove", moved)
        .on("mouseleave", () => {
            focus.style("display", "none");
            tooltip.style("opacity", 0);
        });

    function moved(event) {
        const [mouseX] = d3.pointer(event);
        const d = data[bisectDate(data, xScale.invert(mouseX))];

        focus.select(".focus-line")
            .attr("x1", xScale(d.date))
            .attr("x2", xScale(d.date));

        focus.selectAll("circle")
            .data(series)
            .attr("cx", xScale(d.date))
            .attr("cy", s => yScale(d[s.key]));

        tooltip
            .style("opacity", 1)
            .style("left", (event.pageX + 14) + "px")
            .style("top", (event.pageY - 10) + "px")
            .html(
                `<strong>${fmtDate(d.date)}</strong><br>` +
                series.map(s =>
                    `<span class="tt-swatch" style="background:${s.color}"></span>` +
                    `${s.label}: ${d[s.key].toFixed(1)}%`
                ).join("<br>")
            );
    }
}
