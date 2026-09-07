/*
 * Lab 5 - Urban transit network shown two ways.
 *   1. Force-directed map of 50 stations and 50 routes, with all five variables
 *      encoded at once:
 *        district     -> node colour
 *        passengers   -> node size (area)
 *        station type -> node shape
 *        travel time  -> link colour (Viridis) and width
 *        route type   -> link dash pattern
 *      Supports dragging, hover highlighting, and tooltips. Stations with no
 *      routes are parked in a labelled strip on the right.
 *   2. Adjacency matrix of the same network. Rows and columns can be grouped by
 *      district or by station type (toggle). Cell colour is the route type and
 *      the cell shade is the travel time.
 * Data feeds: ../data/lab5_assignment_stations.csv ,
 *             ../data/lab5_assignment_routes.csv
 */

// Layout constants. A right-hand gutter is reserved for the unconnected
// stations, so the graph itself is centred in drawW rather than the full width.
const width = 980;
const height = 680;
const gutter = 100;
const drawW = width - gutter;
const cx = drawW / 2;

// Station type maps to a marker shape; route type maps to a dash pattern.
const shapeByType = {
    Local: d3.symbolCircle,
    Transfer: d3.symbolSquare,
    Terminal: d3.symbolTriangle
};

const dashByType = {
    Metro: null,
    Express: "7,4",
    Shuttle: "2,4"
};

