#!/usr/bin/env node
'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const { URL } = require('url');

const DEFAULTS = {
  maxPages: 20,
  maxFaqs: 80,
  concurrency: 2,
  requestTimeout: 12000,
  pauseMs: 400,
  minSectionChars: 180,
  browserTimeout: 20000,
  renderWithBrowser: true,
  userAgent:
    'Gaby-RAG-Fetcher/1.0 (+https://gabriella-jose.com; contact: admin@gabriella-jose.com)'
};

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const config = buildConfig(args);
    console.log(`[INFO] Starting crawl for ${config.url}`);

    const crawlResult = await crawlSite(config);
    if (crawlResult.pages.length === 0) {
      throw new Error('No pages were crawled successfully.');
    }

    const dataset = buildFaqDataset(crawlResult.pages, config);
    await writeOutput(config.outputPath, dataset);

    console.log('');
    console.log('=== FAQ DATASET READY ===');
    console.log(`File: ${config.outputPath}`);
    console.log(
      `Pages crawled: ${dataset.metrics.pagesCrawled} | FAQs: ${dataset.metrics.totalFaqs} | Estimated tokens: ${dataset.metrics.estimatedAnswerTokens}`
    );
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  return argv.reduce((acc, arg, idx) => {
    if (!arg.startsWith('--')) return acc;
    const key = arg.slice(2);
    const next = argv[idx + 1];
    if (next && !next.startsWith('--')) {
      acc[key] = next;
    } else {
      acc[key] = true;
    }
    return acc;
  }, {});
}

function buildConfig(args) {
  const start = args.url || process.env.SCRAPE_URL;
  if (!start) {
    throw new Error('A --url argument or SCRAPE_URL env variable is required.');
  }

  const normalizedStart = normalizeUrl(start);
  if (!normalizedStart) {
    throw new Error(`Unable to parse URL: ${start}`);
  }

  const origin = new URL(normalizedStart).origin;
  const spaViews = parseSpaViews(args.spaViews);
  const spaViewUrls = buildSpaViewUrls(spaViews, origin);
  const baseSeedUrls = buildSeedUrls(args.seedPaths, normalizedStart, origin);
  const seedUrls = Array.from(new Set([...baseSeedUrls, ...spaViewUrls]));
  const spaViewMap = spaViews.reduce((acc, view) => {
    acc[view.id] = view;
    return acc;
  }, {});

  return {
    url: normalizedStart,
    origin,
    siteName: args.siteName || deriveSiteName(origin),
    maxPages: toNumber(args.maxPages, DEFAULTS.maxPages),
    maxFaqs: toNumber(args.maxFaqs, DEFAULTS.maxFaqs),
    concurrency: Math.min(
      Math.max(toNumber(args.concurrency, DEFAULTS.concurrency), 1),
      5
    ),
    requestTimeout: toNumber(args.requestTimeout, DEFAULTS.requestTimeout),
    pauseMs: toNumber(args.pauseMs, DEFAULTS.pauseMs),
    minSectionChars: toNumber(args.minSectionChars, DEFAULTS.minSectionChars),
    browserTimeout: toNumber(args.browserTimeout, DEFAULTS.browserTimeout),
    renderWithBrowser:
      args.renderWithBrowser !== undefined
        ? args.renderWithBrowser !== 'false'
        : DEFAULTS.renderWithBrowser,
    seedUrls,
    spaViews,
    spaViewMap,
    userAgent: args.userAgent || DEFAULTS.userAgent,
    outputPath: path.resolve(
      process.cwd(),
      args.output || 'data/faq-dataset.json'
    )
  };
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

async function crawlSite(config) {
  const queue = [...config.seedUrls];
  const visited = new Set();
  const pages = [];

  while (queue.length > 0 && pages.length < config.maxPages) {
    const batch = queue.splice(0, config.concurrency);
    const tasks = batch.map((url) =>
      processPage(url, visited, config).catch((error) => {
        console.warn(`[WARN] Failed to process ${url}: ${error.message}`);
        return null;
      })
    );

    const results = await Promise.all(tasks);
    results
      .filter(Boolean)
      .forEach(({ page, links }) => {
        pages.push(page);

        links.forEach((link) => {
          if (
            pages.length + queue.length >= config.maxPages ||
            visited.has(link) ||
            queue.includes(link)
          ) {
            return;
          }

          if (link.startsWith(config.origin)) {
            queue.push(link);
          }
        });
      });

    if (config.pauseMs > 0) {
      await delay(config.pauseMs);
    }
  }

  return { pages };
}

async function processPage(url, visited, config) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl || visited.has(normalizedUrl)) {
    return null;
  }

  visited.add(normalizedUrl);
  const spaViewId = getSpaViewId(normalizedUrl);
  const forceBrowser = Boolean(spaViewId);
  const staticResponse = forceBrowser ? null : await fetchHtml(normalizedUrl, config);
  let page = staticResponse?.html
    ? extractPageContent(staticResponse.html, normalizedUrl, config)
    : null;

  if (
    config.renderWithBrowser &&
    (forceBrowser ||
      !page ||
      needsBrowserRender(page) ||
      (staticResponse && staticResponse.status >= 400))
  ) {
    const renderedHtml = await fetchRenderedHtml(normalizedUrl, config);
    if (renderedHtml) {
      page = extractPageContent(renderedHtml, normalizedUrl, config);
    }
  }

  if (!page) return null;

  const links = page.links || [];
  console.log(`[CRAWLED] ${normalizedUrl} (${page.sections.length} sections)`);
  return { page, links };
}

