import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

if (!existsSync('dist/index.html')) throw new Error('Run the site build before creating a ZIP.');
const output = 'anya-meluhor-cpanel.zip';
rmSync(output, { force: true });
execFileSync('zip', ['-qr', `../${output}`, '.'], { cwd: 'dist', stdio: 'inherit' });
console.log(`Created ${output} — upload and extract its contents inside public_html.`);
