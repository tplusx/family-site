# Anya meluhor

A restrained, dark-first family archive built with Astro. The production site is entirely static, while a small PHP endpoint sends the contact form through authenticated SMTP on a standard cPanel account.

## Architecture

- **Static Astro:** pages build to portable HTML, CSS and JavaScript. Node is never required on the web server.
- **cPanel contact handler:** `public/contact.php` is copied into the build and reads SMTP credentials stored above `public_html`.
- **Portable genealogy data:** the demo tree reads `src/data/people.json`; a future Gramps publishing script should export the same public schema after applying privacy rules.
- **Replaceable renderer:** `FamilyTree.astro` uses dependency-free SVG pan/zoom. Its JSON boundary makes replacing the renderer with Family Chart straightforward.

## Develop locally

Node is needed only on the computer where the site is edited and built:

```sh
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:4321`. PHP form delivery is not available through Astro's local server; test it after deploying to cPanel or with a local PHP-capable web server.

If an editor upgraded from an earlier version displays a stale missing-module diagnostic, close obsolete editor tabs, run `npm install`, and restart the editor's TypeScript server. This cPanel edition uses only the PHP handler for server-side mail.

## Build an uploadable ZIP

Set the real public URL in `.env`, then run:

```sh
npm run build:zip
```

This validates and builds the static site, then creates `anya-meluhor-cpanel.zip` in the project root. The ZIP contains the **contents** of `dist`, including hidden `.htaccess`, ready to extract directly into `public_html`.

The ZIP command requires the common `zip` utility. On Windows, run `npm run build`, then create a ZIP from everything *inside* `dist` and ensure `.htaccess` is included.

## First cPanel deployment

1. In cPanel **File Manager**, open your home folder (the directory containing `public_html`).
2. Upload `cpanel/contact-config.example.php`, rename it to `contact-config.php`, and edit the SMTP settings. Keep this file **beside**, never inside, `public_html`.
3. Set its permissions to `0600` if your cPanel account supports that permission.
4. Open `public_html`, remove an old deployment if appropriate, upload `anya-meluhor-cpanel.zip`, then use **Extract**.
5. Confirm `index.html`, `contact.php`, `.htaccess`, and the page folders are directly inside `public_html`—not inside another `dist` folder. An `_astro` asset folder may also be present when a build contains external assets.
6. Enable an SSL certificate in cPanel and visit the HTTPS version of the domain.
7. Submit a test contact message and check delivery plus the spam folder. SMTP failures appear in cPanel's PHP error log without exposing credentials to visitors.

If the site is installed on an addon domain whose document root is not `public_html`, place `contact-config.php` one directory above that document root. The handler deliberately looks outside the public directory.

### SMTP values

Use cPanel's **Email Accounts → Connect Devices** page to find the outgoing server and port. Usually use port `587` with `smtp_security => 'tls'`, or port `465` with `smtp_security => 'ssl'`. Use the full mailbox address as the username. The `from_email` should normally match that authenticated mailbox.

The handler validates fields, rejects cross-origin requests, uses a honeypot, limits each IP to five attempts an hour, sends plain text, and returns generic errors. It uses PHP streams and requires no Composer packages.

## Updating the site

After editing content, run `npm run build:zip` again and replace the files in the document root. Do **not** overwrite or move the private `contact-config.php`; it lives outside the deployed site.

## Publishing real genealogy data

1. Export from a private Gramps/Gramps Web database.
2. Exclude living people, private notes, exact locations and unapproved media.
3. Map records to stable public IDs and the fields in `people.json`.
4. Strip image metadata and create web-sized derivatives.
5. Validate relationship references and source links before deployment.

Never publish the raw Gramps export. Treat privacy filtering as a required build step, not a display setting.

### Converting a Gramps Web export

Gramps Web exports newline-delimited JSON (despite the `.json` extension). The reusable converter also accepts a regular JSON array and maps people, birth/death years, parent relationships, and a deterministic generation-based layout to the tree's public schema:

```sh
npm run convert:gramps -- cpanel/gramps-web-export-20260810153914.json /tmp/people.json
```

The output defaults to `src/data/people.json` when the second path is omitted. Records marked private are excluded by default; `--include-private` exists for controlled local work but its output must not be published. Gramps does not reliably identify living people, so review the generated file and remove living people, sensitive names, and unapproved details before copying it into the site.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Astro development server |
| `npm run check` | Astro and TypeScript checks |
| `npm test` | Run converter unit tests |
| `npm run convert:gramps -- <input> [output]` | Convert a Gramps Web export to the tree schema |
| `npm run build` | Validate and create `dist/` |
| `npm run build:zip` | Build and package the cPanel upload ZIP |
| `npm run preview` | Preview the static production build |

## Security notes

Apache security headers and HTTPS redirection live in `public/.htaccess`, which Astro copies to the ZIP. Some hosts disable individual Apache directives; if extraction produces a 500 error, inspect cPanel's error log and ask the host which directive is unavailable rather than deleting all protections. Keep credentials outside the document root, use a dedicated mailbox password, and never commit `contact-config.php`.