async function fetchHtml(url, config) {
  try {
    const response = await axios.get(url, {
      timeout: config.requestTimeout,
      validateStatus: () => true,
      headers: { 'User-Agent': config.userAgent }
    });
    return {
      html: typeof response.data === 'string' ? response.data : '',
      status: response.status
    };
  } catch (error) {
    return null;
  }
}

function extractPageContent(html, url, config) {
  const $ = cheerio.load(html);
  const title = cleanText($('title').first().text()) || url;
  const description =
    cleanText($('meta[name="description"]').attr('content')) || '';

  const sections = extractSections($, config.minSectionChars);
  const summary = buildSummary($, sections);
  const links = extractLinks($, url);

  return {
    url,
    title,
    description,
    summary,
    sections,
    links,
    wordCount: countWords(summary || $('body').text())
  };
}

function extractSections($, minChars) {
  const sections = [];
  $('h1, h2, h3').each((_, el) => {
    const heading = cleanText($(el).text());
    if (!heading) return;

    const chunks = [];
    let next = $(el).next();
    while (next.length > 0) {
      if (/^h[1-3]$/i.test(next[0].name)) break;
      const text = cleanText(next.text());
      if (text) chunks.push(text);
      next = next.next();
    }

    const content = chunks.join(' ');
    if (content.length < minChars) return;

    sections.push({
      heading,
      content,
      snippet: truncate(content, 320)
    });
  });
  if (sections.length === 0) {
    $('p').each((index, el) => {
      const paragraph = cleanText($(el).text());
      if (paragraph.length < minChars) return;
      sections.push({
        heading: `Key Insight ${index + 1}`,
        content: paragraph,
        snippet: truncate(paragraph, 320)
      });
    });
  }

  if (sections.length === 0) {
    const bodyText = cleanText($('body').text());
    if (bodyText.length >= minChars) {
      sections.push({
        heading: 'Site Overview',
        content: bodyText,
        snippet: truncate(bodyText, 320)
      });
    }
  }

  return sections;
}

function buildSummary($, sections) {
  const primary = sections
    .map((section) => section.content)
    .join(' ')
    .trim();
  const fallback = cleanText($('main').text()) || cleanText($('body').text());
  const text = primary.length > 250 ? primary : fallback;
  if (!text) return '';
  return truncate(text, 600);
}

function extractLinks($, baseUrl) {
  const links = new Set();
  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href');
    if (!raw || raw.startsWith('#')) return;
    if (raw.startsWith('mailto:') || raw.startsWith('tel:')) return;

    try {
      const resolved = new URL(raw, baseUrl);
      resolved.hash = '';
      const normalized = normalizeUrl(resolved.toString());
      if (normalized) {
        links.add(normalized);
      }
    } catch (error) {
      // Ignore malformed URLs
    }
  });
  return Array.from(links);
}

