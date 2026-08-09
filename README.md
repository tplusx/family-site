# Anya meluhor

A restrained, dark-first family archive built with Astro. It combines editorial storytelling with a small, accessible interactive genealogy explorer and a server-rendered contact endpoint.

## Architecture

- **Astro + Node adapter:** content pages are lean HTML while `/api/contact` runs on the server.
- **Portable family data:** the demo tree reads `src/data/people.json`. A future Gramps publishing script should export the same public schema after applying privacy rules.
- **Replaceable renderer:** `FamilyTree.astro` currently uses dependency-free SVG pan/zoom. Its JSON boundary makes replacing the renderer with Family Chart straightforward.
- **Private → public workflow:** keep people, media, sources and notes in private Gramps Web; export; redact living/private records; transform and copy approved media; validate; then build this site.

## Local development

```sh
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:4321`. Production builds use `npm run build` and run with `node ./dist/server/entry.mjs`.

## Contact mail

Set the SMTP variables documented in `.env.example`. Messages are validated server-side, limited to five per IP per hour, protected by a honeypot, and sent as plain text. For multi-instance production deployments, replace the in-memory limiter with a shared store such as Redis. Keep `.env` out of source control and use your platform’s secret manager.

## Publishing real genealogy data

1. Export from a private Gramps/Gramps Web database.
2. Exclude living people, private notes, exact locations and unapproved media.
3. Map records to stable public IDs and the fields in `people.json`.
4. Strip image metadata and create web-sized derivatives.
5. Validate relationship references and source links before deployment.

Never publish the raw Gramps export. Treat privacy filtering as a required build step, not a display setting.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run check` | Astro and TypeScript checks |
| `npm run build` | Validate and create the production server bundle |
| `npm run preview` | Preview the production build |

## Security and accessibility

The middleware sets a restrictive Content Security Policy, framing, MIME-sniffing, referrer and browser-permission headers. The UI includes semantic landmarks, visible focus states, keyboard-operable tree nodes, reduced-motion support and a persistent theme preference. Review CSP and rate limits when adding analytics, remote images or third-party tree libraries.
