const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Global timeout for the entire operation (4 minutes to fit in 10-minute GitHub Actions timeout)
const GLOBAL_TIMEOUT = 240000; // 4 minutes

async function scrapeRoute(routeId) {
  if (!routeId) {
    console.error('❌ Error: No route ID provided');
    console.error('Usage: node src/scraper.js <routeId>');
    process.exit(1);
  }

  console.log(`🚴 Scraping MapMyRide route: ${routeId}`);

  // Create a timeout promise that rejects after GLOBAL_TIMEOUT
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      console.error(`[${new Date().toISOString()}] ⏰ Global timeout exceeded (${GLOBAL_TIMEOUT/1000}s)`);
      reject(new Error('Scraping exceeded maximum time limit (4 minutes)'));
    }, GLOBAL_TIMEOUT);
  });

  try {
    console.log(`[${new Date().toISOString()}] 🎯 Starting scrape with ${GLOBAL_TIMEOUT/1000}s timeout`);
    // Race the main scraping logic against the timeout
    return await Promise.race([
      scrapeRouteInternal(routeId),
      timeoutPromise
    ]);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 💥 Scrape operation failed:`, error.message);
    process.exit(1);
  }
}

async function scrapeRouteInternal(routeId) {
  console.log(`[${new Date().toISOString()}] 🚀 Starting scrape operation`);
  let browser;
  try {
    console.log(`[${new Date().toISOString()}] 🌐 Launching browser...`);
    
    // Determine Chrome/Chromium executable path
    let executablePath = undefined;
    if (process.env.CI) {
      // Try multiple possible Chrome paths on Linux
      const possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
      ];
      
      for (const path of possiblePaths) {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          executablePath = path;
          console.log(`[${new Date().toISOString()}] ✅ Found Chrome at: ${path}`);
          break;
        }
      }
      
      if (!executablePath) {
        console.warn(`[${new Date().toISOString()}] ⚠️  Chrome not found in common paths, Puppeteer will attempt to find it`);
      }
    }
    
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
    
    console.log(`[${new Date().toISOString()}] 🔧 Browser launch config: executablePath=${executablePath || 'auto'}, args=${args.join(',')}`);
    
    browser = await puppeteer.launch({
      headless: 'new',
      args,
      executablePath,
    });
    console.log(`[${new Date().toISOString()}] ✅ Browser launched successfully`);

    console.log(`[${new Date().toISOString()}] 📄 Creating new page...`);
    const page = await browser.newPage();
    console.log(`[${new Date().toISOString()}] ✅ Page created`);
    
    // Set viewport
    console.log(`[${new Date().toISOString()}] 📐 Setting viewport...`);
    await page.setViewport({
      width: config.screenshot.viewportWidth,
      height: config.screenshot.viewportHeight,
      deviceScaleFactor: 2, // 2x for better quality
    });
    console.log(`[${new Date().toISOString()}] ✅ Viewport set`);

    // Navigate to route
    const url = `${config.mapMyRideBaseUrl}/${routeId}`;
    console.log(`[${new Date().toISOString()}] 📍 Loading: ${url}`);
    
    let pageLoaded = false;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.timeouts.pageLoad });
      pageLoaded = true;
      console.log(`[${new Date().toISOString()}] ✅ Page loaded successfully`);
    } catch (err) {
      console.warn(`[${new Date().toISOString()}] ⚠️  Page load error: ${err.message}`);
      pageLoaded = false;
    }

    // Wait for map to appear
    console.log(`[${new Date().toISOString()}] 🗺️  Waiting for map container...`);
    let mapFound = false;
    try {
      // Try waiting for the main container first
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Distance') || 
               document.querySelectorAll('[class*="map"]').length > 0;
      }, { timeout: config.timeouts.mapRender });
      mapFound = true;
      console.log(`[${new Date().toISOString()}] ✅ Map detected`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ❌ Map detection failed: ${err.message}`);
      
      // Log page content for debugging
      const pageTitle = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.error(`[${new Date().toISOString()}] 📄 Page title: ${pageTitle}`);
      console.error(`[${new Date().toISOString()}] 📄 Page content (first 500 chars): ${bodyText}`);
      
      mapFound = false;
    }

    if (!mapFound) {
      throw new Error('Map container not found. Route may not exist, page structure changed, or route is private.');
    }

    // Remove controls and unwanted buttons
    console.log(`[${new Date().toISOString()}] 🧹 Removing UI elements...`);
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

    console.log(`[${new Date().toISOString()}] 🗑️  Removed ${removedCount} UI elements`);

    // Small delay for rendering
    console.log(`[${new Date().toISOString()}] ⏳ Waiting for rendering...`);
    await page.waitForTimeout(1000);
    console.log(`[${new Date().toISOString()}] ✅ Rendering complete`);

    // Create output directory
    console.log(`[${new Date().toISOString()}] 📁 Creating output directory...`);
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    console.log(`[${new Date().toISOString()}] ✅ Output directory ready`);

    // Save screenshot
    const filename = `route-${routeId}-${Date.now()}.png`;
    const filepath = path.join(outputDir, filename);
    
    console.log(`[${new Date().toISOString()}] 📸 Taking screenshot to: ${filepath}`);
    try {
      await page.screenshot({
        path: filepath,
        type: 'png',
        fullPage: config.screenshot.fullPage,
      });
      
      // Verify file was created
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        console.log(`[${new Date().toISOString()}] ✅ Screenshot saved: ${filename} (${stats.size} bytes)`);
      } else {
        throw new Error(`Screenshot file was not created at ${filepath}`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ❌ Screenshot failed: ${err.message}`);
      throw err;
    }

    console.log(`[${new Date().toISOString()}] ✨ Success! Route ${routeId} captured`);

    return { success: true, file: filename, path: filepath };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Scraping failed:`, error.message);
    process.exit(1);
  } finally {
    console.log(`[${new Date().toISOString()}] 🧹 Cleaning up browser...`);
    if (browser) {
      await browser.close();
      console.log(`[${new Date().toISOString()}] ✅ Browser closed`);
    }
  }
}

// Main execution
const routeId = process.argv[2];
scrapeRoute(routeId);
