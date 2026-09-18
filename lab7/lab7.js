/*
 * Lab 7 assignment - Animated Temporal Commercial Network.
 *   12 companies trade over 60 days. A force-directed graph shows who is
 *   trading on the current day; the animation walks day 1 -> day 60.
 *     sector             -> node fill colour
 *     region             -> node stroke colour
 *     current volume     -> node size (area, sqrt scale)
 *     active today       -> thicker node outline
 *     amount_usd         -> link width
 *     transaction_type   -> link colour
 *   Links fade in when a relationship appears and fade out when it ends.
 *   Play / Pause / Reset and a 60-day slider control time; a summary panel
 *   reports the active companies, active links, and total value each day.
 * Data: ../data/lab7_assignment_companies.csv
 *       ../data/lab7_assignment_transactions_60days.csv
 */

const width = 900;
const height = 560;

// Undirected key for a pair of companies, independent of order.
const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

Promise.all([
    d3.csv("../data/lab7_assignment_companies.csv", d => ({
        id: d.id,
        company_name: d.company_name,
        sector: d.sector,
        region: d.region
    })),
    d3.csv("../data/lab7_assignment_transactions_60days.csv", d => ({
        date: d3.timeParse("%Y-%m-%d")(d.date),
        day: +d.day,
        source: d.source,
        target: d.target,
        amount_usd: +d.amount_usd,
        transaction_type: d.transaction_type,
        transaction_count: +d.transaction_count
    }))
]).then(([companies, transactions]) => {

    const sectors = Array.from(new Set(companies.map(d => d.sector)));
    const regions = Array.from(new Set(companies.map(d => d.region)));
    const types = Array.from(new Set(transactions.map(d => d.transaction_type)));

    // Group the raw transactions by day (1..60) and remember each day's date.
    const byDay = d3.group(transactions, d => d.day);
    const dayDate = new Map(transactions.map(d => [d.day, d.date]));
    const days = d3.range(1, 61);

    // Largest single-day volume for any company, used to fix the size scale so
    // node sizes stay comparable across the whole animation.
    let maxVolume = 0;
    days.forEach(day => {
        const vol = new Map();
        (byDay.get(day) || []).forEach(r => {
            vol.set(r.source, (vol.get(r.source) || 0) + r.amount_usd);
            vol.set(r.target, (vol.get(r.target) || 0) + r.amount_usd);
        });
        vol.forEach(v => { if (v > maxVolume) maxVolume = v; });
    });

    // --- Encodings -------------------------------------------------------
    const sectorColor = d3.scaleOrdinal().domain(sectors).range(d3.schemeTableau10);
    const regionStroke = d3.scaleOrdinal().domain(regions).range(d3.schemeDark2);
    const typeColor = d3.scaleOrdinal().domain(types).range(d3.schemeSet2);

    // Region -> horizontal anchor. Each region gets its own vertical band, so
    // companies from the same region stay grouped and the layout keeps its
    // shape from day to day (a group-based force that preserves the mental map).
    const regionOrder = regions.slice().sort(d3.ascending);
    const regionX = d3.scaleOrdinal()
        .domain(regionOrder)
        .range(regionOrder.map((r, i) =>
            Math.round(width * (i + 1) / (regionOrder.length + 1))));

    // Volume -> area (sqrt keeps area proportional to value). Idle companies
    // still get a small dot so the 12 nodes stay in place (mental map).
    const sizeScale = d3.scaleSqrt().domain([0, maxVolume]).range([6, 30]);

    const widthScale = d3.scaleLinear()
        .domain(d3.extent(transactions, d => d.amount_usd))
        .range([1.5, 7]);

    // --- Canvas ----------------------------------------------------------
    const svg = d3.select("#chart")
        .append("svg")
        .attr("class", "network-svg")
        .attr("width", width)
        .attr("height", height);

    // Faint region-band labels behind the graph, one per region anchor.
    const bandG = svg.append("g").attr("class", "region-bands");
    regionOrder.forEach(r => {
        bandG.append("text")
            .attr("class", "region-band")
            .attr("x", regionX(r))
            .attr("y", 24)
            .attr("text-anchor", "middle")
            .text(r);
    });

    const linkG = svg.append("g").attr("class", "links");
    const nodeG = svg.append("g").attr("class", "nodes");
    const labelG = svg.append("g").attr("class", "node-labels");

    // Prominent current-day label on the chart canvas.
    const dayCanvasLabel = svg.append("text")
        .attr("class", "day-canvas-label")
        .attr("x", width - 16)
        .attr("y", height - 18)
        .attr("text-anchor", "end");

    const tooltip = d3.select("#tooltip");

    // --- Nodes: created once so their objects (and positions) persist -----
    const node = nodeG.selectAll("circle")
        .data(companies, d => d.id)
        .join("circle")
        .attr("class", "node")
        .attr("r", sizeScale(0))
        .attr("fill", d => sectorColor(d.sector))
        .attr("stroke", d => regionStroke(d.region))
        .attr("stroke-width", 1.5);

    const label = labelG.selectAll("text")
        .data(companies, d => d.id)
        .join("text")
        .attr("class", "node-label")
        .text(d => d.id.toUpperCase());

    // --- Force layout: one simulation reused for every day ---------------
    // Seed each node near its region band so the graph opens already grouped.
    companies.forEach(d => {
        d.x = regionX(d.region) + (Math.random() - 0.5) * 60;
        d.y = height / 2 + (Math.random() - 0.5) * 200;
    });

    const simulation = d3.forceSimulation(companies)
        .force("link", d3.forceLink([]).id(d => d.id).distance(95).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-320))
        .force("x", d3.forceX(d => regionX(d.region)).strength(0.18))
        .force("y", d3.forceY(height / 2).strength(0.06))
        .force("collision", d3.forceCollide().radius(d => currentRadius(d) + 6));

    simulation.on("tick", () => {
        companies.forEach(d => {
            const r = currentRadius(d) + 12;
            d.x = Math.max(r, Math.min(width - r, d.x));
            d.y = Math.max(r, Math.min(height - r, d.y));
        });

        linkG.selectAll("line")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("cx", d => d.x).attr("cy", d => d.y);
        label.attr("x", d => d.x).attr("y", d => d.y - currentRadius(d) - 4);
    });

    // Radius currently assigned to a node (0 volume -> smallest dot).
    function currentRadius(d) {
        return sizeScale(d.volume || 0);
    }

    // --- Drag: pin a node while held, release it afterwards --------------
    node.call(d3.drag()
        .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
        }));

    // Adjacency for the current day, used by hover highlighting.
    let currentAdj = new Map(companies.map(d => [d.id, new Set([d.id])]));

    node
        .on("mouseover.hi", (event, d) => {
            const near = currentAdj.get(d.id);
            node.attr("opacity", o => near.has(o.id) ? 1 : 0.15);
            label.attr("opacity", o => near.has(o.id) ? 1 : 0.15);
            linkG.selectAll("line").attr("stroke-opacity", l =>
                (l.source.id === d.id || l.target.id === d.id) ? 0.95 : 0.08);
        })
        .on("mouseout.hi", () => {
            node.attr("opacity", 1);
            label.attr("opacity", 1);
            linkG.selectAll("line").attr("stroke-opacity", 0.75);
        });

    node
        .on("mouseover.tip", (event, d) => {
            const deg = (currentAdj.get(d.id).size - 1);
            tooltip.style("opacity", 1).html(`
                <strong>${d.company_name}</strong><br>
                Sector: ${d.sector}<br>
                Region: ${d.region}<br>
                Today's volume: $${Math.round(d.volume || 0).toLocaleString()}<br>
                Today's partners: ${deg}
            `);
        })
        .on("mousemove.tip", event => {
            tooltip.style("left", `${event.pageX + 12}px`)
                   .style("top", `${event.pageY + 12}px`);
        })
        .on("mouseout.tip", () => tooltip.style("opacity", 0));

    // --- Per-day update --------------------------------------------------
    // animate = true during Play (fade links in/out); false during scrubbing
    // and reset, where each day must appear at once with no leftover fades.
    function updateNetwork(day, animate = true) {

        const raw = byDay.get(day) || [];

        // Fresh link objects each frame (forceLink rewrites source/target to
        // node references; keeping them fresh avoids stale bindings on replay).
        const links = raw.map(r => ({
            source: r.source,
            target: r.target,
            amount_usd: r.amount_usd,
            transaction_type: r.transaction_type,
            transaction_count: r.transaction_count,
            key: pairKey(r.source, r.target)
        }));

        // Current transaction volume per company.
        const volume = new Map(companies.map(d => [d.id, 0]));
        raw.forEach(r => {
            volume.set(r.source, volume.get(r.source) + r.amount_usd);
            volume.set(r.target, volume.get(r.target) + r.amount_usd);
        });
        companies.forEach(d => { d.volume = volume.get(d.id); });

        // Adjacency for hover highlighting.
        currentAdj = new Map(companies.map(d => [d.id, new Set([d.id])]));
        raw.forEach(r => {
            currentAdj.get(r.source).add(r.target);
            currentAdj.get(r.target).add(r.source);
        });

        // Node size + active outline (thicker when trading today).
        node.interrupt();
        (animate ? node.transition().duration(300) : node)
            .attr("r", d => currentRadius(d))
            .attr("stroke-width", d => (d.volume > 0 ? 3.5 : 1.5));

        // Links: join by unordered pair so relationships fade in and out.
        // The named "fade" transition and the explicit opacity on update keep
        // links visible even when the slider is dragged quickly through days.
        linkG.selectAll("line")
            .data(links, d => d.key)
            .join(
                enter => {
                    const line = enter.append("line")
                        .attr("class", "link")
                        .attr("stroke-opacity", animate ? 0 : 0.75)
                        .on("mouseover", (event, d) => {
                            const s = d.source.id || d.source;
                            const t = d.target.id || d.target;
                            tooltip.style("opacity", 1).html(`
                                <strong>${String(s).toUpperCase()} &harr; ${String(t).toUpperCase()}</strong><br>
                                Type: ${d.transaction_type}<br>
                                Amount: $${Math.round(d.amount_usd).toLocaleString()}<br>
                                Transactions: ${d.transaction_count}
                            `);
                        })
                        .on("mousemove", event => {
                            tooltip.style("left", `${event.pageX + 12}px`)
                                   .style("top", `${event.pageY + 12}px`);
                        })
                        .on("mouseout", () => tooltip.style("opacity", 0));
                    if (animate) {
                        // New relationship: flash to full opacity briefly, then
                        // settle to the steady 0.75 so it clearly stands out.
                        line.transition("fade").duration(220).attr("stroke-opacity", 1)
                            .transition().duration(420).attr("stroke-opacity", 0.75);
                    }
                    return line;
                },
                update => update.interrupt("fade").attr("stroke-opacity", 0.75),
                exit => {
                    exit.interrupt("fade");
                    if (animate) {
                        exit.transition("fade").duration(400)
                            .attr("stroke-opacity", 0).remove();
                    } else {
                        exit.remove();
                    }
                    return exit;
                }
            )
            .attr("stroke", d => typeColor(d.transaction_type))
            .attr("stroke-width", d => widthScale(d.amount_usd));

        // Feed the day's links to the layout and reheat gently (mental map).
        simulation.force("link").links(links);
        simulation.alpha(animate ? 0.3 : 0.15).restart();

        // Summary + day label.
        const totalValue = d3.sum(raw, d => d.amount_usd);
        const activeCompanies = new Set(raw.flatMap(d => [d.source, d.target])).size;

        d3.select("#active-companies").text(activeCompanies);
        d3.select("#active-links").text(links.length);
        d3.select("#total-value").text(`$${Math.round(totalValue).toLocaleString()}`);

        const date = dayDate.get(day);
        const dateText = d3.timeFormat("%Y-%m-%d")(date);
        d3.select("#day-label").text(`Day ${day} of 60  \u00b7  ${dateText}`);
        dayCanvasLabel.text(`Day ${day}  \u00b7  ${dateText}`);

        d3.select("#time-slider").property("value", day);
    }

    // --- Controls: Play / Pause / Reset / scrub --------------------------
    let currentDay = 1;
    let timer = null;
    let stepDelay = 450; // ms per day; changed by the speed selector

    function play() {
        if (timer) return;
        if (currentDay >= 60) currentDay = 1;
        timer = d3.interval(() => {
            updateNetwork(currentDay, true);
            if (currentDay >= 60) { pause(); return; }
            currentDay += 1;
        }, stepDelay);
    }

    function pause() {
        if (timer) { timer.stop(); timer = null; }
    }

    function reset() {
        pause();
        currentDay = 1;
        updateNetwork(1, false);
    }

    // Speed selector: change the per-day delay, restarting mid-play if needed.
    d3.select("#speed").on("change", function () {
        stepDelay = +this.value;
        if (timer) { pause(); play(); }
    });

    d3.select("#play").on("click", play);
    d3.select("#pause").on("click", pause);
    d3.select("#reset").on("click", reset);

    d3.select("#time-slider").on("input", function () {
        pause();
        currentDay = +this.value;
        updateNetwork(currentDay, false);
    });

    buildLegend(sectors, sectorColor, regions, regionStroke, types, typeColor);

    // Show the first day to start.
    updateNetwork(1, false);
});

