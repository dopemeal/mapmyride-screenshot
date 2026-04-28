# 🚴 MapMyRide Route Screenshot Scraper

Generate clean screenshots of MapMyRide cycling routes without map controls.

## Quick Start

1. **Go to Actions tab** in this repository
2. **Click "🚴 Scrape MapMyRide Route"** workflow
3. **Click "Run workflow"**
4. **Enter a MapMyRide route ID** (the number from the URL)
5. **Wait 1-2 minutes** for the scraper to run
6. **Download the screenshot** from the artifacts

## Finding Your Route ID

Visit a MapMyRide route page. The URL looks like:

```
https://www.mapmyride.com/routes/view/123456789
```

The number `123456789` is your **route ID**.

## Features

✅ Removes map controls  
✅ Removes button overlays  
✅ Preserves distance & elevation info  
✅ High-resolution screenshots (2x DPI)  
✅ Free to use (GitHub Actions)  

## How It Works

- **Puppeteer** headless browser automates screenshot capture
- **GitHub Actions** runs the script serverless (no cost to you)
- Results stored as artifacts for 90 days
- Completely free tier usage

## Limitations

- Route must exist and be publicly viewable
- Screenshots taken at 1280x720 resolution
- One screenshot per ~2 seconds (rate limit for server courtesy)
- Results expire after 90 days

## Troubleshooting

**"Route not found"**
- Verify the route ID is numeric only
- Check the route is public on MapMyRide
- Try manually visiting: `https://www.mapmyride.com/routes/view/{id}`

**"Map container not found"**
- MapMyRide may have changed their HTML structure
- Create an issue with the route ID and we'll investigate

## License

MIT License - Free to use and modify

## Disclaimer

This tool is for personal use. Respect MapMyRide's Terms of Service and rate limits. Don't overload their servers.
