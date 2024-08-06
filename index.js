const puppeteer = require('puppeteer');
const schedule = require('node-schedule');

const {product_url, pushBullet_token, target_price} = require('./config');

const getData = async () => {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await page.goto(product_url);
    await page.waitForSelector('#fiyatlar');

    const getPrices = await page.evaluate(() => {
        const items = [];
        let cheapest = null;

        document.querySelectorAll('.fiyat a.git').forEach(el => {
            const seller = el.querySelector('span img').getAttribute('alt');
            const price = Number(el.querySelector('.urun_fiyat').innerText.trim().replace('\n', ' ').split(',')[0].replace('.', ''));
            const url = decodeURIComponent(el.getAttribute('data-link'));

            if (seller && price && url) {
                items.push({
                    seller,
                    price,
                    url,
                });

                cheapest = items[0];
            }
        });

        return {items, cheapest};
    });

    await browser.close();

    return getPrices;
}

const sendNotification = async (ctx, id) => {
    const res = await fetch('https://api.pushbullet.com/v2/pushes', {
        body: JSON.stringify({
            title: 'Discount!',
            body: id === 0 ? `The product you've been waiting for is on sale.\n\nSeller: ${ctx.seller}\nPrice: ₺${ctx.price}\nLink: ${ctx.url}`
                : `${ctx.map(p => `Seller: ${p.seller}\nPrice: ₺${p.price}\nLink: ${p.url}`).join('\n\n')}`,
            description: 'test',
            type: 'note',
        }),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Access-Token': pushBullet_token,
        }
    });
    const data = await res.json();

    if (data.iden) {
        console.log('Notification sent!');
    } else {
        console.log('Something went wrong!');
    }
}

schedule.scheduleJob('*/31 * * * *', async () => {
    try {
        const products = (await getData()).items;

        await sendNotification(products, 1);
    } catch (e) {
        console.error('Error in scheduled job:', e);
    }
});

schedule.scheduleJob('*/6 * * * *', async () => {
    try {
        const cheapest = (await getData()).cheapest;
        const cheapestPrice = cheapest.price;

        if (target_price >= cheapestPrice) {
            await sendNotification(cheapest, 0);
        }
    } catch (e) {
        console.error('Error in scheduled job:', e);
    }
});
