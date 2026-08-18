# @tableverse-kit/docs

The [Mintlify](https://mintlify.com) documentation site for tableverse-kit.
Pages are MDX files with YAML frontmatter; navigation and theme live in
`docs.json`.

## Develop

The [Mintlify CLI](https://www.npmjs.com/package/mint) is not vendored into the
workspace (it drags in puppeteer/sharp and is only needed for local preview).
Install it globally once:

```bash
npm i -g mint
```

Then:

```bash
pnpm -C packages/docs dev            # preview at http://localhost:3000
pnpm -C packages/docs broken-links   # check for broken internal links
```

## Structure

- `docs.json` — navigation, theme, and site config
- `index.mdx` — landing page
- `learn/` — quick-start and build-your-game guides
- `reference/` — API reference (core types, authoring, runtime, testing, CLI)
- `logo/` — brand assets referenced by `docs.json`

## Deploy

Deployment is handled by Mintlify's GitHub app, which watches `docs.json` and
publishes on push to the default branch.
