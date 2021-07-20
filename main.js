var currentPosition = null;

// create a function to make a directions request
function getRoute(end) {
  // make a directions request using cycling profile
  // an arbitrary start will always be the same
  // only the end or destination will change
  //   if (!null) {
  var start = currentPosition;
  var url =
    "https://api.mapbox.com/directions/v5/mapbox/cycling/" +
    start[0] +
    "," +
    start[1] +
    ";" +
    end[0] +
    "," +
    end[1] +
    "?steps=true&geometries=geojson&access_token=" +
    mapboxgl.accessToken;

  // make an XHR request https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.onload = function () {
    var json = JSON.parse(req.response);
    var data = json.routes[0];
    var route = data.geometry.coordinates;
    var geojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: route,
      },
    };
    // get the sidebar and add the instructions
    var instructions = document.getElementById("instructions");
    var steps = data.legs[0].steps;

    var tripInstructions = [];
    for (var i = 0; i < steps.length; i++) {
      tripInstructions.push("<br><li>" + steps[i].maneuver.instruction) +
        "</li>";
      instructions.innerHTML =
        '<br><span class="duration">Trip duration: ' +
        Math.floor(data.duration / 60) +
        " min 🚴 </span>" +
        tripInstructions;
    }
    // if the route already exists on the map, reset it using setData
    if (map.getSource("route")) {
      map.getSource("route").setData(geojson);
    } else {
      // otherwise, make a new request
      map.addLayer({
        id: "route",
        type: "line",
        source: {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: geojson,
            },
          },
        },
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3887be",
          "line-width": 5,
          "line-opacity": 0.75,
        },
      });
    }
    // add turn instructions here at the end
  };

  req.send();
  //   }
}

function createPoint(coords) {
  var end = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: coords,
        },
      },
    ],
  };
  if (map.getLayer("end")) {
    map.getSource("end").setData(end);
  } else {
    map.addLayer({
      id: "end",
      type: "circle",
      source: {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: coords,
              },
            },
          ],
        },
      },
      paint: {
        "circle-radius": 10,
        "circle-color": "#f30",
      },
    });
  }
  getRoute(coords);
}

mapboxgl.accessToken =
  "pk.eyJ1IjoiY2F0dGVzdCIsImEiOiJja3JiY2ppNm40cjFiMzFtdGs0aXhxM24yIn0.ooSsNnzo4fiBHN7ravwW7Q";
var map = new mapboxgl.Map({
  container: "map", // container id
  style: "mapbox://styles/cattest/ckrbhyxs80k1518xavp8uae5r", // style URL
  center: [135.5596145633902, 34.630858878144124], // starting position [lng, lat]
  zoom: 12, // starting zoom
});
var marker = new mapboxgl.Marker()
  .setLngLat([135.5593515763041, 34.63067672104625])
  .addTo(map);

// 大阪市を区で分ける
var hoveredStateId = null;

var start = currentPosition;
var bounds = [
  [135.14339030485635, 34.31755419069676],
  [135.69322773509052, 34.90244219848531],
]; // 左下, 右上

var canvas = map.getCanvasContainer();

// マップ読み込み時
map.on("load", function () {
  // make an initial directions request that
  // starts and ends at the same location
  getRoute(start);

  // Add starting point to the map
  map.addLayer({
    id: "point",
    type: "circle",
    source: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: start,
            },
          },
        ],
      },
    },
    paint: {
      "circle-radius": 10,
      "circle-color": "#3887be",
    },
  });
  map.addSource("single-point", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });
  map.addLayer({
    id: "point1",
    source: "single-point",
    type: "circle",
    paint: {
      "circle-radius": 10,
      "circle-color": "#448ee4",
    },
  });
  // 検索して結果を指定したときに実行
  geocoder.on("result", function (e) {
    let geometry = e.result.geometry;
    map.getSource("single-point").setData(geometry);
    console.log(e.result.geometry);
    createPoint(geometry.coordinates);
  });
  map.addSource("states", {
    type: "geojson",
    data: "./gml/N03-19_27_190101.geojson",
  });

  // The feature-state dependent fill-opacity expression will render the hover effect
  // when a feature's hover state is set to true.
  map.addLayer({
    id: "state-fills",
    type: "fill",
    source: "states",
    layout: {},
    paint: {
      "fill-color": "#627BC1",
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        1,
        0.5,
      ],
    },
  });

  map.addLayer({
    id: "state-borders",
    type: "line",
    source: "states",
    layout: {},
    paint: {
      "line-color": "#627BC1",
      "line-width": 2,
    },
  });

  // When the user moves their mouse over the state-fill layer, we'll update the
  // feature state for the feature under the mouse.
  map.on("mousemove", "state-fills", function (e) {
    // 56
    if (e.features.length > 0) {
      if (hoveredStateId !== null) {
        map.setFeatureState(
          { source: "states", id: hoveredStateId },
          { hover: false }
        );
      }
      hoveredStateId = e.features[0].properties.N03_007;
      map.setFeatureState(
        { source: "states", id: hoveredStateId },
        { hover: true }
      );
    }
  });

  // When the mouse leaves the state-fill layer, update the feature state of the
  // previously hovered feature.
  map.on("mouseleave", "state-fills", function () {
    if (hoveredStateId !== null) {
      map.setFeatureState(
        { source: "states", id: hoveredStateId },
        { hover: false }
      );
    }
    hoveredStateId = null;
  });
});

map.on("click", function (e) {
  var coordsObj = e.lngLat;
  canvas.style.cursor = "";
  var coords = Object.keys(coordsObj).map(function (key) {
    return coordsObj[key];
  });
  createPoint(coords);
});
var geolocate = new mapboxgl.GeolocateControl({
  positionOptions: {
    enableHighAccuracy: true,
  },
  trackUserLocation: true,
});
// 現在位置のコントローラー
map.addControl(geolocate);
geolocate.on("geolocate", function (e) {
  var lon = e.coords.longitude;
  var lat = e.coords.latitude;
  currentPosition = [lon, lat];
  console.log(currentPosition);
});
// 道検索のコントローラー
// map.addControl(
//   new MapboxDirections({
//     accessToken: mapboxgl.accessToken,
//   }),
//   "top-left"
// );
// 検索のコントローラー
var geocoder = new MapboxGeocoder({
  // Initialize the geocoder
  accessToken: mapboxgl.accessToken, // Set the access token
  placeholder: "配達先の検索",
  mapboxgl: mapboxgl, // Set the mapbox-gl instance
  marker: false, // Do not use the default marker style
});

// Add the geocoder to the map
map.addControl(geocoder);
