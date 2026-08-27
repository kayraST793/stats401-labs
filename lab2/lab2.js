const width = 800;
const height = 500;

const margin = {
    top: 40,
    right: 170,
    bottom: 70,
    left: 70
};

const tooltip = d3.select("#tooltip");

d3.csv(
    "../data/cities_multivariate.csv",
    d => ({
        city: d.city,
        population: +d.population,
        temp_c: +d.temp_c,
        development_level: d.development_level,
        region: d.region
    }))
    .then(data => {
        const svg = d3.select("#chart")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const xScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.population))
            .nice()
            .range([
                margin.left,
                width - margin.right
            ]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.temp_c))
            .nice()
            .range([
                height - margin.bottom,
                margin.top
            ]);

        const regions = Array.from(
            new Set(data.map(d => d.region))
        );

        const colorScale = d3.scaleOrdinal()
            .domain(regions)
            .range(d3.schemeTableau10);

        const sizeScale = d3.scaleOrdinal()
            .domain([
                "High",
                "Medium",
                "Low"
            ])
            .range([5, 10, 15]);

        svg.append("g")
            .attr(
                "transform",
                `translate(0, ${height - margin.bottom})`
            )
            .call(d3.axisBottom(xScale));

        svg.append("g")
            .attr(
                "transform",
                `translate(${margin.left}, 0)`
            )
            .call(d3.axisLeft(yScale));

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height - 20)
            .attr("text-anchor", "middle")
            .text("Population (Millions)");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .text("Temperature (°C)");

        svg.selectAll(".city-point")
            .data(data)
            .join("circle")
            .attr("class", "city-point")
            .attr(
                "cx",
                d => xScale(d.population)
            )
            .attr(
                "cy",
                d => yScale(d.temp_c)
            )
            .attr(
                "r",
                d => sizeScale(d.development_level)
            )
            .attr(
                "fill",
                d => colorScale(d.region)
            )
            .attr("opacity", 0.8)
            .on("mouseover", function(event, d) {

                tooltip
                    .style("opacity", 1)
                    .html(`
                    <strong>${d.city}</strong><br>
                    Temperature: ${d.temp_c}°C<br>
                    Population: ${d.population} Million<br>
                    Region: ${d.region}<br>
                    Development Level: ${d.development_level}
                `);
            })
            .on("mousemove", function(event) {

                tooltip
                    .style(
                        "left",
                        `${event.pageX + 10}px`
                    )
                    .style(
                        "top",
                        `${event.pageY + 10}px`
                    );
            })
            .on("mouseout", function() {

                tooltip
                    .style("opacity", 0);
            });

        const legend = svg.append("g")
            .attr(
                "transform",
                `translate(${width - margin.right + 25}, 60)`
            );

        const legendItems = legend
            .selectAll(".legend-item")
            .data(regions)
            .join("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 28})`);

        legendItems.append("circle")
            .attr("r", 6)
            .attr("fill", d => colorScale(d));

        legendItems.append("text")
            .attr("x", 12)
            .attr("y", 4)
            .text(d => d);

});