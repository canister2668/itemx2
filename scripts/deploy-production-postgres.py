"""Narrow, audited ITEMX deployment to the production database (Haejeok b7437 schema).

b7437 keeps plugin metadata in system.plugin_records and the script in
system.plugin_scripts. The server reads scripts from the database on every
load; plugin metadata is cached in the server process until it restarts.
"""
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB_CONTAINER = os.environ.get('ITEMX_DB_CONTAINER', 'LIVE-DB')
COMMAND = ['docker', 'exec', '-i', DB_CONTAINER, 'sh', '-c',
           'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d risuai_trial']


def sql(query):
    result = subprocess.run(COMMAND, input=query, text=True, capture_output=True)
    if result.returncode:
        errors = [line for line in result.stderr.splitlines() if line.startswith('ERROR:')]
        raise RuntimeError('; '.join(errors) or result.stderr.strip() or 'psql failed; transaction aborted')
    return result.stdout.strip()


def literal(value):
    return "'" + value.replace("'", "''") + "'"


bundle = (ROOT / 'dist/itemx2.plugin.js').read_text()
assert '$deploy$' not in bundle and '\x00' not in bundle


def meta(key):
    return re.search(r'^//@' + key + r'\s+(.+)$', bundle, re.M).group(1).strip()


rows = json.loads(sql("""SELECT coalesce(json_agg(json_build_object('record', to_jsonb(r), 'script', s.script)), '[]')
FROM system.plugin_records r JOIN system.plugin_scripts s USING (plugin_id) WHERE r.name = 'itemx2';"""))
assert len(rows) == 1, 'ambiguous or missing itemx2 plugin'
old = rows[0]
record = old['record']
old_version = tuple(map(int, record['plugin_version'].split('.')))
new_version = tuple(map(int, meta('version').split('.')))
forward = old_version < new_version
same = old_version == new_version and '--replace-same-version' in sys.argv
downgrade = old_version > new_version and '--allow-downgrade' in sys.argv
assert forward or same or downgrade, (
    f'not a forward deployment ({record["plugin_version"]} -> {meta("version")}); '
    'same-version hotfix requires --replace-same-version, rollback requires --allow-downgrade'
)

backup = pathlib.Path('/volume2/risu/backups/itemx2-production') / (
    'production-itemx-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.json')
backup.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
with backup.open('x') as output:
    backup.chmod(0o600)
    json.dump(old, output, ensure_ascii=False)

plugin_id = record['plugin_id']
old_hash = hashlib.md5(old['script'].encode()).hexdigest()
query = f"""BEGIN;
SET LOCAL standard_conforming_strings=on;
SELECT revision FROM system.storage_meta WHERE singleton=TRUE FOR UPDATE;
DO $deploy$ DECLARE audit_id bigint; BEGIN
IF NOT EXISTS (SELECT 1 FROM system.plugin_scripts WHERE plugin_id={literal(plugin_id)} AND md5(script)={literal(old_hash)})
 THEN RAISE EXCEPTION 'plugin script changed since backup'; END IF;
IF NOT EXISTS (SELECT 1 FROM system.plugin_records r WHERE plugin_id={literal(plugin_id)} AND to_jsonb(r)={literal(json.dumps(record))}::jsonb)
 THEN RAISE EXCEPTION 'plugin record changed since backup'; END IF;
INSERT INTO system.revisions(storage_revision, database_initialized, scope, action)
 SELECT revision + 1, TRUE, 'database', 'ITEMX scoped deployment {meta('version')}'
 FROM system.storage_meta WHERE singleton=TRUE RETURNING id INTO audit_id;
PERFORM set_config('risu.revision_id', audit_id::text, TRUE);
UPDATE system.plugin_scripts SET script={literal(bundle)}, updated_at=NOW() WHERE plugin_id={literal(plugin_id)};
UPDATE system.plugin_records SET display_name={literal(meta('display-name'))}, plugin_version={literal(meta('version'))},
 update_url={literal(meta('update-url'))}, updated_at=NOW() WHERE plugin_id={literal(plugin_id)};
UPDATE system.storage_meta SET revision=revision+1, initialized=TRUE, updated_at=NOW() WHERE singleton=TRUE;
END $deploy$;
COMMIT;
"""
sql(query)
verified = json.loads(sql(f"""SELECT json_build_object('script', s.script, 'version', r.plugin_version)
FROM system.plugin_records r JOIN system.plugin_scripts s USING (plugin_id) WHERE r.plugin_id={literal(plugin_id)};"""))
assert verified['script'] == bundle
assert verified['version'] == meta('version')
print(json.dumps({'updated': record['plugin_version'] + ' -> ' + meta('version'),
                  'md5': hashlib.md5(bundle.encode()).hexdigest(), 'backup': str(backup),
                  'verified': True}))
