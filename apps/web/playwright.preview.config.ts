import { createBrowserQualityConfig } from "./playwright.config.shared";

const baseURL = "http://127.0.0.1:3101";

export default createBrowserQualityConfig({
  baseURL,
  webServer: {
    command:
      "pnpm exec opennextjs-cloudflare preview -- --ip 127.0.0.1 --port 3101",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
