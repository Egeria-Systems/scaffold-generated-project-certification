import { createBrowserQualityConfig } from "./playwright.config.shared";

export function parseDeployedBaseURL(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error("DEPLOYED_URL_REQUIRED");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DEPLOYED_URL_INVALID");
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" || url.password !== "" ||
    url.hash !== "" ||
    url.search !== ""
  ) {
    throw new Error("DEPLOYED_URL_INVALID");
  }

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.href;
}

const baseURL = parseDeployedBaseURL(process.env.PLAYWRIGHT_DEPLOYED_URL);

export default createBrowserQualityConfig({ baseURL });
