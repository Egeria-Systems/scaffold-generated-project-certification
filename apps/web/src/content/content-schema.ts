import { parseDocument } from "yaml";

export type NavigationItem = Readonly<{
  href: string;
  label: string;
}>;

type SectionBase<Type extends string, Content> = Readonly<{
  id: string;
  type: Type;
  variant: "default";
  enabled: boolean;
  content: Content;
}>;

export type HeroSectionContent = Readonly<{
  heading: string;
  summary: string;
}>;

export type TextSectionContent = Readonly<{
  heading: string;
  body: string;
}>;

export type ProjectListSectionContent = Readonly<{
  heading: string;
  projects: readonly Readonly<{
    title: string;
    summary: string;
    href: string;
  }>[];
}>;

export type CallToActionSectionContent = Readonly<{
  heading: string;
  summary: string;
  label: string;
  href: string;
}>;

export type HeroSection = SectionBase<"hero", HeroSectionContent>;
export type TextSection = SectionBase<"text", TextSectionContent>;
export type ProjectListSection = SectionBase<
  "project-list",
  ProjectListSectionContent
>;
export type CallToActionSection = SectionBase<
  "call-to-action",
  CallToActionSectionContent
>;

export type PageSection =
  | HeroSection
  | TextSection
  | ProjectListSection
  | CallToActionSection;

export type ContentConfiguration = Readonly<{
  schemaVersion: "1.0.0";
  defaultLocale: "en-CA";
  locales: readonly ["en-CA"];
}>;

export type LongFormDocument = Readonly<{
  frontMatter: Readonly<{
    title: string;
    summary: string;
  }>;
  body: string;
}>;

export type PageContent = Readonly<{
  sections: readonly PageSection[];
}>;

export type SiteContent = Readonly<{
  metadata: Readonly<{
    title: string;
    description: string;
  }>;
  accessibility: Readonly<{
    skipToContent: string;
  }>;
  home: PageContent;
  navigation: readonly NavigationItem[];
}>;

export function isUnknownRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
}

export function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !hasDisallowedControlCharacter(value)
  );
}

function isSectionIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 63 &&
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)
  );
}

function hasDisallowedControlCharacter(value: string): boolean {
  for (const character of value) {
    const codeUnit = character.charCodeAt(0);

    if (
      codeUnit <= 0x08 ||
      codeUnit === 0x0b ||
      codeUnit === 0x0c ||
      (codeUnit >= 0x0e && codeUnit <= 0x1f) ||
      (codeUnit >= 0x7f && codeUnit <= 0x9f)
    ) {
      return true;
    }
  }

  return false;
}

function hasUrlNormalizationWhitespace(value: string): boolean {
  return /[\u0009-\u000d\u0020]/u.test(value);
}

function isSafeHref(value: unknown): value is string {
  if (!isNonEmptyString(value) || hasUrlNormalizationWhitespace(value)) {
    return false;
  }

  if (value.startsWith("/")) {
    return !value.startsWith("//") && !value.includes("\\");
  }

  if (value.startsWith("#")) {
    return value.length > 1;
  }

  try {
    const destination = new URL(value);

    if (destination.protocol === "https:") {
      return destination.username.length === 0 && destination.password.length === 0;
    }

    return destination.protocol === "mailto:" && destination.pathname.length > 0;
  } catch {
    return false;
  }
}

export function parseYamlContent(source: string): unknown {
  try {
    const document = parseDocument(source, {
      version: "1.2",
      schema: "core",
      resolveKnownTags: false,
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
    });

    if (document.errors.length > 0 || document.warnings.length > 0) {
      throw new TypeError("CONTENT_INVALID");
    }

    return document.toJS({ maxAliasCount: 0, mapAsMap: false }) as unknown;
  } catch {
    throw new TypeError("CONTENT_INVALID");
  }
}

export function parseContentConfiguration(
  value: unknown,
): ContentConfiguration {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "defaultLocale", "locales"]) ||
    value.schemaVersion !== "1.0.0" ||
    value.defaultLocale !== "en-CA" ||
    !Array.isArray(value.locales) ||
    value.locales.length !== 1 ||
    value.locales[0] !== "en-CA"
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return {
    schemaVersion: "1.0.0",
    defaultLocale: "en-CA",
    locales: ["en-CA"],
  };
}

export function parseMarkdownContent(source: string): LongFormDocument {
  const normalizedSource = source
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");

  if (hasDisallowedControlCharacter(normalizedSource)) {
    throw new TypeError("CONTENT_INVALID");
  }

  const lines = normalizedSource.split("\n");
  const closingDelimiterIndex = lines.indexOf("---", 1);

  if (lines[0] !== "---" || closingDelimiterIndex < 2) {
    throw new TypeError("CONTENT_INVALID");
  }

  const frontMatterValue = parseYamlContent(
    `${lines.slice(1, closingDelimiterIndex).join("\n")}\n`,
  );
  const body = lines.slice(closingDelimiterIndex + 1).join("\n").trim();

  if (
    !isUnknownRecord(frontMatterValue) ||
    !hasExactKeys(frontMatterValue, ["title", "summary"]) ||
    !isNonEmptyString(frontMatterValue.title) ||
    !isNonEmptyString(frontMatterValue.summary) ||
    body.length === 0
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return {
    frontMatter: {
      title: frontMatterValue.title,
      summary: frontMatterValue.summary,
    },
    body,
  };
}

function parseHeroSectionContent(value: unknown): HeroSectionContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["heading", "summary"]) ||
    !isNonEmptyString(value.heading) ||
    !isNonEmptyString(value.summary)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return { heading: value.heading, summary: value.summary };
}

