/**
 * charts.js — consistent Chart.js theming + an "upsert" pattern so live
 * refreshes update existing chart instances in place instead of flashing
 * a full destroy/recreate every 60 seconds.
 */
const ChartFactory = (function(){
  const instances = {};
  const palette = {
    blue: "#003E7E", blueLight: "#2A65A8", orange: "#F58220",
    green: "#1F9254", amber: "#C8880A", red: "#D64545",
    grid: "#E1E7EF", text: "#5C6B7E"
  };
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = palette.text;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.padding = 14;

  function upsert(canvasId, config){
    const el = document.getElementById(canvasId);
    if(!el) return null;
    if(instances[canvasId]){
      instances[canvasId].data = config.data;
      if(config.options) instances[canvasId].options = config.options;
      instances[canvasId].update();
      return instances[canvasId];
    }
    instances[canvasId] = new Chart(el.getContext("2d"), config);
    return instances[canvasId];
  }

  function baseGrid(){
    return { color: palette.grid, drawTicks: false };
  }

  return { upsert, palette, baseGrid, instances };
})();
