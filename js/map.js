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
  zScale,
  hoveredCountry;
var dimensions = { height: 0, width: 0 };
var countryMapping = {
  fromAlphaTwo: new Map(),
  fromId: new Map(),
  fromName: new Map()
};
var projections = [];
var zoomRange = [1, 9];
var selectedProjection = 0;
var maxValue = 0;
var rotation = 0;
var colors = ["red", "blue"];
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

/**
 * Runs all of the 1 time calculations that don't need to be run every time the map re-calcuates.
 */
function initChart() {
  svg = d3.select(".wrapper").append("svg");
  setDimensions();

  zoomBehavior = d3
    .zoom()
    .scaleExtent(zoomRange)
    .translateExtent([[0, 0], [dimensions.width, dimensions.height]])
    .on("zoom", () => move());
  svg.call(zoomBehavior);

  d3.select("body").on("keydown", handleKeyDown);

  g = svg.append("g").classed("primary-group", true);
  graticuleG = g.append("g").classed("graticule-group", true);
  countriesG = g.append("g").classed("countries-group", true);

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

  calculateValues();
  draw();
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
      // This is applying a "fill" color to each country based on their GDP relative to the maximum GDP value in the dataset.
      country.selection.style("fill", () =>
        d3.interpolateRgbBasis(colors)(
          1 / (maxValue / country.properties.gdp_md_est)
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
  maxValue = d3.max(countries, country => country.properties.gdp_md_est);
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
