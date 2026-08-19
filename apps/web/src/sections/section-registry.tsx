import {
  sectionContentSchemas,
  type CallToActionSection,
  type HeroSection,
  type PageSection,
  type ProjectListSection,
  type TextSection,
} from "../content/content-schema";

type SectionProperties<Section extends PageSection> = Readonly<{
  section: Section;
}>;

function headingIdentifier(section: PageSection): string {
  return `${section.id}--heading`;
}

function HeroSection({ section }: SectionProperties<HeroSection>) {
  const headingId = headingIdentifier(section);

  return (
    <header
      id={section.id}
      aria-labelledby={headingId}
      className="grid scroll-mt-24 gap-6 border-b border-line pb-12 pt-8 sm:pb-16 sm:pt-12"
    >
      <h1
        id={headingId}
        className="max-w-4xl text-balance text-[clamp(2.75rem,10vw,6.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-ink"
      >
        {section.content.heading}
      </h1>
      <p className="max-w-2xl text-pretty text-lg leading-8 text-muted sm:text-xl">
        {section.content.summary}
      </p>
    </header>
  );
}

function TextSection({ section }: SectionProperties<TextSection>) {
  const headingId = headingIdentifier(section);

  return (
    <section
      id={section.id}
      aria-labelledby={headingId}
      className="grid scroll-mt-24 gap-4"
    >
      <h2
        id={headingId}
        className="max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
      >
        {section.content.heading}
      </h2>
      <p className="max-w-2xl text-lg leading-8 text-muted">
        {section.content.body}
      </p>
    </section>
  );
}

function ProjectListSection({
  section,
}: SectionProperties<ProjectListSection>) {
  const headingId = headingIdentifier(section);

  return (
    <section
      id={section.id}
      aria-labelledby={headingId}
      className="grid scroll-mt-24 gap-8"
    >
      <h2
        id={headingId}
        className="max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
      >
        {section.content.heading}
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {section.content.projects.map((project) => (
          <li key={project.href}>
            <article className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <h3>
                <a
                  href={project.href}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center text-xl font-semibold text-accent underline decoration-2 underline-offset-4 hover:text-accent-hover"
                >
                  {project.title}
                </a>
              </h3>
              <p className="leading-7 text-muted">{project.summary}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CallToActionSection({
  section,
}: SectionProperties<CallToActionSection>) {
  const headingId = headingIdentifier(section);

  return (
    <section
      id={section.id}
      aria-labelledby={headingId}
      className="grid scroll-mt-24 gap-5 rounded-3xl bg-accent p-6 text-accent-contrast sm:p-10"
    >
      <h2
        id={headingId}
        className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        {section.content.heading}
      </h2>
      <p className="max-w-2xl text-lg leading-8">{section.content.summary}</p>
      <a
        href={section.content.href}
        className="inline-flex min-h-12 min-w-11 w-fit items-center justify-center rounded-md bg-accent-contrast py-3 pe-5 ps-5 font-semibold text-accent underline decoration-2 underline-offset-4 hover:bg-surface hover:text-accent-hover"
      >
        {section.content.label}
      </a>
    </section>
  );
}

const defaultVariants = Object.freeze(["default"]);
const supportedProfiles = Object.freeze(["portfolio", "site"]);
const noAnalyticsDeclarations = Object.freeze([]);
const noMigrationHooks = Object.freeze([]);

export const sectionRegistry = Object.freeze({
  hero: Object.freeze({
    type: "hero",
    contentSchemaVersion: "1.0.0",
    contentSchema: sectionContentSchemas.hero,
    approvedVariants: defaultVariants,
    Component: HeroSection,
    supportedProfiles,
    accessibilityRequirements: Object.freeze(["page-heading-level-one"]),
    analyticsDeclarations: noAnalyticsDeclarations,
    migrationHooks: noMigrationHooks,
  }),
  text: Object.freeze({
    type: "text",
    contentSchemaVersion: "1.0.0",
    contentSchema: sectionContentSchemas.text,
    approvedVariants: defaultVariants,
    Component: TextSection,
    supportedProfiles,
    accessibilityRequirements: Object.freeze(["section-heading-level-two"]),
    analyticsDeclarations: noAnalyticsDeclarations,
    migrationHooks: noMigrationHooks,
  }),
  "project-list": Object.freeze({
    type: "project-list",
    contentSchemaVersion: "1.0.0",
    contentSchema: sectionContentSchemas["project-list"],
    approvedVariants: defaultVariants,
    Component: ProjectListSection,
    supportedProfiles,
    accessibilityRequirements: Object.freeze([
      "section-heading-level-two",
      "project-list-semantics",
      "descriptive-link-labels",
    ]),
    analyticsDeclarations: noAnalyticsDeclarations,
    migrationHooks: noMigrationHooks,
  }),
  "call-to-action": Object.freeze({
    type: "call-to-action",
    contentSchemaVersion: "1.0.0",
    contentSchema: sectionContentSchemas["call-to-action"],
    approvedVariants: defaultVariants,
    Component: CallToActionSection,
    supportedProfiles,
    accessibilityRequirements: Object.freeze([
      "section-heading-level-two",
      "descriptive-link-labels",
    ]),
    analyticsDeclarations: noAnalyticsDeclarations,
    migrationHooks: noMigrationHooks,
  }),
});

const ProjectListComponent = sectionRegistry["project-list"].Component;
const CallToActionComponent = sectionRegistry["call-to-action"].Component;

export type SectionCompositionProperties = Readonly<{
  sections: readonly PageSection[];
}>;

function assertNever(value: never): never {
  void value;
  throw new TypeError("SECTION_TYPE_UNREACHABLE");
}

function renderSection(section: PageSection) {
  switch (section.type) {
    case "hero":
      return <sectionRegistry.hero.Component key={section.id} section={section} />;
    case "text":
      return <sectionRegistry.text.Component key={section.id} section={section} />;
    case "project-list":
      return <ProjectListComponent key={section.id} section={section} />;
    case "call-to-action":
      return <CallToActionComponent key={section.id} section={section} />;
    default:
      return assertNever(section);
  }
}

export function SectionComposition({
  sections,
}: SectionCompositionProperties) {
  return sections.filter(({ enabled }) => enabled).map(renderSection);
}
