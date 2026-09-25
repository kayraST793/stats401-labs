// Lab 8 assignment - interactive exploration of the DKU Undergraduate Bulletin.
// Loads the combined map file and renders the corpus overview, the semantic
// embedding map, and the coordinated Topic by Section matrix.

function statsFor(data) {
    const sections = new Set(data.map(d => d.section).filter(Boolean)).size;
    const avg = d3.mean(data, d => +d.word_count || d.text.trim().split(/\s+/).length);
    return { count: data.length, sections, avg };
}

Promise.all([
    d3.csv("../data/bulletin_passages.csv"),
    d3.csv("../data/lab8_embedding_map.csv"),
    d3.csv("../data/lab8_terms_tfidf.csv"),
    d3.json("../data/lab8_neighbors.json"),
    d3.csv("../data/lab8_topics.csv")
]).then(([raw, map, tfidf, neighbors, topics]) => {

    raw.forEach(d => d.word_count = d.text.trim().split(/\s+/).length);
    map.forEach(d => {
        d.word_count = +d.word_count;
        d.x = +d.x;
        d.y = +d.y;
        d.cluster = +d.cluster;
    });
    tfidf.forEach(d => d.score = +d.score);
    topics.forEach(d => { d.cluster = +d.cluster; d.size = +d.size; });

    const rawStats = statsFor(raw);
    const cleanStats = statsFor(map);
    d3.select("#corpus-stats").selectAll("div.summary-item")
        .data([
            ["Raw passages", rawStats.count],
            ["Passages after cleaning", cleanStats.count],
            ["Formal sections", cleanStats.sections],
            ["Avg. words per passage", cleanStats.avg.toFixed(0)]
        ])
        .join("div").attr("class", "summary-item")
        .html(d => `<strong>${d[1]}</strong> ${d[0]}`);

    const topicNames = topics.slice().sort((a, b) => a.cluster - b.cluster)
        .map(d => d.cluster_name);
    const topicColor = d3.scaleOrdinal(topicNames, d3.schemeTableau10);

    drawSectionBar("#bar-sections", map);
    drawHistogram("#hist-length", map);
    drawTermBar("#bar-terms", tfidf);

    const mapApi = drawEmbeddingMap("#embed-map", "#map-legend", map, topics, topicColor, neighbors);
    const matrixApi = drawMatrix("#matrix", "#matrix-legend", map, topics, topicColor);

    matrixApi.onCellClick((section, topic) => mapApi.filterTo(section, topic));
    mapApi.onSelect(d => matrixApi.highlightCell(d.section, d.cluster_name));
});

function drawHistogram(selector, data) {
    const width = 820, height = 240;
    const margin = { top: 10, right: 20, bottom: 44, left: 56 };

    const svg = d3.select(selector).append("svg")
        .attr("width", width).attr("height", height).attr("class", "card");

    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.word_count)]).nice()
        .range([margin.left, width - margin.right]);
    const bins = d3.bin().value(d => d.word_count).thresholds(30)(data);
    const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).nice()
        .range([height - margin.bottom, margin.top]);

    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));
    svg.append("g").attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5));

    svg.selectAll("rect").data(bins).join("rect")
        .attr("x", b => x(b.x0) + 1).attr("y", b => y(b.length))
        .attr("width", b => Math.max(0, x(b.x1) - x(b.x0) - 1))
        .attr("height", b => y(0) - y(b.length)).attr("fill", "#1f3864");

    svg.append("text").attr("class", "axis-label")
        .attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 8).attr("text-anchor", "middle").text("Words per passage");
}

function drawSectionBar(selector, data) {
    const counts = d3.rollups(data, v => v.length, d => d.section)
        .filter(d => d[0])
        .sort((a, b) => d3.descending(a[1], b[1])).slice(0, 15);

    const width = 820, barH = 22;
    const margin = { top: 10, right: 50, bottom: 30, left: 260 };
    const height = margin.top + margin.bottom + counts.length * barH;

    const svg = d3.select(selector).append("svg")
        .attr("width", width).attr("height", height).attr("class", "card");

    const x = d3.scaleLinear().domain([0, d3.max(counts, d => d[1])]).nice()
        .range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(counts.map(d => d[0]))
        .range([margin.top, height - margin.bottom]).padding(0.18);

    const clip = s => s.length > 40 ? s.slice(0, 38) + "..." : s;

    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(6));
    svg.append("g").attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(clip)).selectAll("text").attr("class", "matrix-label");

    svg.selectAll("rect").data(counts).join("rect")
        .attr("x", margin.left).attr("y", d => y(d[0]))
        .attr("width", d => x(d[1]) - margin.left).attr("height", y.bandwidth())
        .attr("fill", "#2c4f8a");

    svg.selectAll("text.val").data(counts).join("text").attr("class", "val")
        .attr("x", d => x(d[1]) + 5).attr("y", d => y(d[0]) + y.bandwidth() / 2)
        .attr("dy", "0.35em").attr("font-size", 11).attr("fill", "#57606a").text(d => d[1]);
}

