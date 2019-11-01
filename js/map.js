// This is just initiating a bunch of global variables that I use in the chart.
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
var dimensions = { height: 0, width: 0 };
var countryMapping = {
  fromAlphaTwo: new Map(),
  fromId: new Map(),
  fromName: new Map()
};
var projections = [];
var maxValues = {};

// These are a bunch of initial values that define how the chart works and displays.
var svgPadding = 5;
var saleHeight = 200;
var zoomRange = [1, 9];
var selectedProjection = 0;
var rotation = 0;
var currentView = 0;
// Color strings can be simple colors like "green" or hex codes like "#00FF00" or RGB/RGBA codes like "rgba(0, 255, 0, 0)".
var colors = ["red", "blue"];
var views = [
  { label: "GDP", property: "gdp_md_est" },
  { label: "Victims", property: "victimCount" }
];
// the d3.{x}s below are just different globe projections that d3 comes bundled with for use in painting geographical data to.
// Using different projections can change the map from looking like a globe to a rctangular map and other such things.
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

// Loads the JSON data we want to visualize in this project.
function loadData() {
  d3.json("/data/vcdb.json").then(function(data) {
    // Console.log reads out the given data to the browser console. In this case it's printing out the hacking data we've loaded for use in this project.
    console.log(data);
    // Normally we could kick off the chart's initiation after the data we're using is loaded, but in this case we're loading and starting the data the quick and dirty way right in the HTML.
    // initChart();
  });
}

/**
 * Runs all of the 1 time calculations that don't need to be run every time the map re-calcuates.
 */
