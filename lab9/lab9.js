// Lab 9 - Geospatial Visualization: 2025 GDP choropleth and cartogram.

const width = 960;
const height = 500;
const legendWidth = 320;
const legendBarHeight = 12;

Promise.all([
    d3.json("../data/world.geojson"),
    d3.csv("../data/lab9_gdp_2025_top50.csv", d => ({
        iso3: d.iso3,
        country: d.country,
        gdp: +d.gdp_2025_billion_usd,
        rank: +d.rank
    }))
]).then(([geo, gdp]) => {

    const features = geo.features;
    const land = features.filter(f =>
        f.properties.name !== "Antarctica" && f.properties.iso3 !== "ATA");

    // Part A: join GDP onto features by ISO-3.
    const gdpByIso3 = new Map(gdp.map(d => [d.iso3, d]));
    features.forEach(f => {
        const rec = gdpByIso3.get(f.properties.iso3);
        f.properties.gdp = rec ? rec.gdp : null;
        f.properties.rank = rec ? rec.rank : null;
    });

    const projection = d3.geoNaturalEarth1()
        .fitSize([width, height], { type: "FeatureCollection", features: land });
    const path = d3.geoPath().projection(projection);

    const gdpMin = d3.min(gdp, d => d.gdp);
    const gdpMax = d3.max(gdp, d => d.gdp);

    // Shared tooltip.
    const tooltip = d3.select("#tooltip");
    function moveTip(event) {
        tooltip.style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY + 12) + "px");
    }
    function gdpTipHtml(name, iso3, g, rank) {
        return g != null
            ? `<strong>${name}</strong> (${iso3})<br>2025 GDP: ` +
              `${d3.format(",.0f")(g)} B USD<br>Rank ${rank} of 50`
            : `<strong>${name}</strong>` + (iso3 ? " (" + iso3 + ")" : "") +
              "<br>No GDP in the top-50 dataset";
    }

    // Dataset section: ten largest economies.
    const topTable = d3.select("#gdp-top").append("table").attr("class", "data-table");
    topTable.append("thead").append("tr").selectAll("th")
        .data(["rank", "iso3", "country", "GDP (B USD)"]).join("th").text(d => d);
    topTable.append("tbody").selectAll("tr").data(gdp.slice(0, 10)).join("tr")
        .selectAll("td")
        .data(d => [d.rank, d.iso3, d.country, d3.format(",.0f")(d.gdp)])
        .join("td").text(d => d);

    // ---- Part B: choropleth ----
    function colorScaleFor(type) {
        if (type === "linear") return d3.scaleSequential(d3.interpolateBlues).domain([0, gdpMax]);
        if (type === "sqrt") return d3.scaleSequentialSqrt(d3.interpolateBlues).domain([0, gdpMax]);
        return d3.scaleSequentialLog(d3.interpolateBlues).domain([gdpMin, gdpMax]);
    }
    function positionScaleFor(type) {
        if (type === "linear") return d3.scaleLinear().domain([0, gdpMax]).range([0, legendWidth]);
        if (type === "sqrt") return d3.scaleSqrt().domain([0, gdpMax]).range([0, legendWidth]);
        return d3.scaleLog().domain([gdpMin, gdpMax]).range([0, legendWidth]);
    }

    const choroSvg = d3.select("#choropleth-map").append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`).attr("class", "map-svg");
    const choroGroup = choroSvg.append("g");
    const choroPaths = choroGroup.selectAll("path.country").data(land).join("path")
        .attr("class", "country").attr("d", path)
        .attr("stroke", "white").attr("stroke-width", 0.4)
        .attr("vector-effect", "non-scaling-stroke");

    choroPaths
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            const p = d.properties;
            tooltip.style("opacity", 1).html(gdpTipHtml(p.name, p.iso3, p.gdp, p.rank));
            moveTip(event);
            paint(p.iso3);
        })
        .on("mousemove", moveTip)
        .on("mouseout", () => { tooltip.style("opacity", 0); paint(null); });

    function drawChoropleth(type) {
        const scale = colorScaleFor(type);
        choroPaths.attr("fill", d => d.properties.gdp != null ? scale(d.properties.gdp) : "#eee");
    }

    function drawLegend(type) {
        const color = colorScaleFor(type);
        const pos = positionScaleFor(type);
        const host = d3.select("#choro-legend");
        host.selectAll("*").remove();

        const svg = host.append("svg").attr("width", legendWidth + 24).attr("height", 52);
        const g = svg.append("g").attr("transform", "translate(8,12)");

        const grad = svg.append("defs").append("linearGradient").attr("id", "legend-grad");
        const steps = 24;
        d3.range(steps + 1).forEach(i => {
            const x = (i / steps) * legendWidth;
            grad.append("stop").attr("offset", (i / steps * 100) + "%")
                .attr("stop-color", color(pos.invert(x)));
        });

        g.append("text").attr("x", 0).attr("y", -2)
            .attr("font-size", "11px").attr("fill", "#555")
            .text("2025 GDP (billions USD), " + type + " scale");
        g.append("rect").attr("width", legendWidth).attr("height", legendBarHeight)
            .style("fill", "url(#legend-grad)").attr("stroke", "#bbb").attr("stroke-width", 0.5);

        const ticks = type === "log"
            ? [300, 1000, 3000, 10000, 30000].filter(v => v >= gdpMin && v <= gdpMax)
            : pos.ticks(5);
        const axis = g.append("g").attr("transform", "translate(0," + legendBarHeight + ")");
        axis.selectAll("line").data(ticks).join("line")
            .attr("x1", d => pos(d)).attr("x2", d => pos(d))
            .attr("y1", 0).attr("y2", 4).attr("stroke", "#666");
        axis.selectAll("text").data(ticks).join("text")
            .attr("x", d => pos(d)).attr("y", 16).attr("text-anchor", "middle")
            .attr("font-size", "10px").attr("fill", "#333").text(d => d3.format("~s")(d));
    }

    function updateChoropleth(type) { drawChoropleth(type); drawLegend(type); }
    updateChoropleth("log");
    d3.select("#scale-type").on("change", function () { updateChoropleth(this.value); });

    // Zoom and pan. d3.zoom owns pointer gestures on the SVG, which suppresses a
    // separate click event on the countries. So detect a click here: if a mouse
    // gesture ends without meaningful movement, treat it as a click on the
    // country under the pointer and toggle its selection. Real pans (movement
    // beyond a few pixels) and wheel zoom are excluded.
    let gestureStart = null;
    let gestureMoved = false;
    const zoom = d3.zoom().scaleExtent([1, 8])
        .on("start", (event) => {
            const s = event.sourceEvent;
            gestureStart = s ? [s.clientX, s.clientY] : null;
            gestureMoved = false;
        })
        .on("zoom", (event) => {
            choroGroup.attr("transform", event.transform);
            const s = event.sourceEvent;
            if (s && gestureStart) {
                const dx = s.clientX - gestureStart[0];
                const dy = s.clientY - gestureStart[1];
                if (dx * dx + dy * dy > 25) gestureMoved = true;
            }
        })
        .on("end", (event) => {
            const s = event.sourceEvent;
            if (gestureMoved || !s) return;
            if (s.type !== "mouseup" && s.type !== "pointerup" && s.type !== "touchend") return;
            const datum = d3.select(s.target).datum();
            if (datum && datum.properties && datum.properties.iso3) {
                toggleSelect(datum.properties.iso3);
            }
        });
    choroSvg.call(zoom).on("dblclick.zoom", null);
    d3.select("#reset-zoom").on("click", () =>
        choroSvg.transition().duration(400).call(zoom.transform, d3.zoomIdentity));

    // ---- Part C: cartogram (Dorling - circle area encodes GDP) ----
    // One circle per country: keep the largest feature so it sits on the main landmass.
    const featureByCountry = new Map();
    land.filter(f => f.properties.gdp != null).forEach(f => {
        const cur = featureByCountry.get(f.properties.iso3);
        if (!cur || d3.geoArea(f) > d3.geoArea(cur)) featureByCountry.set(f.properties.iso3, f);
    });
    const cartoNodes = Array.from(featureByCountry.values()).map(f => {
        const [cx, cy] = projection(d3.geoCentroid(f));
        return {
            iso3: f.properties.iso3, name: f.properties.name,
            gdp: f.properties.gdp, rank: f.properties.rank,
            x: cx, y: cy, x0: cx, y0: cy
        };
    });
    const rScale = d3.scaleSqrt().domain([0, gdpMax]).range([0, 58]);
    cartoNodes.forEach(n => { n.r = rScale(n.gdp); });

    const sim = d3.forceSimulation(cartoNodes)
        .force("x", d3.forceX(d => d.x0).strength(0.2))
        .force("y", d3.forceY(d => d.y0).strength(0.2))
        .force("collide", d3.forceCollide(d => d.r + 1).strength(0.9))
        .stop();
    for (let i = 0; i < 300; i++) sim.tick();
    cartoNodes.forEach(n => {
        n.x = Math.max(n.r, Math.min(width - n.r, n.x));
        n.y = Math.max(n.r, Math.min(height - n.r, n.y));
    });

    const cartoSvg = d3.select("#cartogram-map").append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`).attr("class", "map-svg");
    const cartoCircleGroup = cartoSvg.append("g");
    const cartoLabelGroup = cartoSvg.append("g");
    const cartoCircles = cartoCircleGroup.selectAll("circle").data(cartoNodes).join("circle")
        .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => d.r)
        .attr("fill", "#4c78a8").attr("fill-opacity", 0.85)
        .attr("stroke", "white").attr("stroke-width", 0.6);

    cartoLabelGroup.selectAll("text.carto-label")
        .data(cartoNodes.filter(d => d.r >= 16)).join("text")
        .attr("class", "carto-label").attr("x", d => d.x).attr("y", d => d.y)
        .attr("text-anchor", "middle").attr("dy", "0.32em")
        .attr("font-size", d => Math.min(d.r * 0.7, 13) + "px")
        .attr("fill", "white").attr("pointer-events", "none").text(d => d.iso3);

    cartoCircles
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1).html(gdpTipHtml(d.name, d.iso3, d.gdp, d.rank));
            moveTip(event);
            paint(d.iso3);
        })
        .on("mousemove", moveTip)
        .on("mouseout", () => { tooltip.style("opacity", 0); paint(null); })
        .on("click", (event, d) => toggleSelect(d.iso3));

    // ---- Part D: linked highlighting, hover preview + sticky click selection ----
    // A country can be hovered (transient) and/or selected (pinned by click).
    // Selected outlines are stronger than hover outlines and survive mouseout.
    let selectedIso3 = null;

    function stateFor(iso3, hovered) {
        if (iso3 && iso3 === selectedIso3) return { stroke: "#f58518", choro: 2.5, circle: 3 };
        if (iso3 && iso3 === hovered) return { stroke: "#333", choro: 1.2, circle: 1.5 };
        return { stroke: "white", choro: 0.4, circle: 0.6 };
    }

    function paint(hovered) {
        choroPaths
            .attr("stroke", d => stateFor(d.properties.iso3, hovered).stroke)
            .attr("stroke-width", d => stateFor(d.properties.iso3, hovered).choro);
        cartoCircles
            .attr("stroke", d => stateFor(d.iso3, hovered).stroke)
            .attr("stroke-width", d => stateFor(d.iso3, hovered).circle);
        // Keep the pinned and previewed shapes on top so their outline is visible.
        [selectedIso3, hovered].forEach(code => {
            if (!code) return;
            choroPaths.filter(d => d.properties.iso3 === code).raise();
            cartoCircles.filter(d => d.iso3 === code).raise();
        });
    }

    function toggleSelect(iso3) {
        selectedIso3 = (selectedIso3 === iso3) ? null : iso3;
        paint(iso3);
    }
});