function needsBrowserRender(page) {
  const summaryLength = page.summary ? page.summary.length : 0;
  const wordCount = page.wordCount || 0;
  return page.sections.length === 0 && (summaryLength < 160 || wordCount < 40);
}

let puppeteerSingleton = null;
function loadPuppeteer() {
  if (puppeteerSingleton) return puppeteerSingleton;
  try {
    // eslint-disable-next-line global-require
    puppeteerSingleton = require('puppeteer');
    return puppeteerSingleton;
  } catch (error) {
    console.warn(
      '[WARN] Puppeteer is not installed. Run `npm install puppeteer` to enable JS rendering.'
    );
    return null;
  }
}

async function fetchRenderedHtml(url, config) {
  const puppeteer = loadPuppeteer();
  if (!puppeteer) return null;

  console.log(`[RENDER] Rendering ${url} via headless Chromium...`);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent(config.userAgent);
    const targetUrl = new URL(url);
    const spaViewId = targetUrl.searchParams.get('__spaView');
    const spaView =
      spaViewId && config.spaViewMap ? config.spaViewMap[spaViewId] : null;

    if (spaView) {
      await page.goto(`${targetUrl.origin}/`, {
        waitUntil: 'networkidle0',
        timeout: config.browserTimeout
      });
      await page
        .waitForSelector('.nav-button', { timeout: config.browserTimeout })
        .catch(() => {});
      const previousText = await page.evaluate(() => {
        const main = document.querySelector('main');
        return main ? main.innerText : document.body.innerText || '';
      });
      let navTriggered = false;
      if (spaView.label) {
        navTriggered = await page.evaluate((labelText) => {
          const targetLabel = (labelText || '').trim().toLowerCase();
          const buttons = Array.from(document.querySelectorAll('button'));
          const targetButton = buttons.find(
            (btn) => btn.textContent.trim().toLowerCase() === targetLabel
          );
          if (targetButton) {
            targetButton.click();
            return true;
          }
          return false;
        }, spaView.label);
      }
      if (!navTriggered) {
        await page.evaluate((path) => {
          window.history.replaceState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, `/${spaView.id}`);
      }
      await page
        .waitForFunction(
          (beforeText) => {
            const main = document.querySelector('main');
            if (!main) return false;
            const current = main.innerText || '';
            return current.trim().length > 40 && current.trim() !== beforeText;
          },
          { timeout: config.browserTimeout },
          previousText ? previousText.trim() : ''
        )
        .catch(() => {});
    } else {
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: config.browserTimeout
      });

      if (response && response.status() >= 400 && targetUrl.pathname !== '/') {
        await page.goto(`${targetUrl.origin}/`, {
          waitUntil: 'networkidle0',
          timeout: config.browserTimeout
        });
        await page.evaluate((path) => {
          window.history.pushState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, targetUrl.pathname);
        await page
          .waitForFunction(
            (path) => {
              const main = document.querySelector('main');
              const text = main ? main.innerText : document.body.innerText;
              return (
                window.location.pathname === path &&
                text &&
                text.trim().length > 40
              );
            },
            { timeout: config.browserTimeout },
            targetUrl.pathname
          )
          .catch(() => {});
      } else {
        await page
          .waitForFunction(
            () => document.body && document.body.innerText.trim().length > 40,
            { timeout: 5000 }
          )
          .catch(() => {});
      }
    }

    const content = await page.content();
    return content;
  } catch (error) {
    console.warn(
      `[WARN] Browser rendering failed for ${url}: ${error.message}`
    );
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function buildFaqDataset(pages, config) {
  const faqs = [];
  const seen = new Set();

  pages.forEach((page) => {
    if (page.summary) {
      const question = `What does the “${page.title}” page cover on ${config.siteName}?`;
      pushFaq({
        question,
        answer: page.summary,
        sourceUrl: page.url,
        tags: ['page-overview']
      });
    }

    page.sections.forEach((section) => {
      const baseHeading = section.heading.replace(/[:?]+$/g, '').trim();
      const question = `What does “${baseHeading}” highlight on ${config.siteName}?`;
      pushFaq({
        question,
        answer: section.content,
        sourceUrl: page.url,
        tags: ['section', slugify(baseHeading)]
      });
    });
  });

  const cappedFaqs = faqs.slice(0, config.maxFaqs);
  const metrics = buildMetrics(cappedFaqs, pages);

  return {
    generatedAt: new Date().toISOString(),
    source: {
      url: config.url,
      siteName: config.siteName
    },
    config: {
      maxPages: config.maxPages,
      maxFaqs: config.maxFaqs,
      minSectionChars: config.minSectionChars
    },
    metrics,
    faqs: cappedFaqs,
    crawlReport: pages.map((page) => ({
      url: page.url,
      title: page.title,
      sections: page.sections.length,
      hasSummary: Boolean(page.summary)
    }))
  };

  function pushFaq(entry) {
    const key = entry.question.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    faqs.push({
      ...entry,
      answer: truncate(entry.answer, 1200)
    });
  }
}

function buildMetrics(faqs, pages) {
  const totalWords = faqs.reduce(
    (sum, faq) => sum + countWords(faq.answer),
    0
  );

  return {
    pagesCrawled: pages.length,
    sectionsExtracted: pages.reduce(
      (sum, page) => sum + page.sections.length,
      0
    ),
    totalFaqs: faqs.length,
    avgAnswerWords: faqs.length
      ? Number((totalWords / faqs.length).toFixed(1))
      : 0,
    estimatedAnswerTokens: Math.round(totalWords * 1.3),
    coverageScore: Number(
      (faqs.length / Math.max(pages.length, 1)).toFixed(2)
    )
  };
}

async function writeOutput(outputPath, data) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
}