function initChart() {
  // Append and Save useful DOM selections as variables
  // d3.select is D3's method for selecting single dom elements.
  // It takes a CSS selector as an argument and selects the first DOM element that matches the selector.
  wrapper = d3.select(".wrapper");
  // .append is a method on D3 selections that appends the supplied HTML element type to the selected DOM element.
  // It also returns a new selection consisting of the appended DOM element.
  svg = wrapper.append("svg");
  // .classed is a method on D3 selections that takes a class name and a boolean.
  // It will either add or remove the given class name to the selected DOM element based on the given boolean argument.
  svg.classed("chart-svg", true);
  // I'm adding a "g" (group) element to our chart SVG. These elements are good for organzing the SVG' internal elements and applyign to changes to groups of elements at once.
  // Such as placing all country elements either in front or behind all latitutde nd longitude elemnts.
  g = svg.append("g").classed("primary-group", true);
  graticuleG = g.append("g").classed("graticule-group", true);
  countriesG = g.append("g").classed("countries-group", true);
  button = wrapper.append("button");
  getDimensions();

  // Define the zoom behavior and assign it to the map.
  // d3.zoom is a method that returns a "zoom" behavior that defines how the map the should be zoomed and panned around.
  zoomBehavior = d3
    .zoom()
    // .scaleExtent is defining the zoom range of the zoom bahavior.
    // It takes an array of two numbers, one being the most you can zoom out and the second being how far you can zoom in.
    .scaleExtent(zoomRange)
    // .on is a method of D3 selections (or in this case a bahavior) that applies event triggers to DOM elements.
    // In this case we're applying a "zoom" event trigger to the chart so that whenever the user uses their typical mouse zooming actions, a method is called that will zoom or pan the map.
    .on("zoom", () => move());

  // .call is a D3 method on D3 selections that applies the supplied object to the selection.
  // In this case it is applying the zoom behavior we defined above to the SVG selection.
  svg.call(zoomBehavior);

  // Apply Key-press events to the map.
  d3.select("body")
    // Other event triggers that can be applied to d3 selections: https://developer.mozilla.org/en-US/docs/Web/Events#Standard_events
    .on("keydown", handleKeyDown);

  // The Graticule is the lat/long lines
  graticuleG
    .append("path")
    // .datum and .data are both methods on D3 selections that bind the supplied data to the D3 selection.
    // In this case we're binding the latitide and longitude line positions to an SVG Path element whis is what will actually display the lines on the chart.
    .datum(d3.geoGraticule())
    // .attr is a D3 selection method that takes an HTML attribute, and a value (or a function returnign a value) to apply to that attribute for the selected DOM element.
    // In thise case we're giving the selected element the CSS class "graticule". Note that unlike the .classed method, this will simply replace the previous attribute value, rather than appending or removing the given value from the previous attribute value.
    .attr("class", "graticule")
    // The "d" HTML attribute is where the SVG coordinates are supplied that tells path element how they should be drawn.
    .attr("d", path);
  graticule = graticuleG.select(".graticule");

  // The equator alone.
  equator = graticuleG
    .append("path")
    .datum({
      type: "LineString",
      // Each of these is a lat-long coordinate. This is drawing a straight line along the globe's equator.
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
  // .selectAll is a d3 method (and a d3 selection method) that returns a selection of all the matching element on the DOM (or within the selection the method was called on).
  countriesG
    .selectAll(".country")
    .data(countries)
    // .enter is a d3 selection method that allows us to add a new element for each element of a given array.
    // In this case we're making a new element for every country in our geographical data.
    // .enter wil also remove elements if their original array element is removed from that array.
    .enter()
    // .insert is defining what kind of element we want to add for each element of our array (for each country in this case)
    .insert("path")
    .attr("class", "country")
    .attr("d", path)
    // D3 methods that can accept functions as arguments are supplied with 2 potential arugments (customarilly assigned to arguments named "d" and "i") that contain the selection's datum and index.
    // In this case "d" contains all of the data the geographic dataset we're using has for each country.
    // In the case below I'm applying a HTML ID attribute containing the country's 3 digit identifier number.
    .attr("id", (d, i) => `country-${d.properties.iso_n3}`)
    .attr("title", (d, i) => d.properties.name)
    // .style is a D3 selection method that takes a CSS attribute and a value and applies it to the selection.
    // In this case we're applying a grayish "fill" color to each country.
    .style("fill", "#333f58")
    // .each is a method that allows u
    .each(function(d) {
      // d3.select is an easy way to select DOM elements, but it has poor performance.
      // So I've built a country Map from which to fetch any country datum I want and, as you see below, I am adding the d3 selection for each country as a property of those country datums
      // with whish I can easilly and performantly use to modify any country's selection that I want.
      countryMapping.fromAlphaTwo.get(
        d.properties.iso_a2.toString()
        // `this` within the context of a d3 selection's function call can be used to create a selection of the current selection's DOM element.
      ).selection = d3.select(this);
    })
    .on("mouseover", d => handleMouseOver(d));
  countriesSelection = countriesG.selectAll(".country");

  // Define button attributes and functionality.
  button
    .classed("views-button", true)
    // .text is a d3 selection method that takes a string as an argument enters that as text for the selected DOM element.
    .text(views[currentView].label)
    .on("click", handleViewChange);

  // Run data calculations and then apply the calculated data to the data visualization.
  calculateValues();
  initScale();
  resize();
  draw();
}

/**
 * Append and draw all map objects.
 */
function draw() {
  return;
  const property = views[currentView].property;
  const maxValue = maxValues[property];
  // This can update each country with new data without having to re-select or rebuild them.
  countriesSelection.style("fill", d => {
    const value = d.properties[property];
    // This is applying a "fill" color to each country based on their GDP relative to the maximum GDP value in the dataset.
    return colorInterpolator(1 / (maxValue / value));
  });
}

/**
 * Assigns a color array to the color interpolator.
 * colorArray is just an array of color strings and can be any number of colors
 */
function applyColors(colorArray) {
  colors = colorArray;
  // d3.interpolateRgbBasis is a D3 method that accepts an array of color strings and which returns a function that can used to scale numeric values to the provided scale of colors.
  // This function accepts a number between 0 and 1 and returns a color matching where the value fals on the previously provided scale of colors.
  // For example, if d3.interpolateRgbBasis is provided the array of color strings; ['red', 'blue'], then it returns a function that would return "red" if given the argument 0, "blue" if given an argument of 1, and "purple" if given 0.5.
  colorInterpolator = d3.interpolateRgbBasis(colors);

  // This is modifying the SVG scale gradient filter to be a gradient of the given colors.
  colorStops = scaleGradient.selectAll("stop").data(colors);
  // .enter is a D3 selection method that is returning all of the elements that are no longer represented in the most recent data array for the selection.
  // .remove is a D3 selection method that is removing the elements from the DOM that are in the given selection.
  colorStops.exit().remove();
  colorStops
    .attr("stop-color", d => d)
    .attr("offset", (d, i) => `${(100 / (colors.length - 1)) * i}%`)
    .enter()
    .append("stop")
    .attr("stop-color", d => d)
    .attr("offset", (d, i) => `${(100 / (colors.length - 1)) * i}%`);

  draw();
}

/*
 * Handles the key down events.
 */
function handleKeyDown() {
  // d3.event is a object containing data for the most recently triggered D3 event.
  // In this case we're calling different functions with differenrt values based on which arrow key has been pressed.
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

/*
 * Changes the current view.
 */
function handleViewChange() {
  currentView = currentView + 1 > views.length - 1 ? 0 : currentView + 1;
  button.text(views[currentView].label);

  draw();
  drawScale();
}

/**
 * Changes the map projection from one to another.
 */
function handleChangeProjection(projectionChange) {
  selectedProjection = Math.min(
    Math.max(selectedProjection + projectionChange, 0),
    projections.length - 1
  );
  setupProjection();
  redrawProjection();
}

/**
 * Rotates the earth on its' axis.
 */
function rotate(newRotation) {
  rotation = newRotation === 360 ? 0 : rotation + newRotation;
  antimeridian.classed("active", rotation === 0 ? true : false);
  // .rotate is a method that rotates the projection by the given amount.
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
  countries.map(country => (country.properties.victimCount = 0));
  exampleData.map(entry =>
    entry.victim.country.map(country => {
      const foundCountry = countryMapping.fromAlphaTwo.get(country);
      if (foundCountry) {
        foundCountry.properties.victimCount++;
      }
    })
  );
  views.map(view => {
    // d3.map is a D3 method that takes an array of items and a function that returns the value that you wish to sum from an element of the given array.
    maxValues[view.property] = d3.max(
      countries,
      country => country.properties[view.property]
    );
  });
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
function getDimensions() {
  const { width, height } = svg.node().getBoundingClientRect();
  dimensions.height = height;
  dimensions.width = width;
  setupProjection();
}

function loadGeoData() {
  // World Topo is an object containing a lot of country data that is
  // being defined in the /data/hd-countries.js file and included via a script tag in the HTML.
  countries = worldTopo.features;
}

function setupProjection() {
  const { height, width } = dimensions;

  projection = projections[selectedProjection]
    .projection()
    .translate([width / 2, height / 2])
    .scale(width / 2 / Math.PI);

  path = d3.geoPath().projection(projection);
}

/**
 * Adds a country to a map for convient fetchign later.
 */
function addCountryToMapping(country) {
  countryMapping.fromAlphaTwo.set(country.properties.iso_a2, country);
}

/**
 * Resize Map.
 */
function resize() {
  getDimensions();

  zoomBehavior
    // .translateExtent is defining the area within which the map can be panned within.
    // It takes the arguments for the farthest up and left the map can be panned, and then arguments for the further right and down it can be panned.
    // In this example we're just using the SVG's top and left most points and its furthest right and bottom points as the panning limits.
    .translateExtent([[0, 0], [dimensions.width, dimensions.height]]);

  redrawProjection();
}

/**
 * Runs all of the 1 time calculations for the color scale that don't need to be run every time the map re-calcuates.
 */
function initScale() {
  scaleSvg = wrapper.append("svg").classed("scale-svg", true);
  appendScaleGradient();
  scaleG = scaleSvg.append("g");
  getScaleDimensions();

  applyColors(colors);

  // d3.scaleLinear is one of a number of scale behaviors supplied by d3.
  // It helps to greatly simplify the work it takes to apply scales, such as applying a color scale to a set of values.
  yScale = d3
    .scaleLinear()
    // .domain is a method on scale bahaviors that defines the minimum and maximum values we want to present on the scale.
    .domain([0, maxValues[views[currentView].property]])
    // .range is a method on scale bahaviors that defines the distance across which we want to apply the scale.
    // In this case we are having the scale display across the full height of the colro scale we've built for the map.
    .range([scaleHeight, 0]);

  scaleG
    .append("rect")
    .attr("y", svgPadding)
    .attr("x", 0)
    .attr("width", svgPadding * 3)
    // The function "appendScaleGradient()" builds an SVG color gradient and the line below applies that gradient as the "fill" of the scale rect element.
    .attr("fill", "url(#bg-gradient)");
  scaleRect = scaleG.select("rect");

  yAxis = scaleG
    .append("g")
    .classed("axis", true)
    .attr("transform", `translate(${svgPadding * 3}, ${svgPadding})`);

  updateScale();
}

/**
 * Builds the color gradient definition for the color scale.
 */
function appendScaleGradient() {
  scaleGradient = scaleSvg.append("defs").append("linearGradient");
  scaleGradient
    .attr("x1", "0%")
    .attr("y1", "100%")
    .attr("x2", "0%")
    .attr("y2", "0%")
    .attr("id", "bg-gradient");

  scaleGradient.selectAll("stop");
  applyColors(colors);
}

/**
 * Get height and width info for the color-scale.
 */
function getScaleDimensions() {
  // .node is a D3 selection method that returns the actual DOM element of the selection rather than the selection itself.
  scaleHeight =
    scaleSvg
      .node()
      // .getBoundingClientRect is a plain Javascript method that provides the dimensional data of a DOM element.
      .getBoundingClientRect().height -
    svgPadding * 2;
  scaleWidth = scaleG.node().getBoundingClientRect().width + svgPadding * 3 + 3;
}

/**
 * Apply the latest data to the scale.
 */
function drawScale() {
  yScale
    .domain([0, maxValues[views[currentView].property]])
    .range([scaleHeight, 0]);

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
