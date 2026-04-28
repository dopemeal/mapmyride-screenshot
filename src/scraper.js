const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function scrapeRoute(routeId) {
  if (!routeId) {
    console.error('❌ Error: No route ID provided');
    console.error('Usage: node src/scraper.js <routeId>');
    process.exit(1);
  }

  console.log(`🚴 Scraping MapMyRide route: ${routeId}`);

  let browser;
  try {
    // Launch browser with platform-specific args
    const args = [
      '--disable-dev-shm-usage', // Helps with memory on GitHub Actions
      '--disable-gpu',
    ];
    
    // Only use sandbox restrictions on Linux (GitHub Actions)
    if (process.env.CI) {
      args.push('--no-sandbox');
      args.push('--disable-setuid-sandbox');
    }
    
    browser = await puppeteer.launch({
      headless: 'new',
      args,
    });

    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: config.screenshot.viewportWidth,
      height: config.screenshot.viewportHeight,
      deviceScaleFactor: 2, // 2x for better quality
    });

    // Navigate to route
    const url = `${config.mapMyRideBaseUrl}/${routeId}`;
    console.log(`📍 Loading: ${url}`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: config.timeouts.pageLoad });
    } catch (err) {
      console.warn('⚠️  Page load timeout (network still loading, proceeding anyway)');
    }

    // Wait for map to appear
    try {
      await page.waitForSelector(config.selectors.mapContainer, {
        timeout: config.timeouts.mapRender,
      });
      console.log('✅ Map detected');
    } catch (err) {
      console.error('❌ Map container not found. Route may not exist or page structure changed.');
      throw err;
    }

    // Remove controls and unwanted buttons
    const removedCount = await page.evaluate((cfg) => {
      let count = 0;

      // Remove all control containers
      cfg.selectors.mapControls.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.remove();
          count++;
        });
      });

      // Hide buttons that aren't important
      document.querySelectorAll(cfg.selectors.buttons).forEach(button => {
        const text = button.textContent || '';
        const shouldKeep = cfg.keepPatterns.some(pattern => 
          text.includes(pattern)
        );
        
        if (!shouldKeep) {
          button.style.display = 'none';
          count++;
        }
      });

      return count;
    }, config);

    console.log(`🗑️  Removed ${removedCount} UI elements`);

    // Small delay for rendering
    await page.waitForTimeout(1000);

    // Create output directory
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save screenshot
    const filename = `route-${routeId}-${Date.now()}.png`;
    const filepath = path.join(outputDir, filename);
    
    await page.screenshot({
      path: filepath,
      type: 'png',
      fullPage: config.screenshot.fullPage,
    });

    console.log(`📸 Screenshot saved: ${filename}`);
    console.log(`✨ Success! Route ${routeId} captured`);

    return { success: true, file: filename, path: filepath };

  } catch (error) {
    console.error('❌ Scraping failed:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main execution
const routeId = process.argv[2];
scrapeRoute(routeId);
