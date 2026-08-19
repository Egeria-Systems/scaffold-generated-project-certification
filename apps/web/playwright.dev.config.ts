import { createBrowserQualityConfig } from "./playwright.config.shared";

const baseURL = "http://127.0.0.1:3100";

export default createBrowserQualityConfig({
  baseURL,
  webServer: {
    command: "pnpm run dev --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
