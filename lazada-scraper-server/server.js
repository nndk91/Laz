// server.js (or scrapeLazada.js, if you rename it)

// Import necessary modules
import express from 'express';
import fetch from 'node-fetch'; // Still useful for general HTTP requests if needed, but Puppeteer will handle main page fetch
import * as cheerio from 'cheerio';
import cors from 'cors';
import puppeteer from 'puppeteer'; // Import Puppeteer

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/**
 * Scrapes a Lazada product page for its name and price using Puppeteer.
 * This approach uses a headless browser to bypass anti-bot measures and render dynamic content.
 * @param {string} url - The URL of the Lazada product page.
 * @returns {Promise<{productName: string|null, productPrice: string|null, error: string|null}>}
 * An object containing the product name, price, or an error message.
 */
async function scrapeLazadaPage(url) {
    let browser;
    try {
        // Launch a headless browser instance
        // 'headless: "new"' uses the new headless mode, which is generally more stable.
        // 'args': Add arguments for better compatibility in containerized environments like Render.
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage();

        // Set a realistic User-Agent to mimic a desktop browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36');

        // Navigate to the URL and wait for the network to be idle,
        // which often indicates that dynamic content has loaded.
        // 'waitUntil: "domcontentloaded"' or 'networkidle0' can be tried based on page loading behavior.
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 }); // Increased timeout to 60 seconds

        // Get the full HTML content of the page after it has rendered
        const html = await page.content();

        // Log a snippet of the fetched HTML for debugging purposes
        console.log("Fetched HTML snippet (from Puppeteer):", html.substring(0, 500));

        // Load the HTML into Cheerio for efficient parsing
        const $ = cheerio.load(html);

        let productName = null;
        let productPrice = null;

        // --- Product Name Extraction ---
        const productNameSelectors = [
            'h1.pdp-mod-product-title',
            'div.pdp-product-title__text',
            'span.pdp-product-title__item',
            'meta[property="og:title"]',
            'h1[data-spm="product_title"]',
            'div.product-title',
            'h1[itemprop="name"]',
            'h1.product-name',
            'div.product-detail-name' // Another potential selector
        ];

        for (const selector of productNameSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                if (selector.startsWith('meta')) {
                    const ogContent = element.attr('content');
                    if (ogContent) {
                        productName = ogContent.split(' - ')[0].trim();
                    }
                } else {
                    productName = element.text().trim();
                }
                if (productName) break;
            }
        }

        // --- Product Price Extraction ---
        const priceSelectors = [
            '.pdp-product-price',
            '.notranslate.pdp-price.pdp-price_type_normal.pdp-price_color_orange.pdp-price_size_xl',
            'span.pdp-price_type_normal',
            'div.pdp-price__main-price span',
            'span.pdp-price__text',
            '.pdp-price',
            '.current-price',
            'div.price-block span.price',
            'span[itemprop="price"]',
            'span.product-price',
            'div.product-info-price span',
            'div.price-section span.price' // Another general price container
        ];

        for (const selector of priceSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                let text = element.text().trim();
                text = text.replace(/[₫đ,.\s]/g, '');
                productPrice = text.match(/\d+/g)?.join('') || '';
                if (productPrice) break;
            }
        }

        return { productName, productPrice, error: null };

    } catch (error) {
        console.error(`Error during scraping with Puppeteer: ${error.message}`);
        return { productName: null, productPrice: null, error: error.message };
    } finally {
        if (browser) {
            await browser.close(); // Ensure the browser instance is closed
        }
    }
}

app.post('/scrape', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required in the request body.' });
    }

    console.log(`Received scrape request for URL: ${url}`);
    const result = await scrapeLazadaPage(url);

    if (result.error) {
        return res.status(500).json({ error: `Scraping failed: ${result.error}` });
    }

    res.json(result);
});

app.get('/', (req, res) => {
    res.send('Lazada Scraper API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the API at http://localhost:${PORT}/scrape`);
});
