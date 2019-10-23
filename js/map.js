var svg,
  projection,
  path,
  zoomBehavior,
  g,
  graticuleG,
  countriesG,
  equator,
  antimeridian,
  graticule,
  wrapper,
  zScale,
  button,
  hovered,
  CountryyScale,
  scaleRect,
  yAxis,
  scaleG,
  hoveredCountry,
  scaleSvg;
  
var svgPadding = 5
var saleHeight = 200
var dimensions = { height: 0, width: 0 };
var countryMapping = {
  fromAlphaTwo: new Map(),
  fromId: new Map(),
  fromName: new Map()
};
var projections = [];
var zoomRange = [1, 9];
var selectedProjection = 0;
var rotation = 0;
var currentView = 0;
var colors = ["red", "blue"];

var maxValues = {};
var views = [
  {label: "GDP", property: "gdp_md_est"},
  {label: "Victims", property: "victimCount"}
]
var projections = [
  {
    name: "Natural Earth",
    projection: d3.geoNaturalEarth1
  },
  {
    name: "Mercator",
    projection: d3.geoMercator
  },
  {
    name: "Globe",
    projection: d3.geoOrthographic
  },
  {
    name: "Stereographic",
    projection: d3.geoStereographic
  }
];

function loadData(){
  d3.json("/data/vcdb.json").then(function(data) {
    console.log(data);
    // initChart();
  });
}

/**
 * Runs all of the 1 time calculations that don't need to be run every time the map re-calcuates.
 */
function initChart() {
  // Append and Save useful DOM selections as variables
  wrapper = d3.select(".wrapper");
  svg = wrapper.append("svg")
  svg.classed("chart-svg", true);
  g = svg.append("g").classed("primary-group", true);
  graticuleG = g.append("g").classed("graticule-group", true);
  countriesG = g.append("g").classed("countries-group", true);
  button = wrapper.append("button");
  setDimensions();

  // Define the zoom behavior and assign it to the map.
  zoomBehavior = d3
    .zoom()
    .scaleExtent(zoomRange)
    .translateExtent([[0, 0], [dimensions.width, dimensions.height]])
    .on("zoom", () => move());
  svg.call(zoomBehavior);

  // Apply Key-press events to the map.
  d3.select("body").on("keydown", handleKeyDown);

  // The Graticule is the lat/long lines
  graticuleG
    .append("path")
    .datum(d3.geoGraticule())
    .attr("class", "graticule")
    .attr("d", path);
  graticule = graticuleG.select(".graticule");

  // The equator alone.
  equator = graticuleG
    .append("path")
    .datum({
      type: "LineString",
      coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]]
    })
    .attr("class", "equator")
    .attr("d", path);
  equator = graticuleG.select(".equator");

  // Supplements the gradicule with an additional antimeridian, so that it displays on both ends of the map.
  antimeridian = graticuleG
    .append("path")
    .attr("class", "antimeridian")
    .datum({
      type: "LineString",
      coordinates: [[180, 90], [180, -90]]
    })
    .attr("d", path);
  antimeridian = graticuleG.select(".antimeridian");

  // Re-calculates the map projection when the screen size is changed.
  d3.select(window).on("resize", () => resize());

  // Loads basic data for every country including coordinates for drawing their boundaries.
  loadGeoData();
  // Maps all country data to make them easilly retrievable.
  countries.map(country => addCountryToMapping(country));

  // Adds all countries to the map.
  countriesSelection = countriesG.selectAll(".country").data(countries);
  countriesSelection
    .enter()
    .insert("path")
    .attr("class", "country")
    .attr("d", path)
    .attr("id", (d, i) => `country-${d.properties.iso_n3}`)
    .attr("title", (d, i) => d.properties.name)
    .style("fill", "#333f58")
    .each(function(d) {
      countryMapping.fromAlphaTwo.get(
        d.properties.iso_a2.toString()
      ).selection = d3.select(this);
    })
    .on("mouseover", d => handleMouseOver(d));
  
  // Define button attributes and functionality.
  button
    .classed("views-button", true)
    .text(views[currentView].label)
    .on("click", handleViewChange)

  // Run data calculations and then apply the calculated data to the data visualization.
  calculateValues();
  initScale();
  draw();
}

/**
 * Runs all of the 1 time calculations for the color scale that don't need to be run every time the map re-calcuates.
 */
function initScale(){
  scaleSvg = wrapper.append("svg")
    .classed("scale-svg", true);
  appendScaleGradient();
  scaleG = scaleSvg.append('g')
  getScaleDimensions();

  yScale = d3.scaleLinear()
    .domain([0, maxValues[views[currentView].property]])
    .range([scaleHeight, 0]);

  scaleG.append("rect")
    .attr("y", svgPadding)
    .attr("x", 0)
    .attr("width", svgPadding * 3)
    .attr("fill", "url(#bg-gradient)");
  scaleRect = scaleG.select("rect");

  yAxis = scaleG
    .append("g")
    .classed("axis", true)
    .attr(
      "transform",
      `translate(${svgPadding * 3}, ${svgPadding})`
    );

  updateScale();
}

/**
 * Builds the color gradient definition for the color scale.
 */
function appendScaleGradient(){
  scaleGradient = scaleSvg.append("defs").append("linearGradient")
  scaleGradient.attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%").attr("id", "bg-gradient")
  colorTops = scaleGradient.selectAll("stop").data(colors)
  colorTops.enter().insert("stop").attr("stop-color", function(d){return d;}).attr("offset", function(d, i){ return `${(100 / (colors.length - 1)) * i}%` });
}

