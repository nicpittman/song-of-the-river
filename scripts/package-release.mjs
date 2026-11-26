/** Build, verify and package the playable game. Review/source art never enters the ZIP. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
execFileSync('node', ['scripts/audit-release.mjs', '--dist'], { cwd: root, stdio: 'inherit' });
const out = join(root, 'releases');
mkdirSync(out, { recursive: true });
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const label = `v${version.replace(/\.0$/, '')}`;
const filename = `song-of-the-river-${label}-web.zip`;
const archive = join(out, filename);
execFileSync('python3', ['-c', `
from pathlib import Path
import zipfile,sys
root=Path(sys.argv[1]); output=Path(sys.argv[2]); temporary=output.with_suffix('.tmp.zip')
with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in sorted(root.rglob('*')):
  if not f.is_file(): continue
  name=f.relative_to(root).as_posix()
  if f.is_symlink(): raise RuntimeError('Release contains a symlink: '+name)
  info=zipfile.ZipInfo(name,date_time=(2000,1,1,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
  z.writestr(info,f.read_bytes(),compresslevel=9)
with zipfile.ZipFile(temporary) as z:
 if 'index.html' not in z.namelist(): raise RuntimeError('The game entry point must be at ZIP root')
 if z.testzip(): raise RuntimeError('ZIP integrity check failed')
temporary.replace(output)
`, join(root, 'dist'), archive], { stdio: 'inherit' });
const bytes = readFileSync(archive);
if (bytes.length > 18_000_000) throw new Error(`Release exceeds the 18 MB ZIP budget: ${(bytes.length / 1e6).toFixed(2)} MB`);
copyFileSync(archive, join(out, 'song-of-the-river-web.zip'));
const report = { version, label, file: filename, bytes: bytes.length, mb: +(bytes.length / 1e6).toFixed(2), sha256: createHash('sha256').update(bytes).digest('hex') };
writeFileSync(join(out, 'release-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Playable ZIP: releases/${report.file} · ${report.mb} MB · SHA-256 ${report.sha256}`);
