"""Run existing V6 integration tests on local Firebase emulators. No deployment."""
from pathlib import Path
import os,subprocess,shlex
ROOT=Path(__file__).resolve().parents[2]
WORKSPACE=ROOT.parents[1]
RUNTIME=WORKSPACE/'.runtime-v6'
java=next((RUNTIME/'java').glob('*/Contents/Home/bin/java'),None)
if not java or not (RUNTIME/'node_modules/firebase-admin').is_dir():
    raise SystemExit('BLOCKED: portable Java or local Firebase Admin dependency missing')
# An explicit clean environment excludes Firebase tokens, ADC and user CLI config.
env={
 'PATH':str(java.parent)+':/usr/local/bin:/usr/bin:/bin:/usr/sbin',
 'JAVA_HOME':str(java.parent.parent),
 'XDG_CONFIG_HOME':str(RUNTIME/'config'),
 'XDG_CACHE_HOME':str(RUNTIME/'cache'),
 'FIREBASE_EMULATORS_PATH':str(RUNTIME/'emulators'),
 'NODE_PATH':str(RUNTIME/'node_modules'),
 'GCLOUD_PROJECT':'demo-hwlab-v6',
 'V6_EMULATOR_TESTS':'1',
 'CI':'true', 'NO_UPDATE_NOTIFIER':'1', 'FIREBASE_CLI_DISABLE_MOTD':'1',
 'LANG':'en_US.UTF-8',
}
command='node --test '+shlex.quote(str(ROOT/'v6/tests/firebase.integration.cjs'))
args=['/usr/local/bin/firebase','emulators:exec','--only','auth,firestore','--project','demo-hwlab-v6','--config',str(ROOT/'v6/emulators/firebase.json'),'--non-interactive',command]
raise SystemExit(subprocess.run(args,cwd=RUNTIME,env=env).returncode)
