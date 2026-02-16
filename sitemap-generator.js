const fs = require('fs');
const https = require('https');
const path = require('path');

const API_URL = 'https://api.fashioncarft.com/public/api';
const BASE_URL = 'https://yourdreamfashion.com';
const SITEMAP_PATH = path.join(__dirname, 'src', 'sitemap.xml');

// Static URLs
const STATIC_URLS = [
    { url: '/', changefreq: 'daily', priority: '1.0' },
    { url: '/aboutus', changefreq: 'monthly', priority: '0.5' },
    { url: '/contact-us', changefreq: 'monthly', priority: '0.5' },
    { url: '/privacy-policy', changefreq: 'monthly', priority: '0.5' },
    { url: '/term-condition', changefreq: 'monthly', priority: '0.5' },
    { url: '/return-exchange', changefreq: 'monthly', priority: '0.5' },
    { url: '/refund-and-cancellation-policy', changefreq: 'monthly', priority: '0.5' },
    { url: '/shipping-delivery', changefreq: 'monthly', priority: '0.5' },
    { url: '/account/dashboard', changefreq: 'monthly', priority: '0.5' },
    { url: '/auth/login', changefreq: 'monthly', priority: '0.5' },
    { url: '/collections', changefreq: 'weekly', priority: '0.8' },
    { url: '/blogs', changefreq: 'weekly', priority: '0.6' },
    { url: '/order/tracking', changefreq: 'monthly', priority: '0.5' },
];

function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error(`Error parsing JSON from ${url}:`, e);
                    resolve({ data: [] }); // Return empty on error to continue
                }
            });
        }).on('error', (err) => {
            console.error(`Error fetching ${url}:`, err);
            resolve({ data: [] });
        });
    });
}

async function fetchAllData(endpoint, params = '') {
    let allData = [];
    let page = 1;
    let lastPage = 1;

    console.log(`Fetching ${endpoint}...`);

    do {
        console.log(`  Fetching page ${page}...`);
        const url = `${API_URL}/${endpoint}?status=1&paginate=1000&page=${page}${params}`;
        const res = await fetchData(url);

        const data = res.data || [];
        allData = allData.concat(data);

        lastPage = res.last_page || 1;
        // console.log(`  Page ${page} done. Found ${data.length} items. Total so far: ${allData.length}`);

        page++;
    } while (page <= lastPage);

    console.log(`Finished fetching ${endpoint}. Total items: ${allData.length}`);
    return allData;
}

function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

const generateXmlUrl = (loc, lastmod, changefreq, priority) => {
    return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

async function generateSitemap() {
    try {
        console.log('Starting Sitemap Generation...');
        const date = new Date().toISOString();
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        // 1. Static URLs
        console.log(`Adding ${STATIC_URLS.length} static URLs...`);
        STATIC_URLS.forEach(item => {
            xml += '\n' + generateXmlUrl(`${BASE_URL}${item.url.toLowerCase()}`, date, item.changefreq, item.priority);
        });

        // 2. Categories
        const categories = await fetchAllData('category');
        if (Array.isArray(categories)) {
            categories.forEach(cat => {
                if (cat.slug) {
                    xml += '\n' + generateXmlUrl(`${BASE_URL}/category/${cat.slug}`, date, 'weekly', '0.8');
                }
            });
        }

        // 3. Products
        const products = await fetchAllData('product');
        if (Array.isArray(products)) {
            products.forEach(prod => {
                if (prod.slug) {
                    xml += '\n' + generateXmlUrl(`${BASE_URL}/product/${prod.slug}`, date, 'daily', '0.7');
                }
            });
        }

        // 4. Blogs
        const blogs = await fetchAllData('blog');
        if (Array.isArray(blogs)) {
            blogs.forEach(blog => {
                if (blog.slug) {
                    xml += '\n' + generateXmlUrl(`${BASE_URL}/blog/${blog.slug}`, date, 'weekly', '0.6');
                }
            });
        }

        // 5. Brands
        const brands = await fetchAllData('brand');
        if (Array.isArray(brands)) {
            brands.forEach(brand => {
                if (brand.slug) {
                    xml += '\n' + generateXmlUrl(`${BASE_URL}/brand/${brand.slug}`, date, 'monthly', '0.6');
                }
            });
        }

        xml += '\n</urlset>';

        fs.writeFileSync(SITEMAP_PATH, xml);
        console.log(`Sitemap generated successfully at ${SITEMAP_PATH}`);

    } catch (error) {
        console.error('Error generating sitemap:', error);
    }
}

generateSitemap();
