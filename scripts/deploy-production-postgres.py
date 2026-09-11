"""Narrow, audited ITEMX deployment to the explicitly selected production database."""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
COMMAND = ['docker', 'exec', '-i', 'risu-haejeok-trial-postgres', 'sh', '-c',
           'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d risuai_trial']

def sql(query):
    result = subprocess.run(COMMAND, input=query, text=True, capture_output=True)
    if result.returncode:
        errors = [line for line in result.stderr.splitlines() if line.startswith('ERROR:')]
        raise RuntimeError('; '.join(errors) or 'psql failed; transaction aborted')
    return result.stdout.strip()

def literal(value):
    return "'" + value.replace("'", "''") + "'"

bundle = (ROOT / 'dist/itemx2.plugin.js').read_text()
assert '$deploy$' not in bundle
def meta(key):
    return re.search(r'^//@' + key + r'\s+(.+)$', bundle, re.M).group(1).strip()

rows = json.loads(sql("SELECT coalesce(json_agg(p),'[]') FROM system.plugins p WHERE name='itemx2';"))
assert len(rows) == 1 and rows[0]['setting_key'] == 'plugins', 'ambiguous target'
old = rows[0]
old_version = tuple(map(int, old['plugin_version'].split('.')))
new_version = tuple(map(int, meta('version').split('.')))
assert old_version < new_version or (old_version == new_version and '--replace-same-version' in sys.argv), 'not a forward deployment (same-version hotfix requires --replace-same-version)'
nodes = json.loads(sql("""SELECT json_agg(v ORDER BY node_id) FROM system.setting_values v
WHERE setting_key='plugins' AND parent_node_id=(SELECT parent_node_id FROM system.setting_values
WHERE setting_key='plugins' AND member_key='name' AND text_value='itemx2');"""))
fields = {'script': bundle, 'displayName': meta('display-name'),
          'versionOfPlugin': meta('version'), 'updateURL': meta('update-url')}
selected = {key: [n for n in nodes if n['member_key'] == key] for key in fields}
assert all(len(n) == 1 and n[0]['value_type'] == 'text' for n in selected.values())
assert selected['script'][0]['text_value'] == old['script'], 'storage projections disagree'
backup = pathlib.Path('/volume2/risu/backups/itemx2-production') / ('production-itemx-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.json')
backup.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
with backup.open('x') as output:
    backup.chmod(0o600)
    json.dump({'plugin': old, 'nodes': nodes}, output, ensure_ascii=False)

node_ids = ','.join(str(selected[k][0]['node_id']) for k in fields)
checks = [f"IF NOT EXISTS (SELECT 1 FROM system.plugins p WHERE setting_key='plugins' AND position={old['position']} AND to_jsonb(p)={literal(json.dumps(old))}::jsonb) THEN RAISE EXCEPTION 'plugin changed since backup'; END IF;"]
updates = []
for key, value in fields.items():
    node = selected[key][0]
    checks.append(f"IF NOT EXISTS (SELECT 1 FROM system.setting_values v WHERE setting_key='plugins' AND node_id={node['node_id']} AND to_jsonb(v)={literal(json.dumps(node))}::jsonb) THEN RAISE EXCEPTION 'node changed since backup'; END IF;")
    updates.append(f"UPDATE system.setting_values SET text_value={literal(value)} WHERE setting_key='plugins' AND node_id={node['node_id']};")

# Lock the same revision owner as the application; all checks precede mutations.
query = f"""BEGIN;
SET LOCAL standard_conforming_strings=on;
SELECT revision FROM system.storage_meta WHERE singleton=TRUE FOR UPDATE;
CREATE TEMP TABLE untouched AS SELECT
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY setting_key,position)::text,'')) FROM system.plugins p WHERE NOT(setting_key='plugins' AND position={old['position']})) p,
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(v) ORDER BY setting_key,node_id)::text,'')) FROM system.setting_values v WHERE NOT(setting_key='plugins' AND node_id IN ({node_ids}))) v;
DO $deploy$ DECLARE audit_id bigint; BEGIN
{''.join(checks)}
INSERT INTO system.revisions(storage_revision,database_initialized,scope,action)
 SELECT revision+1,TRUE,'database','ITEMX scoped deployment {meta('version')}' FROM system.storage_meta WHERE singleton=TRUE RETURNING id INTO audit_id;
PERFORM set_config('risu.revision_id',audit_id::text,TRUE);
{''.join(updates)}
UPDATE system.plugins SET script={literal(bundle)},display_name={literal(meta('display-name'))},plugin_version={literal(meta('version'))},update_url={literal(meta('update-url'))}
 WHERE setting_key='plugins' AND position={old['position']};
UPDATE system.settings SET updated_at=NOW() WHERE key='plugins';
UPDATE system.storage_meta SET revision=revision+1,initialized=TRUE,updated_at=NOW() WHERE singleton=TRUE;
IF (SELECT p FROM untouched) IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY setting_key,position)::text,'')) FROM system.plugins p WHERE NOT(setting_key='plugins' AND position={old['position']}))
 OR (SELECT v FROM untouched) IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(v) ORDER BY setting_key,node_id)::text,'')) FROM system.setting_values v WHERE NOT(setting_key='plugins' AND node_id IN ({node_ids})))
 THEN RAISE EXCEPTION 'unrelated storage changed'; END IF;
END $deploy$;
COMMIT;
"""
sql(query)
verified = json.loads(sql("SELECT json_build_object('script',p.script,'version',p.plugin_version,'node_script',v.text_value) FROM system.plugins p JOIN system.setting_values v ON v.setting_key='plugins' AND v.node_id=" + str(selected['script'][0]['node_id']) + " WHERE p.name='itemx2';"))
assert verified['script'] == verified['node_script'] == bundle
assert verified['version'] == meta('version')
print(json.dumps({'updated': old['plugin_version'] + ' -> ' + meta('version'),
                  'sha256': hashlib.sha256(bundle.encode()).hexdigest(), 'backup': str(backup),
                  'both_storage_projections_verified': True, 'unrelated_plugins_and_values_unchanged': True}))
