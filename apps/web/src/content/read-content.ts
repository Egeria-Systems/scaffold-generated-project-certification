import contentConfigurationSource from "../../content/content.config.yaml";
import introductionContentSource from "../../content/en-CA/long-form/introduction.md";
import siteContentSource from "../../content/en-CA/site.yaml";

import {
  parseContentConfiguration,
  parseMarkdownContent,
  parseSiteContent,
  parseYamlContent,
  type ContentConfiguration,
  type LongFormDocument,
  type SiteContent,
} from "./content-schema";

export function readContentConfiguration(): ContentConfiguration {
  return parseContentConfiguration(
    parseYamlContent(contentConfigurationSource),
  );
}

export function readIntroductionContent(): LongFormDocument {
  return parseMarkdownContent(introductionContentSource);
}

export function readSiteContent(): SiteContent {
  return parseSiteContent(parseYamlContent(siteContentSource));
}
