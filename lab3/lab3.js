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
    const sortState = {};                       // remembers direction per column

    const table = d3.select("#data-table");

    // --- header row with clickable headings ---
    const header = table.select("thead").append("tr");

    header.selectAll("th")
        .data(columns)
        .join("th")
        .text(d => LABELS[d] || d)
        .style("cursor", "pointer")
        .on("click", function (event, column) {

            const ascending = !sortState[column];   // toggle
            sortState[column] = ascending;

            data.sort((a, b) =>
                ascending
                    ? d3.ascending(a[column], b[column])
                    : d3.descending(a[column], b[column])
            );

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