// Load both tables first, then build the visualization once they have arrived.
// Numeric columns are converted from strings as the rows are parsed.
Promise.all([
    d3.csv("../data/lab5_assignment_stations.csv", d => ({
        id: d.id,
        station_name: d.station_name,
        district: d.district,
        daily_passengers: +d.daily_passengers,
        station_type: d.station_type
    })),
    d3.csv("../data/lab5_assignment_routes.csv", d => ({
        source: d.source,
        target: d.target,
        travel_time_min: +d.travel_time_min,
        route_type: d.route_type
    }))
]).then(([stations, routes]) => {

    const districts = Array.from(new Set(stations.map(d => d.district)));
    const routeTypes = Array.from(new Set(routes.map(d => d.route_type)));

    // District colour (categorical).
    const districtColor = d3.scaleOrdinal()
        .domain(districts)
        .range(d3.schemeTableau10);

    // Passengers -> circle area. The range is in area units so d3.symbol().size()
    // can use it directly, which keeps size honest (area, not radius, scales).
    const areaScale = d3.scaleLinear()
        .domain(d3.extent(stations, d => d.daily_passengers))
        .range([120, 640]);

    // Travel time -> colour. The domain is reversed so long trips are dark and
    // short trips are bright.
    const travelColor = d3.scaleSequential(d3.interpolateViridis)
        .domain(d3.extent(routes, d => d.travel_time_min).reverse());

    // Travel time -> width as well, so long trips are also thick. Colour and
    // width reinforce each other and make the slow links stand out.
    const travelWidth = d3.scaleLinear()
        .domain(d3.extent(routes, d => d.travel_time_min))
        .range([1.5, 6.5]);

    // One symbol generator: shape from station type, size from passengers.
    const symbol = d3.symbol()
        .type(d => shapeByType[d.station_type])
        .size(d => areaScale(d.daily_passengers));

    // Approximate pixel radius of a symbol, reused for collision and for keeping
    // nodes inside the frame.
    const radiusOf = d => Math.sqrt(areaScale(d.daily_passengers) / Math.PI);

    const svg = d3.select("#chart")
        .append("svg")
        .attr("class", "network-svg")
        .attr("width", width)
        .attr("height", height);

    // Routes are drawn before the stations so the symbols sit on top of the lines.
    const link = svg.append("g")
        .selectAll("line")
        .data(routes)
        .join("line")
        .attr("stroke", d => travelColor(d.travel_time_min))
        .attr("stroke-width", d => travelWidth(d.travel_time_min))
        .attr("stroke-opacity", 0.85)
        .attr("stroke-dasharray", d => dashByType[d.route_type]);

    // One path per station: shape encodes type, fill encodes district.
    const node = svg.append("g")
        .selectAll("path")
        .data(stations)
        .join("path")
        .attr("d", symbol)
        .attr("fill", d => districtColor(d.district))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

    // Station number label, sitting just above each node.
    const label = svg.append("g")
        .selectAll("text")
        .data(stations)
        .join("text")
        .attr("class", "station-label")
        .text(d => d.id.slice(1));

    // Force layout. The extra x/y forces gently pull the network toward the
    // centre of the drawing area so it does not drift to one side.
    const simulation = d3.forceSimulation(stations)
        .force("link", d3.forceLink(routes).id(d => d.id).distance(75))
        .force("charge", d3.forceManyBody().strength(-220))
        .force("center", d3.forceCenter(cx, height / 2))
        .force("x", d3.forceX(cx).strength(0.06))
        .force("y", d3.forceY(height / 2).strength(0.06))
        .force("collision", d3.forceCollide().radius(d => radiusOf(d) + 5));

    simulation.on("tick", () => {
        // Clamp every node inside the frame. Parked (unconnected) stations may
        // use the reserved gutter; the rest stay within the drawing area.
        stations.forEach(d => {
            const ext = radiusOf(d) * 1.6;
            const maxX = d.parked ? width - ext - 6 : drawW - ext - 6;
            d.x = Math.max(ext + 6, Math.min(maxX, d.x));
            d.y = Math.max(ext + 16, Math.min(height - ext - 6, d.y));
        });

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);

        label
            .attr("x", d => d.x)
            .attr("y", d => d.y - radiusOf(d) - 4);
    });

    // Count the routes touching each station so we can find the unconnected ones.
    const degree = new Map(stations.map(d => [d.id, 0]));
    routes.forEach(r => {
        const s = r.source.id ?? r.source;
        const t = r.target.id ?? r.target;
        degree.set(s, degree.get(s) + 1);
        degree.set(t, degree.get(t) + 1);
    });

    // Pin the degree-0 stations in a tidy column in the gutter instead of letting
    // them drift into the corners.
    const parkX = drawW + gutter / 2;
    let parkY = 96;
    stations.forEach(d => {
        if (degree.get(d.id) === 0) {
            d.parked = true;
            d.fx = parkX;
            d.fy = parkY;
            parkY += 68;
        }
    });

    // Divider line and heading for the parked column.
    svg.append("line")
        .attr("x1", drawW + 10).attr("y1", 60)
        .attr("x2", drawW + 10).attr("y2", parkY - 34)
        .attr("stroke", "#e2e6ea").attr("stroke-width", 1);

    svg.append("text")
        .attr("x", parkX).attr("y", 54)
        .attr("text-anchor", "middle")
        .attr("class", "park-label")
        .text("Unconnected");

    // Dragging: pin a node under the cursor (fx/fy), then release it back to the
    // simulation when the drag ends.
    node.call(d3.drag()
        .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
        .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
        })
        .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }));

    // Adjacency lookup (each station maps to itself plus its neighbours) used for
    // hover highlighting.
    const neighbours = new Map(stations.map(d => [d.id, new Set([d.id])]));
    routes.forEach(r => {
        neighbours.get(r.source.id).add(r.target.id);
        neighbours.get(r.target.id).add(r.source.id);
    });

    // Hovering a station fades everything except it, its neighbours, and their links.
    node.on("mouseover", (event, d) => {
        const near = neighbours.get(d.id);
        node.attr("opacity", o => near.has(o.id) ? 1 : 0.12);
        label.attr("opacity", o => near.has(o.id) ? 1 : 0.12);
        link.attr("stroke-opacity", l =>
            (l.source.id === d.id || l.target.id === d.id) ? 0.95 : 0.06);
    });

    node.on("mouseout", () => {
        node.attr("opacity", 1);
        label.attr("opacity", 1);
        link.attr("stroke-opacity", 0.85);
    });

    // Shared tooltip element, also reused by the matrix.
    const tooltip = d3.select("#tooltip");

    // Station tooltip. The events are namespaced (.tip) so they run alongside the
    // highlight handlers above instead of replacing them.
    node
        .on("mouseover.tip", (event, d) => {
            tooltip.style("opacity", 1).html(`
                <strong>${d.station_name}</strong><br>
                District: ${d.district}<br>
                Type: ${d.station_type}<br>
                Daily passengers: ${d.daily_passengers.toLocaleString()}
            `);
        })
        .on("mousemove.tip", event => {
            tooltip
                .style("left", `${event.pageX + 12}px`)
                .style("top", `${event.pageY + 12}px`);
        })
        .on("mouseout.tip", () => tooltip.style("opacity", 0));

    // Route tooltip: the two endpoints, the route type, and the travel time.
    link
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1).html(`
                <strong>${d.source.id.toUpperCase()} ↔ ${d.target.id.toUpperCase()}</strong><br>
                Route: ${d.route_type}<br>
                Travel time: ${d.travel_time_min} min
            `);
        })
        .on("mousemove", event => {
            tooltip
                .style("left", `${event.pageX + 12}px`)
                .style("top", `${event.pageY + 12}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // Draw the legend and the adjacency matrix.
    buildLegend(districts, districtColor, routeTypes, travelColor);
    drawMatrix(stations, routes, districtColor, tooltip);
});

// Builds the map legend, one block per encoded variable. The travel-time block
// draws a single tapered Viridis wedge, so it shows the colour and the width
// cue together.
function buildLegend(districts, districtColor, routeTypes, travelColor) {
    const legend = d3.select("#legend");

    const districtBlock = legend.append("div").attr("class", "legend-block");
    districtBlock.append("div").attr("class", "legend-title").text("District");
    districts.forEach(name => {
        const row = districtBlock.append("div").attr("class", "legend-row");
        row.append("svg").attr("width", 18).attr("height", 18)
            .append("circle").attr("cx", 9).attr("cy", 9).attr("r", 7)
            .attr("fill", districtColor(name));
        row.append("span").text(name);
    });

    const typeBlock = legend.append("div").attr("class", "legend-block");
    typeBlock.append("div").attr("class", "legend-title").text("Station type");
    const shapes = [
        ["Local", d3.symbolCircle],
        ["Transfer", d3.symbolSquare],
        ["Terminal", d3.symbolTriangle]
    ];
    shapes.forEach(([name, type]) => {
        const row = typeBlock.append("div").attr("class", "legend-row");
        row.append("svg").attr("width", 18).attr("height", 18)
            .append("path")
            .attr("transform", "translate(9,9)")
            .attr("d", d3.symbol().type(type).size(90)())
            .attr("fill", "#555");
        row.append("span").text(name);
    });

    const routeBlock = legend.append("div").attr("class", "legend-block");
    routeBlock.append("div").attr("class", "legend-title").text("Route type");
    const dashes = [["Metro", null], ["Express", "7,4"], ["Shuttle", "2,4"]];
    dashes.forEach(([name, dash]) => {
        const row = routeBlock.append("div").attr("class", "legend-row");
        row.append("svg").attr("width", 26).attr("height", 18)
            .append("line").attr("x1", 1).attr("y1", 9).attr("x2", 25).attr("y2", 9)
            .attr("stroke", "#555").attr("stroke-width", 2.5)
            .attr("stroke-dasharray", dash);
        row.append("span").text(name);
    });

    const timeBlock = legend.append("div").attr("class", "legend-block");
    timeBlock.append("div").attr("class", "legend-title").text("Travel time (min)");
    const [tMin, tMax] = travelColor.domain();
    const gradId = "viridis-grad";
    const wSvg = timeBlock.append("svg").attr("width", 150).attr("height", 34);
    const defs = wSvg.append("defs");
    const grad = defs.append("linearGradient").attr("id", gradId);
    d3.range(0, 1.01, 0.1).forEach(t => {
        grad.append("stop")
            .attr("offset", `${t * 100}%`)
            .attr("stop-color", d3.interpolateViridis(t));
    });
    wSvg.append("polygon")
        .attr("points", "0,2 150,7 150,13 0,18")
        .attr("fill", `url(#${gradId})`);
    wSvg.append("text").attr("x", 0).attr("y", 30)
        .attr("class", "legend-scale").text(tMin);
    wSvg.append("text").attr("x", 150).attr("y", 30)
        .attr("text-anchor", "end").attr("class", "legend-scale").text(tMax);
    timeBlock.append("div").attr("class", "legend-note")
        .text("darker + thicker = slower");

    const sizeBlock = legend.append("div").attr("class", "legend-block");
    sizeBlock.append("div").attr("class", "legend-title").text("Daily passengers");
    const sizeSvg = sizeBlock.append("svg").attr("width", 150).attr("height", 40);
    sizeSvg.append("circle").attr("cx", 16).attr("cy", 22).attr("r", 6)
        .attr("fill", "#bbb");
    sizeSvg.append("circle").attr("cx", 52).attr("cy", 20).attr("r", 13)
        .attr("fill", "#bbb");
    sizeSvg.append("text").attr("x", 78).attr("y", 25)
        .attr("class", "legend-scale").text("fewer → more");
}

// Row/column ordering options offered by the matrix toggle.
const districtOrder = ["Central", "North", "South", "East", "West"];
const stationTypeOrder = ["Local", "Transfer", "Terminal"];

// Route type -> cell colour in the matrix. The map already uses dashes for route
// type, so colour is free to carry it here.
const routeColor = d3.scaleOrdinal()
    .domain(["Metro", "Express", "Shuttle"])
    .range(["#1b9e77", "#d95f02", "#7570b3"]);

const orderings = {
    district: { field: "district", order: districtOrder, label: "District" },
    station_type: { field: "station_type", order: stationTypeOrder, label: "Station type" }
};

// Draws the adjacency matrix and its ordering toggle. The whole grid is redrawn
// by render() whenever the ordering mode changes.
function drawMatrix(stations, routes, districtColor, tooltip) {
    // Look up a route by either ordering of its endpoints (the network is undirected).
    const routeByPair = new Map();
    routes.forEach(r => {
        const s = r.source.id ?? r.source;
        const t = r.target.id ?? r.target;
        routeByPair.set(`${s}|${t}`, r);
        routeByPair.set(`${t}|${s}`, r);
    });

    // Travel time -> cell shade (longer trips are more opaque, i.e. darker).
    const travelOpacity = d3.scaleLinear()
        .domain(d3.extent(routes, d => d.travel_time_min))
        .range([0.35, 1]);

    const cell = 13;
    const gridX = 82;
    const gridY = 82;

    let mode = "district";

    // Toggle buttons. Clicking one changes the grouping and redraws.
    const controls = d3.select("#matrix-controls");
    controls.append("span").attr("class", "control-label").text("Order rows & columns by:");
    Object.keys(orderings).forEach(key => {
        controls.append("button")
            .attr("class", "order-btn")
            .classed("active", key === mode)
            .text(orderings[key].label)
            .on("click", function () {
                mode = key;
                controls.selectAll(".order-btn").classed("active", false);
                d3.select(this).classed("active", true);
                render();
            });
    });

    buildMatrixLegend();
    render();

    function render() {
        // Sort by the active grouping field, then by station number within a group.
        const cfg = orderings[mode];
        const ordered = stations.slice().sort((a, b) =>
            cfg.order.indexOf(a[cfg.field]) - cfg.order.indexOf(b[cfg.field])
            || (+a.id.slice(1)) - (+b.id.slice(1)));

        const n = ordered.length;
        const grid = n * cell;

        d3.select("#matrix").selectAll("*").remove();

        const svg = d3.select("#matrix")
            .append("svg")
            .attr("class", "matrix-svg")
            .attr("width", gridX + grid + 18)
            .attr("height", gridY + grid + 18);

        const g = svg.append("g").attr("transform", `translate(${gridX},${gridY})`);

        g.append("rect")
            .attr("x", 0).attr("y", 0)
            .attr("width", grid).attr("height", grid)
            .attr("fill", "#f6f7f9");

        // One record per connected (row, col) pair. Empty pairs are skipped, so
        // the background rect shows through as an empty cell.
        const cells = [];
        ordered.forEach((rowNode, i) => {
            ordered.forEach((colNode, j) => {
                const r = routeByPair.get(`${rowNode.id}|${colNode.id}`);
                if (r) cells.push({ i, j, rowNode, colNode, route: r });
            });
        });

        g.selectAll("rect.cell")
            .data(cells)
            .join("rect")
            .attr("class", "cell")
            .attr("x", d => d.j * cell)
            .attr("y", d => d.i * cell)
            .attr("width", cell - 1)
            .attr("height", cell - 1)
            .attr("fill", d => routeColor(d.route.route_type))
            .attr("fill-opacity", d => travelOpacity(d.route.travel_time_min))
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", 1).html(`
                    <strong>${d.rowNode.station_name} ↔ ${d.colNode.station_name}</strong><br>
                    Route: ${d.route.route_type}<br>
                    Travel time: ${d.route.travel_time_min} min
                `);
            })
            .on("mousemove", event => {
                tooltip
                    .style("left", `${event.pageX + 12}px`)
                    .style("top", `${event.pageY + 12}px`);
            })
            .on("mouseout", () => tooltip.style("opacity", 0));

        // Thin white grid lines between the cells.
        for (let k = 0; k <= n; k++) {
            g.append("line")
                .attr("x1", 0).attr("y1", k * cell).attr("x2", grid).attr("y2", k * cell)
                .attr("stroke", "#fff").attr("stroke-width", 1);
            g.append("line")
                .attr("x1", k * cell).attr("y1", 0).attr("x2", k * cell).attr("y2", grid)
                .attr("stroke", "#fff").attr("stroke-width", 1);
        }

        // Darker dividers wherever the grouping value changes, marking the blocks.
        const boundaries = [];
        for (let i = 1; i < n; i++) {
            if (ordered[i][cfg.field] !== ordered[i - 1][cfg.field]) boundaries.push(i);
        }
        boundaries.forEach(b => {
            g.append("line")
                .attr("x1", 0).attr("y1", b * cell).attr("x2", grid).attr("y2", b * cell)
                .attr("class", "matrix-divider");
            g.append("line")
                .attr("x1", b * cell).attr("y1", 0).attr("x2", b * cell).attr("y2", grid)
                .attr("class", "matrix-divider");
        });

        // District colour strips along the top and left edges. These always show
        // district, so it stays visible even when the grid is grouped by type.
        g.selectAll("rect.strip-top")
            .data(ordered)
            .join("rect")
            .attr("class", "strip-top")
            .attr("x", (d, i) => i * cell)
            .attr("y", -12)
            .attr("width", cell - 1)
            .attr("height", 8)
            .attr("fill", d => districtColor(d.district));

        g.selectAll("rect.strip-left")
            .data(ordered)
            .join("rect")
            .attr("class", "strip-left")
            .attr("x", -12)
            .attr("y", (d, i) => i * cell)
            .attr("width", 8)
            .attr("height", cell - 1)
            .attr("fill", d => districtColor(d.district));

        g.selectAll("text.matrix-col")
            .data(ordered)
            .join("text")
            .attr("class", "matrix-tick")
            .attr("transform", (d, i) =>
                `translate(${i * cell + cell / 2 - 3},-16) rotate(-90)`)
            .attr("fill", d => districtColor(d.district))
            .text(d => d.id.slice(1));

        g.selectAll("text.matrix-row")
            .data(ordered)
            .join("text")
            .attr("class", "matrix-tick")
            .attr("x", -16)
            .attr("y", (d, i) => i * cell + cell / 2 + 3)
            .attr("text-anchor", "end")
            .attr("fill", d => districtColor(d.district))
            .text(d => d.id.slice(1));

        // One label per group, placed to the left of the first row in that block.
        // Coloured by district only when grouping by district.
        ordered.forEach((d, i) => {
            if (i === 0 || d[cfg.field] !== ordered[i - 1][cfg.field]) {
                const color = mode === "district" ? districtColor(d.district) : "#333";
                svg.append("text")
                    .attr("class", "matrix-district")
                    .attr("transform", `translate(14,${gridY + i * cell + 8})`)
                    .attr("fill", color)
                    .text(d[cfg.field]);
            }
        });
    }
}

// Matrix legend: route-type colours, the travel-time shade ramp, and a note on
// how the ordering works.
function buildMatrixLegend() {
    const legend = d3.select("#matrix-legend");

    const routeBlock = legend.append("div").attr("class", "legend-block");
    routeBlock.append("div").attr("class", "legend-title").text("Route type (cell colour)");
    ["Metro", "Express", "Shuttle"].forEach(name => {
        const row = routeBlock.append("div").attr("class", "legend-row");
        row.append("svg").attr("width", 16).attr("height", 16)
            .append("rect").attr("width", 13).attr("height", 13)
            .attr("fill", routeColor(name));
        row.append("span").text(name);
    });

    const opacityBlock = legend.append("div").attr("class", "legend-block");
    opacityBlock.append("div").attr("class", "legend-title").text("Travel time (cell shade)");
    const oSvg = opacityBlock.append("svg").attr("width", 150).attr("height", 30);
    d3.range(6).forEach(k => {
        oSvg.append("rect")
            .attr("x", k * 24).attr("y", 0)
            .attr("width", 22).attr("height", 13)
            .attr("fill", "#555")
            .attr("fill-opacity", 0.35 + k * (0.65 / 5));
    });
    oSvg.append("text").attr("x", 0).attr("y", 26).attr("class", "legend-scale").text("2 min");
    oSvg.append("text").attr("x", 144).attr("y", 26).attr("text-anchor", "end")
        .attr("class", "legend-scale").text("16 min");

    const districtBlock = legend.append("div").attr("class", "legend-block");
    districtBlock.append("div").attr("class", "legend-title").text("Ordering");
    districtBlock.append("div").attr("class", "legend-note")
        .style("max-width", "220px")
        .text("Rows and columns are grouped by district (coloured strips and labels); dividers separate district blocks.");
}
