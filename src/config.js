module.exports = {
  mapMyRideBaseUrl: 'https://www.mapmyride.com/routes/view',
  
  selectors: {
    mapContainer: '[class*="map"]',
    mapControls: [
      '[class*="leaflet-control"]',
      '[class*="control-container"]',
      '.map-controls',
      '[data-testid*="control"]'
    ],
    buttons: 'button',
    // Keep these text patterns visible
    keepPatterns: ['Distance', 'Elevation', 'Time', 'Pace'],
  },
  
  timeouts: {
    pageLoad: 15000,
    mapRender: 10000,
  },
  
  screenshot: {
    encoding: 'png',
    fullPage: false,
    // Adjust viewport as needed
    viewportWidth: 1280,
    viewportHeight: 720,
  },
};