/**
 * Get height and width info for the color-scale.
 */
function getScaleDimensions() {
  scaleHeight = scaleSvg.node().getBoundingClientRect().height - svgPadding * 2;
  scaleWidth = scaleG.node().getBoundingClientRect().width + svgPadding * 3 + 3;
}

/**
 * Apply the latest data to the scale.
 */
function drawScale() {
  yScale.domain([0, maxValues[views[currentView].property]]).range([scaleHeight, 0]);

  scaleRect.attr("height", scaleHeight);

  yAxis.call(d3.axisRight(yScale));

  scaleSvg.attr("width", scaleWidth);
}

/**
 * Apply the current data to the scale axis and potentiall re-size if necessary.
 */
function updateScale() {
  yScale.domain([0, maxValues[views[currentView].property]]);
  yAxis.call(d3.axisRight(yScale));
  if (scaleWidth !== scaleG.node().getBoundingClientRect().width + 3) {
    resizeScale();
  }
}

/**
 * Should be called when the scale needs to be resized.
 */
function resizeScale() {
  getScaleDimensions();
  drawScale();
}

/*
 * Changes the current view.
 */
function handleViewChange(){
  currentView = currentView + 1 > views.length -1 ? 0 : currentView + 1;
  button.text(views[currentView].label);
  
  draw()
  drawScale();
}

/*
 * Handles the key down events.
 */
function handleKeyDown() {
  switch (d3.event.key) {
    case "ArrowRight":
      rotate(10);
      break;
    case "ArrowLeft":
      rotate(-10);
      break;
    case "ArrowUp":
      handleChangeProjection(1);
      break;
    case "ArrowDown":
      handleChangeProjection(-1);
      break;
  }
}

/**
 * Changes the map projection from one to another.
 */
function handleChangeProjection(projectionChange) {
  selectedProjection = Math.min(
    Math.max(selectedProjection + projectionChange, 0),
    projections.length - 1
  );
  setup();
  redrawProjection();
}

/**
 * Append and draw all map objects.
 */
function draw() {
  antimeridian.classed("active", rotation === 0 ? true : false);

  // This can update each country with new data without having to re-select or rebuild them.
  countries.forEach((country, i) => {
    if (country.selection) {
      const property = views[currentView].property;
      const value = country.properties[property];
      const maxValue = maxValues[property];
      // This is applying a "fill" color to each country based on their GDP relative to the maximum GDP value in the dataset.
      country.selection.style("fill", () =>
        d3.interpolateRgbBasis(colors)(
          1 / (maxValue / value)
        )
      );
    }
  });
}

/**
 * Rotates the earth on its' axis.
 */
function rotate(newRotation) {
  rotation = newRotation === 360 ? 0 : rotation + newRotation;
  projection.rotate([rotation, 0, 0]);
  path = d3.geoPath().projection(projection);
  redrawProjection();
}

/**
 * Redraws the aspects of the map that change when the projection is altered.
 */
function redrawProjection() {
  countries.forEach((country, i) => {
    if (country.selection) {
      country.selection.attr("d", path);
    }
  });

  graticule.attr("d", path);
  antimeridian.attr("d", path).classed("active", rotation === 0 ? true : false);
  equator.attr("d", path);
}

/**
 * Calculates the needed summary data.
 */
function calculateValues() {
  countries.map(country => country.properties.victimCount = 0)
  exampleData.map(entry => entry.victim.country.map(country => {
    const foundCountry = countryMapping.fromAlphaTwo.get(country)
    if(foundCountry){
      foundCountry.properties.victimCount++;
    }
  }))
  views.map(view =>{
    maxValues[view.property] = d3.max(countries, country => country.properties[view.property]);
  })
}

/**
 * Zoom/Pan Map
 */
function move() {
  const currentTransform = d3.event.transform;
  zScale = currentTransform.k;
  g.attr("transform", currentTransform);
  g.style("stroke-width", 2 / currentTransform.k);
}

/**
 * Finds SVG dimensions
 */
function setDimensions() {
  const { width, height } = svg.node().getBoundingClientRect();
  dimensions.height = height;
  dimensions.width = width;
  setup();
}

function loadGeoData() {
  // World Topo is an object containing a lot of country data that is
  // being defined in the /data/hd-countries.js file and included via a script tag in the HTML.
  countries = worldTopo.features;
}

function setup() {
  const { height, width } = dimensions;

  projection = projections[selectedProjection]
    .projection()
    .translate([width / 2, height / 2])
    .scale(width / 2 / Math.PI);

  path = d3.geoPath().projection(projection);
}

/**
 * Resize Map.
 */
function resize() {
  setDimensions();
  redrawProjection();
}

/**
 * Adds a country to a map for convient fetchign later.
 */
function addCountryToMapping(country) {
  countryMapping.fromAlphaTwo.set(country.properties.iso_a2, country);
}

/**
 * Handle when a country is hovered over.
 */
function handleMouseOver(country) {
  if (hoveredCountry) {
    hoveredCountry.selection.classed("highlighted", false);
  }
  const newHoveredCountry = {
    id: country.properties.iso_a2,
    name: country.properties.name,
    value: country.properties.gdp_md_est,
    selection: this.countryMapping.fromAlphaTwo.get(country.properties.iso_a2)
      .selection
  };
  newHoveredCountry.selection.classed("highlighted", true).raise();
  hoveredCountry = newHoveredCountry;
}
