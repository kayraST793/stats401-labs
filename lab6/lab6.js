// Lab 6 assignment - two GDP treemaps with different tiling methods.

const statuses = ["Increase", "Unchanged", "Decrease"];

// green up, grey flat, red down
const statusColor = d3.scaleOrdinal()
    .domain(statuses)
    .range(["#2ca25f", "#969696", "#de2d26"]);

const tooltip = d3.select("#tooltip");

const width = 900;
const height = 500;

function buildLegend() {
    const legend = d3.select("#status-legend");

    statuses.forEach(s => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("span")
            .attr("class", "legend-swatch")
            .style("background", statusColor(s));
        item.append("span").text(s);
    });
}

function drawTreemap(data, selector, tile, prefix) {

    // size by GDP, biggest first
    const root = d3.hierarchy(data)
        .sum(d => d.gdp || 0)
        .sort((a, b) => b.value - a.value);

    // reserve a top strip on each continent and area for its name
    const continentHeader = 20;
    const areaHeader = 15;

    d3.treemap()
        .tile(tile)
        .size([width, height])
        .paddingOuter(2)
        .paddingInner(d => {
            if (d.depth === 0) return 8;   // wider white space between continents
            if (d.depth === 1) return 3;   // tiny white space between areas
            if (d.depth === 2) return 2;   // thin tint between countries
            return 0;
        })
        .paddingTop(d => {
            if (d.depth === 1) return continentHeader;
            if (d.depth === 2) return areaHeader;
            return 2;
        })(root);

    const svg = d3.select(selector)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const cellW = d => d.x1 - d.x0;
    const cellH = d => d.y1 - d.y0;

    // precompute a full-canvas layout of each area so a zoom can give even a
    // hidden, zero-height country a real rectangle to grow into
    root.descendants().filter(d => d.depth === 2).forEach(area => {
        const sub = d3.hierarchy(area.data)
            .sum(d => d.gdp || 0)
            .sort((a, b) => b.value - a.value);

        d3.treemap()
            .tile(tile)
            .size([width, height])
            .paddingTop(areaHeader)
            .paddingInner(2)
            .paddingOuter(0)(sub);

        const byName = new Map(sub.leaves().map(l => [l.data.name, l]));
        area.leaves().forEach(orig => {
            const z = byName.get(orig.data.name);
            orig._zoom = { x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1 };
        });
    });

    const zw = d => d._zoom.x1 - d._zoom.x0;
    const zh = d => d._zoom.y1 - d._zoom.y0;

    // area panels sit behind the countries
    const areaBg = svg.append("g")
        .selectAll("rect")
        .data(root.descendants().filter(d => d.depth === 2))
        .join("rect")
        .attr("class", "area-bg")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", cellW)
        .attr("height", cellH)
        .on("click", function (event, area) {
            // clicking the region itself works even when its country box is hidden
            zoomTo(zoomedArea === area ? null : area);
        });

    // country cells
    const cell = svg.selectAll("g.cell")
        .data(root.leaves())
        .join("g")
        .attr("class", "cell")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cell.append("rect")
        .attr("width", cellW)
        .attr("height", cellH)
        .attr("fill", d => statusColor(d.data.status));

    // keep each label inside its own cell
    cell.append("clipPath")
        .attr("id", (d, i) => `clip-${prefix}-${i}`)
        .append("rect")
        .attr("width", cellW)
        .attr("height", cellH);

    // skip labels on cells too small to hold them
    cell.append("text")
        .attr("class", "leaf-label")
        .attr("clip-path", (d, i) => `url(#clip-${prefix}-${i})`)
        .attr("x", 5)
        .attr("y", 16)
        .text(d => (cellW(d) >= 34 && cellH(d) >= 18) ? d.data.name : "");

    cell
        .on("mouseover", function (event, d) {
            const country = d.data.name;
            const area = d.parent.data.name;
            const continent = d.parent.parent.data.name;

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${country}</strong><br>
                    ${continent} / ${area}<br>
                    GDP: ${d.data.gdp} billion USD<br>
                    Status: ${d.data.status}
                `);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function () {
            tooltip.style("opacity", 0);
        })
        .on("click", function (event, d) {
            // click a country to zoom into its area, click again to zoom out
            const area = d.parent;
            zoomTo(zoomedArea === area ? null : area);
        });

    // draw the name headers for one level, returns the group selection
    function drawHeaders(depth, headerClass, headerHeight, textY) {
        const nodes = root.descendants().filter(d => d.depth === depth);

        const group = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        group.append("clipPath")
            .attr("id", (d, i) => `head-${prefix}-${depth}-${i}`)
            .append("rect")
            .attr("width", cellW)
            .attr("height", headerHeight);

        group.append("text")
            .attr("class", headerClass)
            .attr("clip-path", (d, i) => `url(#head-${prefix}-${depth}-${i})`)
            .attr("x", 5)
            .attr("y", textY)
            .text(d => d.data.name);

        return group;
    }

    const areaGroups = drawHeaders(2, "area-header", areaHeader, 11);
    const continentGroups = drawHeaders(1, "continent-header", continentHeader, 14);

    let zoomedArea = null;

    // width/height of a cell in the current view (zoomed area vs overview)
    function viewW(d, area) {
        return (area && d.parent === area) ? zw(d) : cellW(d);
    }
    function viewH(d, area) {
        return (area && d.parent === area) ? zh(d) : cellH(d);
    }

    function zoomTo(area) {
        zoomedArea = area;
        const dur = 600;

        // country cells: the selected area fills the canvas, the rest fade out
        cell.transition().duration(dur)
            .style("opacity", d => (!area || d.parent === area) ? 1 : 0)
            .attr("transform", d => {
                const r = (area && d.parent === area) ? d._zoom : d;
                return `translate(${r.x0},${r.y0})`;
            });

        // faded cells must not intercept clicks meant for the zoomed area
        cell.style("pointer-events", d => (!area || d.parent === area) ? "all" : "none");

        cell.select("rect").transition().duration(dur)
            .attr("width", d => viewW(d, area))
            .attr("height", d => viewH(d, area));

        cell.select("clipPath rect").transition().duration(dur)
            .attr("width", d => viewW(d, area))
            .attr("height", d => viewH(d, area));

        // reveal a country label once its cell is large enough
        cell.select("text.leaf-label")
            .text(d => {
                if (area && d.parent !== area) return "";
                return (viewW(d, area) >= 34 && viewH(d, area) >= 18) ? d.data.name : "";
            });

        // area panels: the selected one fills the canvas, the rest fade out
        areaBg.transition().duration(dur)
            .style("opacity", d => (!area || d === area) ? 1 : 0)
            .attr("x", d => (area && d === area) ? 0 : d.x0)
            .attr("y", d => (area && d === area) ? 0 : d.y0)
            .attr("width", d => (area && d === area) ? width : cellW(d))
            .attr("height", d => (area && d === area) ? height : cellH(d));

        areaBg.style("pointer-events", d => (!area || d === area) ? "all" : "none");

        // area headers: the selected one spans the top, the rest fade out
        areaGroups.transition().duration(dur)
            .style("opacity", d => (!area || d === area) ? 1 : 0)
            .attr("transform", d => (area && d === area)
                ? "translate(0,0)"
                : `translate(${d.x0},${d.y0})`);
        areaGroups.select("clipPath rect").transition().duration(dur)
            .attr("width", d => (area && d === area) ? width : cellW(d));

        // continent headers only make sense in the full overview
        continentGroups.transition().duration(dur)
            .style("opacity", area ? 0 : 1);
    }
}

buildLegend();

d3.json("../data/lab6_assignment_gdp.json").then(data => {
    drawTreemap(data, "#treemap1", d3.treemapSquarify, "t1");
    drawTreemap(data, "#treemap2", d3.treemapBinary, "t2");
});
