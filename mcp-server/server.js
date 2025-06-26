import express from 'express';
import winston from 'winston';
import cors from 'cors';
import { chromium, firefox, webkit } from 'playwright';
import { writeFileSync } from 'fs';

// ロギング設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// ブラウザインスタンス管理
const browsers = new Map();

// Express サーバー設定
const app = express();
app.use(cors());
app.use(express.json());

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    browsers: browsers.size,
    uptime: process.uptime()
  });
});

// ツール一覧エンドポイント
app.get('/tools', (req, res) => {
  const tools = [
    {
      name: 'launch_browser',
      description: 'Launch a new browser instance',
      inputSchema: {
        type: 'object',
        properties: {
          browserType: { type: 'string', enum: ['chromium', 'firefox', 'webkit'], default: 'chromium' },
          headless: { type: 'boolean', default: true },
          options: { type: 'object', default: {} }
        }
      }
    },
    {
      name: 'navigate_to',
      description: 'Navigate to a URL',
      inputSchema: {
        type: 'object',
        properties: {
          browserId: { type: 'string' },
          url: { type: 'string' }
        },
        required: ['browserId', 'url']
      }
    },
    {
      name: 'click_element',
      description: 'Click an element on the page',
      inputSchema: {
        type: 'object',
        properties: {
          browserId: { type: 'string' },
          selector: { type: 'string' }
        },
        required: ['browserId', 'selector']
      }
    },
    {
      name: 'type_text',
      description: 'Type text into an input field',
      inputSchema: {
        type: 'object',
        properties: {
          browserId: { type: 'string' },
          selector: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['browserId', 'selector', 'text']
      }
    },
    {
      name: 'get_text',
      description: 'Get text content from an element',
      inputSchema: {
        type: 'object',
        properties: {
          browserId: { type: 'string' },
          selector: { type: 'string' }
        },
        required: ['browserId', 'selector']
      }
    },
    {
      name: 'screenshot',
      description: 'Take a screenshot of the current page',
      inputSchema: {
        type: 'object',
        properties: {
          browserId: { type: 'string' },
          fullPage: { type: 'boolean', default: false }
        },
        required: ['browserId']
      }
    },
    {
      name: 'close_browser',
      description: 'Close a browser instance',
      inputSchema: {
        type: 'object',
        properties: {
          browserId: { type: 'string' }
        },
        required: ['browserId']
      }
    }
  ];
  
  res.json({ tools });
});

// ツール実行エンドポイント
app.post('/tools/execute', async (req, res) => {
  const { name, arguments: args } = req.body;
  
  try {
    let result;
    
    switch (name) {
      case 'launch_browser':
        result = await launchBrowser(args);
        break;
      case 'navigate_to':
        result = await navigateTo(args);
        break;
      case 'click_element':
        result = await clickElement(args);
        break;
      case 'type_text':
        result = await typeText(args);
        break;
      case 'get_text':
        result = await getText(args);
        break;
      case 'screenshot':
        result = await takeScreenshot(args);
        break;
      case 'close_browser':
        result = await closeBrowser(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error(`Tool execution error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ツール実装関数
async function launchBrowser(args = {}) {
  const { browserType = 'chromium', headless = true, options = {} } = args;
  
  try {
    const playwrightInstance = { chromium, firefox, webkit };
    const browser = await playwrightInstance[browserType].launch({
      headless,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps'
      ],
      ...options
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    const browserId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    browsers.set(browserId, { browser, context, page });
    
    logger.info(`Browser launched successfully: ${browserId}`);
    
    return {
      browserId,
      message: `Browser launched successfully. Browser ID: ${browserId}`
    };
  } catch (error) {
    logger.error(`Browser launch failed: ${error.message}`);
    throw new Error(`Failed to launch browser: ${error.message}`);
  }
}

async function navigateTo(args) {
  const { browserId, url } = args;
  const browserData = browsers.get(browserId);
  
  if (!browserData) {
    throw new Error(`Browser not found: ${browserId}`);
  }
  
  try {
    await browserData.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    logger.info(`Navigation successful: ${url}`);
    
    return {
      url,
      message: `Successfully navigated to: ${url}`
    };
  } catch (error) {
    logger.error(`Navigation failed: ${error.message}`);
    throw new Error(`Failed to navigate to ${url}: ${error.message}`);
  }
}

async function clickElement(args) {
  const { browserId, selector } = args;
  const browserData = browsers.get(browserId);
  
  if (!browserData) {
    throw new Error(`Browser not found: ${browserId}`);
  }
  
  try {
    await browserData.page.click(selector, { timeout: 10000 });
    logger.info(`Element clicked: ${selector}`);
    
    return {
      selector,
      message: `Successfully clicked element: ${selector}`
    };
  } catch (error) {
    logger.error(`Click failed: ${error.message}`);
    throw new Error(`Failed to click element ${selector}: ${error.message}`);
  }
}

async function typeText(args) {
  const { browserId, selector, text } = args;
  const browserData = browsers.get(browserId);
  
  if (!browserData) {
    throw new Error(`Browser not found: ${browserId}`);
  }
  
  try {
    await browserData.page.fill(selector, text, { timeout: 10000 });
    logger.info(`Text typed into ${selector}: ${text}`);
    
    return {
      selector,
      text,
      message: `Successfully typed text into: ${selector}`
    };
  } catch (error) {
    logger.error(`Type text failed: ${error.message}`);
    throw new Error(`Failed to type text into ${selector}: ${error.message}`);
  }
}

async function getText(args) {
  const { browserId, selector } = args;
  const browserData = browsers.get(browserId);
  
  if (!browserData) {
    throw new Error(`Browser not found: ${browserId}`);
  }
  
  try {
    const text = await browserData.page.textContent(selector, { timeout: 10000 });
    logger.info(`Text retrieved from ${selector}: ${text}`);
    
    return {
      selector,
      text: text || 'No text found',
      message: `Text content retrieved from ${selector}`
    };
  } catch (error) {
    logger.error(`Get text failed: ${error.message}`);
    throw new Error(`Failed to get text from ${selector}: ${error.message}`);
  }
}

async function takeScreenshot(args) {
  const { browserId, fullPage = false } = args;
  const browserData = browsers.get(browserId);
  
  if (!browserData) {
    throw new Error(`Browser not found: ${browserId}`);
  }
  
  try {
    const screenshot = await browserData.page.screenshot({
      fullPage,
      type: 'png'
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `/tmp/screenshot_${timestamp}.png`;
    writeFileSync(filename, screenshot);
    
    logger.info(`Screenshot saved: ${filename}`);
    
    return {
      filename,
      fullPage,
      message: `Screenshot saved to: ${filename}`
    };
  } catch (error) {
    logger.error(`Screenshot failed: ${error.message}`);
    throw new Error(`Failed to take screenshot: ${error.message}`);
  }
}

async function closeBrowser(args) {
  const { browserId } = args;
  const browserData = browsers.get(browserId);
  
  if (!browserData) {
    throw new Error(`Browser not found: ${browserId}`);
  }
  
  try {
    await browserData.browser.close();
    browsers.delete(browserId);
    logger.info(`Browser closed: ${browserId}`);
    
    return {
      browserId,
      message: `Successfully closed browser: ${browserId}`
    };
  } catch (error) {
    logger.error(`Browser close failed: ${error.message}`);
    throw new Error(`Failed to close browser ${browserId}: ${error.message}`);
  }
}

// ブラウザ一覧エンドポイント
app.get('/browsers', (req, res) => {
  const browserList = Array.from(browsers.keys());
  res.json({
    browsers: browserList,
    count: browserList.length
  });
});

// 正常終了のためのシグナルハンドリング
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  // 全ブラウザを閉じる
  for (const [browserId, browserData] of browsers) {
    try {
      await browserData.browser.close();
      logger.info(`Closed browser: ${browserId}`);
    } catch (error) {
      logger.error(`Error closing browser ${browserId}: ${error.message}`);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  process.exit(0);
});

// サーバー起動
const port = process.env.MCP_PORT || 8080;
app.listen(port, () => {
  logger.info(`Playwright MCP Server running on port ${port}`);
  logger.info(`Health check: http://localhost:${port}/health`);
  logger.info(`Tools list: http://localhost:${port}/tools`);
  logger.info(`Execute tools: POST http://localhost:${port}/tools/execute`);
});