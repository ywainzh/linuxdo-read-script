const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  use: {
    viewport: { width: 1440, height: 960 },
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
});
