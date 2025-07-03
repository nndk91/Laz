// server.js (or scrapeLazada.js, if you rename it)

// Import necessary modules
// Express.js is a web framework for Node.js, making it easy to create APIs.
// node-fetch is used to make HTTP requests to fetch the web page content.
// cheerio is used to parse the HTML and traverse the DOM, similar to jQuery.
// cors is a middleware to enable Cross-Origin Resource Sharing.
import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import cors from 'cors'; // Import the cors middleware

const app = express();
const PORT = process.env.PORT || 10000; // Use environment variable for port or default to 10000 (matching Render logs)

// Middleware to enable CORS for all origins.
// In a production environment, you might want to restrict this to specific origins for security.
app.use(cors());

// Middleware to parse JSON bodies from incoming requests
app.use(express.json());

/**
 * Scrapes a Lazada product page for its name and price.
 * @param {string} url - The URL of the Lazada product page.
 * @returns {Promise<{productName: string|null, productPrice: string|null, error: string|null}>}
 * An object containing the product name, price, or an error message.
 */
async function scrapeLazadaPage(url) {
    try {
        // 1. Fetch the HTML content of the page
        // Add headers to mimic a browser request, which can help bypass some basic bot detection
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            }
        });

        // Check if the request was successful
        if (!response.ok) {
            return {
                productName: null,
                productPrice: null,
                error: `Failed to fetch page: ${response.status} ${response.statusText}`
            };
        }

        const html = await response.text();

        // Log a snippet of the fetched HTML for debugging purposes (remove in production)
        // console.log("Fetched HTML snippet:", html.substring(0, 500)); 

        // 2. Load the HTML into Cheerio for parsing
        const $ = cheerio.load(html);

        let productName = null;
        let productPrice = null;

        // --- Product Name Extraction ---
        // Prioritize more specific and common selectors.
        const productNameSelectors = [
            'h1.pdp-mod-product-title',
            'div.pdp-product-title__text',
            'span.pdp-product-title__item',
            'meta[property="og:title"]', // Fallback to Open Graph meta tag
            'h1[data-spm="product_title"]', // Another common pattern
            'div.product-title' // General title class
        ];

        for (const selector of productNameSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                if (selector.startsWith('meta')) {
                    const ogContent = element.attr('content');
                    if (ogContent) {
                        // Extracting only the product name part from the og:title
                        // Example: "Product Name - Brand - Lazada VN" -> "Product Name"
                        productName = ogContent.split(' - ')[0].trim();
                    }
                } else {
                    productName = element.text().trim();
                }
                if (productName) break; // Found a name, stop searching
            }
        }

        // --- Product Price Extraction ---
        // Prioritize the new selectors you provided, then other common ones.
        const priceSelectors = [
            '.pdp-product-price', // Specific class provided by user
            '.notranslate.pdp-price.pdp-price_type_normal.pdp-price_color_orange.pdp-price_size_xl', // Specific class provided by user
            'span.pdp-price_type_normal',
            'div.pdp-price__main-price span',
            'span.pdp-price__text',
            '.pdp-price',
            '.current-price', // Common price class
            'div.price-block span.price' // Another common pattern for price blocks
        ];

        for (const selector of priceSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                let text = element.text().trim();
                // Clean the price text: remove currency symbols, commas, spaces, and non-numeric characters
                // '₫' (Vietnamese dong symbol), 'đ' (another common dong representation)
                text = text.replace(/[₫đ,.\s]/g, '');
                // Ensure it's purely numeric, in case other text remains
                productPrice = text.match(/\d+/g)?.join('') || ''; // Match only digits
                if (productPrice) break; // Found a price, stop searching
            }
        }

        // Return the extracted data
        return { productName, productPrice, error: null };

    } catch (error) {
        console.error(`Error during scraping: ${error.message}`);
        return { productName: null, productPrice: null, error: error.message };
    }
}

// Define a POST API endpoint for scraping
app.post('/scrape', async (req, res) => {
    const { url } = req.body; // Get the URL from the request body

    if (!url) {
        return res.status(400).json({ error: 'URL is required in the request body.' });
    }

    console.log(`Received scrape request for URL: ${url}`);
    const result = await scrapeLazadaPage(url);

    if (result.error) {
        return res.status(500).json({ error: `Scraping failed: ${result.error}` });
    }

    res.json(result); // Send the extracted data back to the client
});

// Basic route for testing server availability
app.get('/', (req, res) => {
    res.send('Lazada Scraper API is running!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the API at http://localhost:${PORT}/scrape`);
});

