// Lab 3 — Sortable table of the acquired cryptocurrency dataset

// Numeric columns (convert from string so sorting is numeric, not alphabetical)
const NUMERIC = ["rank", "price_usd", "market_cap", "volume_24h", "change_24h_pct"];

// Friendlier column headings
const LABELS = {
    rank: "Rank",
    id: "ID",
    name: "Name",
    symbol: "Symbol",
    price_usd: "Price (USD)",
    market_cap: "Market Cap (USD)",
    volume_24h: "24h Volume (USD)",
    change_24h_pct: "24h Change (%)"
};

// Format a value for display
function format(column, value) {
    if (value === null || value === "" || Number.isNaN(value)) return "—";

    if (column === "price_usd") {
        return "$" + Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
    if (column === "market_cap" || column === "volume_24h") {
        return "$" + Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    if (column === "change_24h_pct") {
        return Number(value).toFixed(2) + "%";
    }
    return value;
}

d3.csv("../data/coins.csv", d => {
    // Convert numeric columns from strings to numbers
    NUMERIC.forEach(col => {
        d[col] = d[col] === "" ? null : +d[col];
    });
    return d;
}).then(data => {

    const columns = data.columns;

    // Track the current sort so a NEW column starts ascending,
    // and clicking the SAME column again reverses direction.
    let sortColumn = null;
    let ascending = true;

    const table = d3.select("#data-table");

    // --- header row with clickable headings ---
    const header = table.select("thead").append("tr");

    header.selectAll("th")
        .data(columns)
        .join("th")
        .text(d => LABELS[d] || d)
        .style("cursor", "pointer")
        .on("click", function (event, column) {

            // New column -> ascending; same column -> flip direction
            if (column === sortColumn) {
                ascending = !ascending;
            } else {
                sortColumn = column;
                ascending = true;
            }

            const direction = ascending ? 1 : -1;

            data.sort((a, b) => {
                const x = a[column];
                const y = b[column];

                // Push empty/missing values to the bottom either way
                const xEmpty = x === null || x === undefined || (typeof x === "number" && Number.isNaN(x));
                const yEmpty = y === null || y === undefined || (typeof y === "number" && Number.isNaN(y));
                if (xEmpty && yEmpty) return 0;
                if (xEmpty) return 1;
                if (yEmpty) return -1;

                return direction * d3.ascending(x, y);
            });

            updateRows();
        });

    // --- (re)draw the body rows ---
    function updateRows() {
        const rows = table.select("tbody")
            .selectAll("tr")
            .data(data)
            .join("tr");

        rows.selectAll("td")
            .data(row => columns.map(column => ({ column, value: row[column] })))
            .join("td")
            .attr("class", d => NUMERIC.includes(d.column) ? "num" : null)
            .text(d => format(d.column, d.value));
    }

    updateRows();    // initial draw

    // Fill in the live record count on the page
    d3.select("#record-count").text(data.length.toLocaleString());
});