// Legend: one block per encoded channel.
function buildLegend(sectors, sectorColor, regions, regionStroke, types, typeColor) {
    const legend = d3.select("#legend");
    legend.selectAll("*").remove();

    const sectorBlock = legend.append("div").attr("class", "legend-block");
    sectorBlock.append("div").attr("class", "legend-title").text("Sector (fill)");
    sectors.forEach(s => {
        const row = sectorBlock.append("div").attr("class", "legend-row");
        row.append("svg").attr("width", 18).attr("height", 18)
            .append("circle").attr("cx", 9).attr("cy", 9).attr("r", 7)
            .attr("fill", sectorColor(s));
        row.append("span").text(s);
    });

    const regionBlock = legend.append("div").attr("class", "legend-block");
    regionBlock.append("div").attr("class", "legend-title").text("Region (outline)");
    regions.forEach(r => {
        const row = regionBlock.append("div").attr("class", "legend-row");
        row.append("svg").attr("width", 18).attr("height", 18)
            .append("circle").attr("cx", 9).attr("cy", 9).attr("r", 6)
            .attr("fill", "#fff")
            .attr("stroke", regionStroke(r)).attr("stroke-width", 3);
        row.append("span").text(r);
    });

    const typeBlock = legend.append("div").attr("class", "legend-block");
    typeBlock.append("div").attr("class", "legend-title").text("Transaction type (link)");
    types.forEach(t => {
        const row = typeBlock.append("div").attr("class", "legend-row");
        row.append("svg").attr("width", 26).attr("height", 18)
            .append("line").attr("x1", 1).attr("y1", 9).attr("x2", 25).attr("y2", 9)
            .attr("stroke", typeColor(t)).attr("stroke-width", 3);
        row.append("span").text(t);
    });

    const sizeBlock = legend.append("div").attr("class", "legend-block");
    sizeBlock.append("div").attr("class", "legend-title").text("Node size");
    const sizeRow = sizeBlock.append("div").attr("class", "legend-row");
    sizeRow.append("svg").attr("width", 44).attr("height", 30)
        .call(s => {
            s.append("circle").attr("cx", 10).attr("cy", 20).attr("r", 5)
                .attr("fill", "#bbb");
            s.append("circle").attr("cx", 30).attr("cy", 16).attr("r", 11)
                .attr("fill", "#bbb");
        });
    sizeRow.append("span").text("Current transaction volume");

    const activeBlock = legend.append("div").attr("class", "legend-block");
    activeBlock.append("div").attr("class", "legend-title").text("Outline weight");
    const activeRow = activeBlock.append("div").attr("class", "legend-row");
    activeRow.append("svg").attr("width", 18).attr("height", 18)
        .append("circle").attr("cx", 9).attr("cy", 9).attr("r", 6)
        .attr("fill", "#fff").attr("stroke", "#555").attr("stroke-width", 3.5);
    activeRow.append("span").text("Trading today");
}