function drawTermBar(selector, terms) {
    const width = 820, barH = 22;
    const margin = { top: 10, right: 50, bottom: 30, left: 150 };
    const height = margin.top + margin.bottom + terms.length * barH;

    const svg = d3.select(selector).append("svg")
        .attr("width", width).attr("height", height).attr("class", "card");

    const x = d3.scaleLinear().domain([0, d3.max(terms, d => d.score)]).nice()
        .range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(terms.map(d => d.term))
        .range([margin.top, height - margin.bottom]).padding(0.18);

    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(6));
    svg.append("g").attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y)).selectAll("text").attr("class", "matrix-label");

    svg.selectAll("rect").data(terms).join("rect")
        .attr("x", margin.left).attr("y", d => y(d.term))
        .attr("width", d => x(d.score) - margin.left).attr("height", y.bandwidth())
        .attr("fill", "#59a14f");
}

function drawEmbeddingMap(svgSel, legendSel, data, topics, color, neighbors) {
    const width = 900, height = 600;
    const margin = { top: 16, right: 16, bottom: 16, left: 16 };

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.x)).nice()
        .range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain(d3.extent(data, d => d.y)).nice()
        .range([height - margin.bottom, margin.top]);
    const size = d3.scaleSqrt().domain(d3.extent(data, d => d.word_count)).range([2.2, 9]);

    const byId = new Map(data.map(d => [d.passage_id, d]));

    const svg = d3.select(svgSel).append("svg")
        .attr("width", width).attr("height", height).attr("class", "card");

    const gZoom = svg.append("g");
    const gLinks = gZoom.append("g")
        .attr("stroke", "#333").attr("stroke-opacity", 0.35).attr("stroke-width", 1);

    const points = gZoom.selectAll("circle.passage").data(data).join("circle")
        .attr("class", "passage")
        .attr("cx", d => x(d.x)).attr("cy", d => y(d.y))
        .attr("r", d => size(d.word_count))
        .attr("fill", d => color(d.cluster_name))
        .attr("fill-opacity", 0.72).attr("stroke", "#fff").attr("stroke-width", 0.4)
        .style("cursor", "pointer");

    const zoom = d3.zoom().scaleExtent([0.6, 12])
        .on("zoom", e => gZoom.attr("transform", e.transform));
    svg.call(zoom);

    const detail = d3.select("#map-detail");
    let selectCb = null;

    function selectPassage(d) {
        const nb = neighbors[d.passage_id] || [];
        const nbIds = new Set(nb.map(n => n.id));

        points.attr("stroke", p => p === d ? "#111" : (nbIds.has(p.passage_id) ? "#d97706" : "#fff"))
            .attr("stroke-width", p => p === d ? 1.8 : (nbIds.has(p.passage_id) ? 1.6 : 0.4));

        gLinks.selectAll("line").data(nb).join("line")
            .attr("x1", x(d.x)).attr("y1", y(d.y))
            .attr("x2", n => x(byId.get(n.id).x)).attr("y2", n => y(byId.get(n.id).y));

        const rows = nb.map((n, i) => {
            const p = byId.get(n.id);
            const cross = p.section !== d.section ? ' <span class="tag partial">other</span>' : '';
            return `<tr><td class="num">${i + 1}</td><td class="num">${(+n.score).toFixed(3)}</td>` +
                `<td>${p.section || p.chapter}${cross}</td>` +
                `<td><a href="#" data-id="${p.passage_id}">${p.text.slice(0, 90)}...</a></td></tr>`;
        }).join("");

        detail.html(
            `<div class="matrix-label">${d.chapter} &gt; ${d.section || "-"}` +
            `${d.subsection ? " &gt; " + d.subsection : ""} | page ${d.page}</div>` +
            `<div style="margin:4px 0"><span class="tt-swatch" style="background:${color(d.cluster_name)}"></span>` +
            `<strong>${d.cluster_name}</strong> | ${d.word_count} words</div>` +
            `<p style="margin:6px 0 8px">${d.text}</p>` +
            `<div class="chart-note" style="margin:0 0 4px">Nearest semantic neighbours ` +
            `<span style="color:#d97706">&#9679;</span> (ringed on the map):</div>` +
            `<table class="map-table"><thead><tr><th>#</th><th>Sim.</th><th>Section</th>` +
            `<th>Passage</th></tr></thead><tbody>${rows}</tbody></table>`
        );

        detail.selectAll("a[data-id]").on("click", (ev) => {
            ev.preventDefault();
            selectPassage(byId.get(ev.currentTarget.getAttribute("data-id")));
        });

        if (selectCb) selectCb(d);
    }

    points.on("click", (event, d) => selectPassage(d));

    const searchBox = d3.select("#map-search");
    const topicSel = d3.select("#map-topic");
    const sectionSel = d3.select("#map-section");

    topicSel.selectAll("option")
        .data(["All topics"].concat(topics.slice().sort((a, b) => a.cluster - b.cluster)
            .map(d => d.cluster_name)))
        .join("option").attr("value", d => d).text(d => d);

    const sections = Array.from(new Set(data.map(d => d.section).filter(Boolean))).sort();
    sectionSel.selectAll("option").data(["All sections"].concat(sections))
        .join("option").attr("value", d => d).text(d => d);

    function applyFilters() {
        const q = searchBox.property("value").toLowerCase().trim();
        const topic = topicSel.property("value");
        const section = sectionSel.property("value");
        points.attr("fill-opacity", d => {
            const okTopic = topic === "All topics" || d.cluster_name === topic;
            const okSection = section === "All sections" || d.section === section;
            const okSearch = q === "" || d.text_clean.toLowerCase().includes(q);
            return (okTopic && okSection && okSearch) ? 0.85 : 0.05;
        });
    }

    searchBox.on("input", applyFilters);
    topicSel.on("change", applyFilters);
    sectionSel.on("change", applyFilters);

    d3.select("#map-reset").on("click", () => {
        searchBox.property("value", "");
        topicSel.property("value", "All topics");
        sectionSel.property("value", "All sections");
        points.attr("stroke", "#fff").attr("stroke-width", 0.4);
        gLinks.selectAll("line").remove();
        detail.html("Click a point to see the passage.");
        if (selectCb) selectCb({ section: null, cluster_name: null });
        svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
        applyFilters();
    });

    const legend = d3.select(legendSel);
    legend.html("");
    const topicBlock = legend.append("div").attr("class", "legend-block");
    topicBlock.append("span").attr("class", "legend-title").text("Topic:");
    topicBlock.selectAll("span.legend-row")
        .data(topics.slice().sort((a, b) => a.cluster - b.cluster))
        .join("span").attr("class", "legend-row")
        .html(d => `<span class="tt-swatch" style="background:${color(d.cluster_name)}"></span>${d.cluster_name}`);

    const sizeBlock = legend.append("div").attr("class", "legend-block");
    sizeBlock.append("span").attr("class", "legend-title").text("Passage length:");
    const sl = sizeBlock.append("svg").attr("width", 220).attr("height", 26);
    let cx = 12;
    [20, 80, 200].forEach(t => {
        sl.append("circle").attr("cx", cx).attr("cy", 13).attr("r", size(t))
            .attr("fill", "#9aa4b2").attr("fill-opacity", 0.7);
        sl.append("text").attr("x", cx).attr("y", 24).attr("text-anchor", "middle")
            .attr("font-size", 9).attr("fill", "#57606a").text(t + "w");
        cx += 70;
    });

    function filterTo(section, topic) {
        sectionSel.property("value", sections.includes(section) ? section : "All sections");
        topicSel.property("value", topic || "All topics");
        applyFilters();
    }

    return { onSelect: cb => { selectCb = cb; }, filterTo };
}

