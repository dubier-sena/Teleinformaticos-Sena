"""Prepare pinned dependencies only inside this workspace; no global install."""
from pathlib import Path
import hashlib,json,platform,subprocess,tarfile,os
ROOT=Path(__file__).resolve().parents[2]
RUNTIME=ROOT.parents[1]/'.runtime-v6'
meta=json.loads((ROOT/'v6/emulators/dependencies.json').read_text())
if platform.system()!='Darwin' or platform.machine()!='arm64':
    raise SystemExit('BLOCKED: this pinned portable Java distribution is for macOS arm64')
for sub in ['downloads','emulators','config','npm-cache']:(RUNTIME/sub).mkdir(parents=True,exist_ok=True)
def get(item,dest):
    if not dest.exists() or hashlib.sha256(dest.read_bytes()).hexdigest()!=item['sha256']:
        partial=dest.with_suffix(dest.suffix+'.partial')
        subprocess.run(['curl','--fail','--location','--retry','1','--max-time','300','--output',str(partial),item['url']],check=True)
        if hashlib.sha256(partial.read_bytes()).hexdigest()!=item['sha256']:raise SystemExit('BLOCKED: checksum mismatch, download not executed')
        partial.replace(dest)
archive=RUNTIME/'downloads/java.tar.gz';get(meta['java'],archive)
if not list((RUNTIME/'java').glob('*/Contents/Home/bin/java')):
    with tarfile.open(archive) as package:package.extractall(RUNTIME/'java',filter='data')
get(meta['firestore'],RUNTIME/'emulators'/meta['firestore']['filename'])
# Existing CLI is reused read-only. No firebase login or credentials are loaded.
if not Path(meta['firebaseCLIPath']).exists():raise SystemExit('BLOCKED: existing Firebase CLI missing')
for name in ['package.json','package-lock.json']:(RUNTIME/name).write_bytes((ROOT/'v6'/name).read_bytes())
for name in ['npm-user','npm-global']:(RUNTIME/'config'/name).touch(exist_ok=True)
env={'PATH':'/usr/local/bin:/usr/bin:/bin:/usr/sbin','NPM_CONFIG_USERCONFIG':str(RUNTIME/'config/npm-user'),'NPM_CONFIG_GLOBALCONFIG':str(RUNTIME/'config/npm-global'),'NPM_CONFIG_CACHE':str(RUNTIME/'npm-cache')}
subprocess.run(['npm','ci','--prefix',str(RUNTIME),'--ignore-scripts','--no-audit','--no-fund'],env=env,check=True)
print('Portable Java, pinned Firestore binary and local Firebase Admin ready; no global changes')