function parseTextSectionContent(value: unknown): TextSectionContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["heading", "body"]) ||
    !isNonEmptyString(value.heading) ||
    !isNonEmptyString(value.body)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return { heading: value.heading, body: value.body };
}

function parseProjectListSectionContent(
  value: unknown,
): ProjectListSectionContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["heading", "projects"]) ||
    !isNonEmptyString(value.heading) ||
    !Array.isArray(value.projects) ||
    value.projects.length === 0
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  const projects: ProjectListSectionContent["projects"][number][] = [];
  const projectDestinations = new Set<string>();

  for (const project of value.projects) {
    if (
      !isUnknownRecord(project) ||
      !hasExactKeys(project, ["title", "summary", "href"]) ||
      !isNonEmptyString(project.title) ||
      !isNonEmptyString(project.summary) ||
      !isSafeHref(project.href) ||
      projectDestinations.has(project.href)
    ) {
      throw new TypeError("CONTENT_INVALID");
    }

    projectDestinations.add(project.href);
    projects.push({
      title: project.title,
      summary: project.summary,
      href: project.href,
    });
  }

  return { heading: value.heading, projects };
}

function parseCallToActionSectionContent(
  value: unknown,
): CallToActionSectionContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["heading", "summary", "label", "href"]) ||
    !isNonEmptyString(value.heading) ||
    !isNonEmptyString(value.summary) ||
    !isNonEmptyString(value.label) ||
    !isSafeHref(value.href)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return {
    heading: value.heading,
    summary: value.summary,
    label: value.label,
    href: value.href,
  };
}

export const sectionContentSchemas = Object.freeze({
  hero: parseHeroSectionContent,
  text: parseTextSectionContent,
  "project-list": parseProjectListSectionContent,
  "call-to-action": parseCallToActionSectionContent,
});

function parsePageSection(value: unknown): PageSection {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["id", "type", "variant", "enabled", "content"]) ||
    !isSectionIdentifier(value.id) ||
    value.variant !== "default" ||
    typeof value.enabled !== "boolean"
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  switch (value.type) {
    case "hero":
      return {
        id: value.id,
        type: value.type,
        variant: value.variant,
        enabled: value.enabled,
        content: sectionContentSchemas.hero(value.content),
      };
    case "text":
      return {
        id: value.id,
        type: value.type,
        variant: value.variant,
        enabled: value.enabled,
        content: sectionContentSchemas.text(value.content),
      };
    case "project-list":
      return {
        id: value.id,
        type: value.type,
        variant: value.variant,
        enabled: value.enabled,
        content: sectionContentSchemas["project-list"](value.content),
      };
    case "call-to-action":
      return {
        id: value.id,
        type: value.type,
        variant: value.variant,
        enabled: value.enabled,
        content: sectionContentSchemas["call-to-action"](value.content),
      };
    default:
      throw new TypeError("CONTENT_INVALID");
  }
}

export function parsePageContent(value: unknown): PageContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["sections"]) ||
    !Array.isArray(value.sections) ||
    value.sections.length === 0
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  const sections: PageSection[] = [];
  const identifiers = new Set<string>();
  let enabledHeroCount = 0;

  for (const sectionValue of value.sections) {
    const section = parsePageSection(sectionValue);

    if (identifiers.has(section.id)) {
      throw new TypeError("CONTENT_INVALID");
    }

    identifiers.add(section.id);
    if (section.type === "hero" && section.enabled) {
      enabledHeroCount += 1;
    }
    sections.push(section);
  }

  const firstEnabledSection = sections.find(({ enabled }) => enabled);
  if (enabledHeroCount !== 1 || firstEnabledSection?.type !== "hero") {
    throw new TypeError("CONTENT_INVALID");
  }

  return { sections };
}

function parseNavigation(value: unknown): readonly NavigationItem[] {
  if (!Array.isArray(value)) {
    throw new TypeError("CONTENT_INVALID");
  }

  const navigation: NavigationItem[] = [];
  const hrefs = new Set<string>();

  for (const item of value) {
    if (
      !isUnknownRecord(item) ||
      !hasExactKeys(item, ["href", "label"]) ||
      !isSafeHref(item.href) ||
      !isNonEmptyString(item.label) ||
      hrefs.has(item.href)
    ) {
      throw new TypeError("CONTENT_INVALID");
    }

    hrefs.add(item.href);
    navigation.push({ href: item.href, label: item.label });
  }

  return navigation;
}

export function parseSiteContent(value: unknown): SiteContent {
  if (
    !isUnknownRecord(value) ||
    !hasExactKeys(value, ["metadata", "accessibility", "home", "navigation"]) ||
    !isUnknownRecord(value.metadata) ||
    !hasExactKeys(value.metadata, ["title", "description"]) ||
    !isNonEmptyString(value.metadata.title) ||
    !isNonEmptyString(value.metadata.description) ||
    !isUnknownRecord(value.accessibility) ||
    !hasExactKeys(value.accessibility, ["skipToContent"]) ||
    !isNonEmptyString(value.accessibility.skipToContent)
  ) {
    throw new TypeError("CONTENT_INVALID");
  }

  return {
    metadata: {
      title: value.metadata.title,
      description: value.metadata.description,
    },
    accessibility: {
      skipToContent: value.accessibility.skipToContent,
    },
    home: parsePageContent(value.home),
    navigation: parseNavigation(value.navigation),
  };
}
