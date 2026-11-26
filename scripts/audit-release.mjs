/** Offline release checks: shipped assets, provenance and source export boundaries. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const json = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const manifest = json('public/art/manifest.json');
const assets = Array.isArray(manifest.assets) ? manifest.assets : Object.values(manifest.assets);
const problems = [];
const artCredits = json('public/licenses/art-sources.json');
const creditedArt = new Set(artCredits.assets.map((asset) => asset.id));
for (const [id, asset] of Object.entries(manifest.assets)) {
  const credit = artCredits.assets.find((entry) => entry.id === id);
  if (!credit || credit.file !== asset.file) problems.push(`Missing or outdated illustration source: ${id}`);
}
for (const id of creditedArt) if (!manifest.assets[id]) problems.push(`Credits include unused illustration: ${id}`);
for (const asset of assets) if (asset.file && !existsSync(resolve(root, 'public/art', asset.file))) problems.push(`Missing illustrated file: ${asset.file}`);
// Generated inventory images are imported by Vite rather than listed in the world atlas.
const generated = json('public/licenses/generated-details.json');
for (const asset of generated.assets) {
  if (!existsSync(resolve(root, asset.file))) problems.push(`Missing generated detail: ${asset.id}`);
  if (existsSync(resolve(root, asset.file)) && createHash('sha256').update(readFileSync(resolve(root, asset.file))).digest('hex') !== asset.sha256) problems.push(`Outdated generated detail: ${asset.id}`);
  if (!asset.prompt || !asset.original_sha256 || !asset.sha256) problems.push(`Missing generation provenance: ${asset.id}`);
}
const ledger = readFileSync(resolve(root, 'CREDITS.md'), 'utf8');
const sfxSource = readFileSync(resolve(root, 'src/game/audio/sfxManifest.ts'), 'utf8');
const soundFiles = [...sfxSource.matchAll(/['"]([^'"\n]+\.m4a)['"]/g)].map((match) => match[1]);
for (const [, name, count] of sfxSource.matchAll(/alternates\('([^']+)', (\d+)/g)) for (let i = 1; i <= Number(count); i++) soundFiles.push(`fx/${name}-${i}.m4a`);
for (const [, name] of sfxSource.matchAll(/bed\('([^']+)'/g)) soundFiles.push(`bed/${name}.m4a`);
for (const folder of ['fx', 'bed', 'spot']) for (const file of readdirSync(resolve(root, 'public/audio/sfx', folder))) if (file.endsWith('.m4a') && !soundFiles.includes(`${folder}/${file}`)) problems.push(`Unreferenced sound: ${folder}/${file}`);
for (const file of new Set(soundFiles)) {
  if (!existsSync(resolve(root, 'public/audio/sfx', file))) problems.push(`Missing sound: ${file}`);
  if (!ledger.includes('`audio/sfx/' + file + '`')) problems.push(`Uncredited sound: ${file}`);
}
const pkg = json('package.json');
for (const path of pkg.files ?? []) if (/^(asset-studio|assets|art\/|public\/audio\/music|\.env|\.venv|node_modules)/.test(path)) problems.push(`Private asset workspace in source export: ${path}`);
for (const notice of ['CREDITS.md', 'LICENSE', 'LICENSE-ASSETS.md']) if (!pkg.files?.includes(notice)) problems.push(`Source export must include ${notice}.`);
// Both distributions carry the actual grants, not just links to an external site.
const codeLicense = 'PolyForm-Noncommercial-1.0.0';
if (pkg.license !== codeLicense || json('package-lock.json').packages[''].license !== codeLicense) problems.push('Root package and lockfile licence metadata must agree.');
const codeNotice = readFileSync(resolve(root, 'public/licenses/PolyForm-Noncommercial-1.0.0.txt'), 'utf8');
if (!codeNotice.includes('Required Notice: Copyright (c) 2026 Nic Pittman') || !codeNotice.includes('## Noncommercial Purposes')) problems.push('Missing code licence or required copyright notice.');
if (!readFileSync(resolve(root, 'LICENSE'), 'utf8').endsWith(codeNotice.slice(codeNotice.indexOf('# PolyForm')))) problems.push('Root and shipped code licence texts differ.');
if (!readFileSync(resolve(root, 'public/licenses/CC-BY-NC-4.0.txt'), 'utf8').startsWith('Attribution-NonCommercial 4.0 International')) problems.push('Missing complete creative asset licence.');
if (!existsSync(resolve(root, 'public/licenses/ASSET-TERMS.md'))) problems.push('Playable build needs creative asset scope and exceptions.');
for (const record of [artCredits, generated, json('public/licenses/resource-icons.json')]) if (record.license !== 'CC-BY-NC-4.0') problems.push('Project illustration ledger has outdated licence terms.');
// UI resources are bundled, with their source image hashes retained in the ledger.
const resources = json('public/licenses/resource-icons.json');
for (const asset of resources.assets) {
  if (!existsSync(resolve(root, asset.file)) || !asset.prompt || !asset.original_sha256) problems.push(`Missing resource icon/provenance: ${asset.id}`);
}
if (!existsSync(resolve(root, 'public/licenses/Cormorant-Garamond-OFL.txt'))) problems.push('The bundled typeface needs its OFL licence.');

if (process.argv.includes('--dist')) {
  const dist = resolve(root, 'dist');
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)]);
  const all = files(dist);
  const publicFiles = new Set(['index.html', 'manifest.webmanifest', 'art/manifest.json']);
  for (const asset of assets) publicFiles.add(`art/${asset.file}`);
  for (const id of ['sora', 'ren', 'mina', 'haru', 'aki', 'yui']) publicFiles.add(`art/portraits/${id}.webp`);
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  for (const [, path] of html.matchAll(/%BASE_URL%([^"']+)/g)) publicFiles.add(path);
  for (const icon of json('public/manifest.webmanifest').icons) publicFiles.add(icon.src);
  for (const file of new Set(soundFiles)) publicFiles.add(`audio/sfx/${file}`);
  for (const file of ['theme.m4a', 'summer.m4a', 'winter.m4a']) if (existsSync(resolve(root, 'public/audio/music', file))) publicFiles.add(`audio/music/${file}`);
  for (const file of readdirSync(resolve(root, 'public/licenses'))) publicFiles.add(`licenses/${file}`);
  const allowedBundle = /^assets\/(js\/[^/]+\.js|css\/[^/]+\.css|fonts\/[^/]+\.woff2|ui\/[^/]+\.(png|webp|svg))$/;
  for (const file of all) {
    const path = relative(dist, file).replaceAll('\\', '/');
    if (!publicFiles.has(path) && !allowedBundle.test(path)) problems.push(`Unexpected release file: ${path}`);
    if (/\.map$|\.DS_Store|(^|\/)\.env|(^|\/)(archive|source|shots|node_modules)\//.test(path)) problems.push(`Private/development file in release: ${path}`);
    if (['.css', '.js'].includes(extname(file))) {
      const text = readFileSync(file, 'utf8');
      const refs = extname(file) === '.css' ? [...text.matchAll(/url\((?:["']?)([^)"']+)(?:["']?)\)/g)].map((m) => m[1])
        : [...text.matchAll(/["']((?:\.\.?\/)[^"'\s]+\.(?:js|css|woff2|png|webp))["']/g)].map((m) => m[1]);
      for (const ref of refs) if (!/^(data:|https?:|#)/.test(ref) && !existsSync(resolve(dirname(file), ref))) problems.push(`Broken bundled reference: ${path} -> ${ref}`);
    }
  }
  for (const path of publicFiles) if (!existsSync(resolve(dist, path))) problems.push(`Missing release file: ${path}`);
  const size = all.reduce((n, file) => n + statSync(file).size, 0);
  if (size > 20_000_000) problems.push(`Release exceeds 20 MB uncompressed: ${(size / 1e6).toFixed(2)} MB`);
  console.log(`Release inventory: ${all.length} files, ${(size / 1e6).toFixed(2)} MB; relative bundle links, runtime allowlist and size budget checked.`);
}
if (problems.length) { process.stderr.write(problems.join('\n') + '\n'); process.exitCode = 1; }
else process.stdout.write(`Asset audit passed: ${assets.length} manifest entries, ${new Set(soundFiles).size} sound files; source export excludes generators, source images, secrets and music.\n`);
