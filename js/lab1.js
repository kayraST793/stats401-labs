// Lab 1 — Student Score Bar Chart

// Create the SVG item
const svg = d3.select("#chart")
    .append("svg")
    .attr("width", 600)
    .attr("height", 300);

// Title for the SVG
svg.append("text")
    .attr("x", 300)              // half of the 600 width → centered
    .attr("y", 30)               // near the top
    .attr("text-anchor", "middle")
    .attr("font-size", "20px")
    .attr("font-weight", "bold")
    .text("Student Scores");


// Load the data, then draw everything
async function loadData() {

    const data = await d3.csv(
        "../data/students.csv",
        d => ({
            name: d.name,
            score: +d.score
        })
    );

    // One bar for each student
    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", (d, i) => 20 + i * 70)
        .attr("y", d => 250 - d.score * 2)
        .attr("width", 50)
        .attr("height", d => d.score * 2)
        .attr("fill", "steelblue");


    // Score under each bar
    svg.selectAll(".scores")
        .data(data)
        .join("text")
        .attr("class", "scores")
        .attr("x", (d, i) => 20 + i * 70 + 25)
        .attr("y", 270)
        .attr("text-anchor", "middle")
        .text(d => d.score);

    // Name under each bar
    svg.selectAll(".names")
        .data(data)
        .join("text")
        .attr("class", "names")
        .attr("x", (d, i) => 20 + i * 70 + 25)
        .attr("y", 290)
        .attr("text-anchor", "middle")
        .text(d => d.name);

}

loadData();
