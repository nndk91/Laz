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
const PORT = process.env.PORT || 3000; // Use environment variable for port or default to 3000

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
        const response = await fetch(url);

        // Check if the request was successful
        if (!response.ok) {
            return {
                productName: null,
                productPrice: null,
                error: `Failed to fetch page: ${response.status} ${response.statusText}`
            };
        }

        const html = await response.text();

        // 2. Load the HTML into Cheerio for parsing
        const $ = cheerio.load(html);

        let productName = null;
        let productPrice = null;

        // --- Product Name Extraction ---
        // Try common Lazada product title selectors.
        // Lazada's HTML structure can change, so multiple selectors are attempted.
        productName = $('h1.pdp-mod-product-title').text().trim();
        if (!productName) {
            productName = $('div.pdp-product-title__text').text().trim();
        }
        // Fallback to Open Graph meta tag if direct selectors fail
        if (!productName) {
            const ogTitle = $('meta[property="og:title"]').attr('content');
            if (ogTitle) {
                // Extracting only the product name part from the og:title
                // Example: "Product Name - Brand - Lazada VN" -> "Product Name"
                productName = ogTitle.split(' - ')[0].trim();
            }
        }

        // --- Product Price Extraction ---
        // Try common Lazada price selectors.
        // Similar to product name, multiple selectors for robustness.
        let priceText = null;
        priceText = $('span.pdp-price_type_normal').text().trim();
        if (!priceText) {
            priceText = $('div.pdp-price__main-price span').text().trim();
        }
        if (!priceText) {
            priceText = $('span.pdp-price__text').text().trim();
        }
        if (!priceText) {
            priceText = $('.pdp-price').text().trim();
        }

        if (priceText) {
            // Clean the price text: remove currency symbols, commas, spaces, and non-numeric characters
            // '₫' (Vietnamese dong symbol), 'đ' (another common dong representation)
            productPrice = priceText.replace(/[₫đ,.\s]/g, '');
            // Ensure it's purely numeric, in case other text remains
            productPrice = productPrice.match(/\d+/g)?.join('') || ''; // Match only digits
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

