# acme-generated-project workspace guidance

- Keep user-visible and translatable application copy in validated locale content files.
- Keep accessibility copy, including skip-navigation labels, in validated locale content files.
- Keep long-form Markdown as validated data; do not convert client-editable content to executable MDX.
- Compose pages only from the source-owned registered section types; content must not name components, imports, scripts, styles, or arbitrary child trees.
- Keep presentation components pure and pass them typed data and callbacks.
- Preserve the generated Tailwind CSS and PostCSS boundary, semantic design tokens, visible focus treatment, responsive wrapping, and reduced-motion protection.
- Keep Cloudflare types and bindings in platform adapters, generated configuration, integration tests, and composition roots.
- Keep automatic quality CI read-only. Preserve the manual deployment workflow's exact-main revision guard, fixed `production` environment, least privilege, non-cancelling concurrency, pre-credential verification, deploy-only credential-bearing step, and post-deployment HTTPS browser smoke. Deployment, credentials, provider state, cleanup, and certification require separate authority.
- Keep operational telemetry stream-bounded and infrastructure-owned. Preserve disabled Cloudflare invocation logs. Do not add raw error/private fields, analytics, console interception, browser storage, or provider effects to presentation or application code.
- Preserve application-owned files unless a reviewed change explicitly replaces them.

## Test selection

- Run `pnpm run test:unit` for pure parsing and domain behavior in Node.
- Run `pnpm run test:component` for synchronous React presentation behavior in jsdom.
- Run `pnpm --dir apps/web run test:e2e:dev` for real-browser development behavior and `pnpm --dir apps/web run test:e2e:preview` for the OpenNext/workerd preview boundary. Preview E2E consumes already prepared `.open-next` output, so run the Next build followed by the OpenNext `--skipNextBuild` transform first.
- Use `pnpm run verify` for the complete static, unit, component, and build boundary. No automated result alone establishes deployment, production safety, visual quality, human usability, or WCAG conformance.
- Use `pnpm --dir apps/web run test:e2e:deployed` only with an explicitly supplied public HTTPS target. Local execution does not authorize `.github/workflows/deploy.yml`, provider access, or production mutation.