function cleanText(str = '') {
  return str.replace(/\s+/g, ' ').replace(/\u200B/g, '').trim();
}

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  const shortened = text.slice(0, max);
  const lastPeriod = shortened.lastIndexOf('.');
  if (lastPeriod > max * 0.6) {
    return `${shortened.slice(0, lastPeriod + 1).trim()} …`;
  }
  return `${shortened.trim()} …`;
}

function countWords(text = '') {
  const tokens = cleanText(text).split(/\s+/).filter(Boolean);
  return tokens.length;
}

function slugify(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeUrl(input) {
  try {
    const url = new URL(input);
    url.hash = '';
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch (error) {
    return null;
  }
}

function deriveSiteName(origin) {
  const hostname = new URL(origin).hostname.replace(/^www\./, '');
  return hostname
    .split('.')
    .filter(Boolean)
    .map((piece) =>
      piece
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    )
    .join(' ');
}

function buildSeedUrls(seedInput, startUrl, origin) {
  const seeds = [startUrl];
  if (seedInput) {
    seedInput
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((segment) => {
        let candidate = segment;
        if (!/^https?:\/\//i.test(segment)) {
          const relative = segment.startsWith('/') ? segment : `/${segment}`;
          candidate = new URL(relative, origin).toString();
        }
        const normalized = normalizeUrl(candidate);
        if (normalized) seeds.push(normalized);
      });
  }

  return Array.from(
    new Set(
      seeds
        .map((value) => normalizeUrl(value))
        .filter(Boolean)
    )
  );
}

function parseSpaViews(input) {
  if (!input) return [];
  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((pair) => {
      const [idPart, labelPart] = pair.split('=');
      if (!idPart || !labelPart) return null;
      const id = idPart.trim();
      const label = labelPart.trim();
      if (!id || !label) return null;
      return { id, label };
    })
    .filter(Boolean);
}

function buildSpaViewUrls(spaViews, origin) {
  return spaViews
    .map((view) => {
      const url = `${origin}/?__spaView=${encodeURIComponent(view.id)}`;
      return normalizeUrl(url);
    })
    .filter(Boolean);
}

function getSpaViewId(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('__spaView');
  } catch (error) {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
