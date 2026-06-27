const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyName, brandColor, logoBase64, summaryText, website } = req.body || {};

  if (!companyName || !brandColor || !summaryText) {
    return res.status(400).json({ error: 'Missing required fields: companyName, brandColor, summaryText' });
  }

  const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
  if (!hexRegex.test(brandColor)) {
    return res.status(400).json({ error: 'Invalid brand color format' });
  }

  let browser;
  try {
    const isVercel = !!process.env.VERCEL;
    browser = await puppeteer.launch({
      args: isVercel ? [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'] : chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: isVercel ? await chromium.executablePath() : undefined,
      headless: 'new',
    });

    const page = await browser.newPage();
    const logoHtml = logoBase64
      ? `<img class="logo" src="data:image/png;base64,${logoBase64}" alt="Logo" />`
      : '';

    const safeSummary = (summaryText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    const safeCompany = (companyName || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const safeWebsite = (website || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
    body { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; color: #111; margin: 0; padding: 40px; }
    .accent-bar { background: ${brandColor}; height: 6px; border-radius: 3px; margin-bottom: 24px; }
    .logo { max-height: 60px; max-width: 180px; object-fit: contain; margin-bottom: 24px; }
    .header { font-size: 12px; font-weight: 600; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.08em; }
    .company { font-size: 22px; font-weight: 600; color: #111; margin-bottom: 20px; }
    .section-title { font-size: 13px; font-weight: 600; color: ${brandColor}; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .summary { font-size: 14px; line-height: 1.65; color: #333; }
    .footer { margin-top: 60px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  ${logoHtml}
  <div class="header">Performance Report</div>
  <div class="company">${safeCompany}</div>
  <div class="section-title">Summary</div>
  <div class="summary">${safeSummary}</div>
  <div class="footer">Prepared for ${safeCompany}${safeWebsite ? ' | ' + safeWebsite : ''}</div>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="clearview-report.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(Buffer.from(pdfBuffer));
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('PDF generation error:', err);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
  }
};
