const puppeteer = require('puppeteer');

const commands = [];
const addCommand = (url, selector, index, callback) => commands.push({url, selector, index, callback});
const mkProcessCommand = (page) => async ({url, selector, index, callback}) => {
    try {
        if (page.url() !== url) {
            await page.goto(url, {waitUntil: "networkidle2"});
        }
        await page.waitForSelector(selector);
        const items = Array.from(await page.$$(selector));
        await callback(page, items[index]);
    } catch (err) {
        console.log(err);
    }
}

(async () => {
    const url = process.env['URL'];
    if (!url) {
        console.log('Setup env URL=intickets frame url');
        return;
    }
    console.log(`Extract from ${url}`);
    const browser = await puppeteer.launch({
        args: [
          '--enable-features=ExperimentalJavaScript',
          '--lang=ru'
        ]
      });
    
    const page = await browser.newPage();
    await page.setViewport({width: 1600, height: 800});
    await page.goto(url);
    await page.waitForSelector(".card");
    const cards = await page.$$('.card');
    for (let cnt=0; cnt<cards.length; cnt++) {
        addCommand(page.url(), '.card', cnt, processCard);
    }
    let index = 0;
    const processCommand = mkProcessCommand(page);
    while(index < commands.length) {
        await processCommand(commands[index]);
        index += 1;
    }
    await browser.close();  
})();
  
async function processCard(page, cardEle) {
    await cardEle.click();
    await page.waitForSelector('.schedule');
    const shows = await page.$$('.schedule .pricing');
    for (let cnt=0; cnt<shows.length; cnt++) {
        addCommand(page.url(), '.schedule .pricing', cnt, processShow);
    }
}

function strToTitle(str) {
    const i = str.indexOf('|');
    if (i === -1) {
        return str;
    }
    return str.slice(i+1).trim();
}

function strToTime(str) {
    const arr = str.split(' ');
    const mons = ['января', 'февраля', 'марта', 'апреля' , 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
    const d = arr[1].trim();
    const t = arr[3];
    const im = mons.indexOf(arr[2].trim().slice(0, -1));
    const dd = new Date();
    const y = (dd.getMonth() <= im) ? dd.getFullYear() : dd.getFullYear() + 1;
    return `${y}-${(im+1).toString().padStart(2, '0')}-${d.padStart(2, '0')} ${t}`;
}

async function processShow(page, showEle) {
    await showEle.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('.breadcrumbs');
    const showUrl = page.url();
    const content = await page.content();
    let found = showUrl.match(/(\d+)$/);
    const id = found?.[1];
    found = content.match(/<title>([^<]+)<\/title>/im);
    const title = strToTitle(found?.[1]);
    found = content.match(/<div class=\"breadcrumbs x14\"><!----><span>([^<]+)<\/span>/im);
    const t = strToTime(found?.[1]);
    console.log(t, title, id);
}