function drawMatrix(svgSel, legendSel, data, topics, color) {
    const topicNames = topics.slice().sort((a, b) => a.cluster - b.cluster)
        .map(d => d.cluster_name);

    const totals = d3.rollup(data, v => v.length, d => d.section);
    const topSections = Array.from(totals).filter(d => d[0])
        .sort((a, b) => d3.descending(a[1], b[1])).slice(0, 20).map(d => d[0]);

    const counts = new Map();
    data.forEach(d => {
        const key = d.section + "||" + d.cluster_name;
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    const cells = [];
    topSections.forEach(sec => topicNames.forEach(top => {
        cells.push({
            section: sec, topic: top,
            count: counts.get(sec + "||" + top) || 0, total: totals.get(sec)
        });
    }));

    const width = 900;
    const margin = { top: 150, right: 20, bottom: 20, left: 250 };
    const colW = (width - margin.left - margin.right) / topicNames.length;
    const rowH = 24;
    const height = margin.top + topSections.length * rowH + margin.bottom;

    const svg = d3.select(svgSel).append("svg")
        .attr("width", width).attr("height", height).attr("class", "matrix-svg");

    const cScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, Math.sqrt(d3.max(cells, c => c.count))]);

    const tooltip = d3.select("#tooltip");
    const clip = s => s.length > 34 ? s.slice(0, 32) + "..." : s;
    const shortTopic = s => s.split(/[ ,&]/)[0];

    const cols = svg.append("g");
    topicNames.forEach((t, i) => {
        const cx = margin.left + i * colW + colW / 2;
        cols.append("rect").attr("x", cx - 6).attr("y", margin.top - 14)
            .attr("width", 12).attr("height", 12).attr("fill", color(t));
        cols.append("text").attr("x", cx).attr("y", margin.top - 20)
            .attr("transform", `rotate(-40 ${cx} ${margin.top - 20})`)
            .attr("text-anchor", "start").attr("font-size", 11).attr("fill", "#1f2328")
            .text(shortTopic(t));
    });

    svg.append("g").selectAll("text.row").data(topSections).join("text")
        .attr("class", "row matrix-label").attr("x", margin.left - 8)
        .attr("y", (d, r) => margin.top + r * rowH + rowH / 2)
        .attr("dy", "0.35em").attr("text-anchor", "end").text(clip);

    let cellCb = null;
    const cellRects = svg.append("g").selectAll("rect.cell").data(cells).join("rect")
        .attr("class", "cell")
        .attr("x", d => margin.left + topicNames.indexOf(d.topic) * colW)
        .attr("y", d => margin.top + topSections.indexOf(d.section) * rowH)
        .attr("width", colW - 2).attr("height", rowH - 2)
        .attr("fill", d => d.count === 0 ? "#f7f9fc" : cScale(Math.sqrt(d.count)))
        .attr("stroke", "#e6ebf2").attr("stroke-width", 1)
        .on("mousemove", (event, d) => {
            const pct = d.total ? Math.round(100 * d.count / d.total) : 0;
            tooltip.style("opacity", 1)
                .style("left", (event.pageX + 12) + "px").style("top", (event.pageY - 10) + "px")
                .html(`<strong>${d.section}</strong><br>${d.topic}<br>` +
                    `${d.count} passage${d.count === 1 ? "" : "s"} (${pct}% of section)`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", (event, d) => {
            highlightCell(d.section, d.topic);
            if (cellCb) cellCb(d.section, d.topic);
        });

    function highlightCell(section, topic) {
        cellRects.attr("stroke", c => (c.section === section && c.topic === topic) ? "#d97706" : "#e6ebf2")
            .attr("stroke-width", c => (c.section === section && c.topic === topic) ? 3 : 1);
        cellRects.filter(c => c.section === section && c.topic === topic).raise();
    }

    const legend2 = d3.select(legendSel);
    const topicBlock = legend2.append("div").attr("class", "legend-block");
    topicBlock.append("span").attr("class", "legend-title").text("Topic:");
    topicBlock.selectAll("span.legend-row").data(topicNames).join("span")
        .attr("class", "legend-row")
        .html(t => `<span class="tt-swatch" style="background:${color(t)}"></span>${t}`);

    const legend = legend2.append("div").attr("class", "legend-block");
    legend.append("span").attr("class", "legend-title").text("Passages per cell:");
    const maxc = d3.max(cells, c => c.count);
    const sl = legend.append("svg").attr("width", 220).attr("height", 26);
    [0, Math.round(maxc / 4), Math.round(maxc / 2), maxc].forEach((v, i) => {
        sl.append("rect").attr("x", i * 52).attr("y", 4).attr("width", 22).attr("height", 12)
            .attr("fill", v === 0 ? "#f7f9fc" : cScale(Math.sqrt(v))).attr("stroke", "#e6ebf2");
        sl.append("text").attr("x", i * 52 + 11).attr("y", 25).attr("text-anchor", "middle")
            .attr("font-size", 9).attr("fill", "#57606a").text(v);
    });

    return { highlightCell, onCellClick: cb => { cellCb = cb; } };
}
