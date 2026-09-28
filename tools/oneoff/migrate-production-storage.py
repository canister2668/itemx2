"""One-time ITEMX 3-document conversion. Default: backup and verify, --apply: CAS write."""
import datetime
import json
import pathlib
import subprocess
import sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
COMMAND = ['docker', 'exec', '-i', 'risu-haejeok-trial-postgres', 'sh', '-c', 'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d risuai_trial']
def sql(query):
    result = subprocess.run(COMMAND, input=query, text=True, capture_output=True)
    if result.returncode: raise RuntimeError('\n'.join(line for line in result.stderr.splitlines() if line.startswith('ERROR:')) or 'psql failed')
    return result.stdout.strip()
def literal(value): return "'" + value.replace("'", "''") + "'"
keys = ['$__itemx2_checkpoint', '$__itemx2_message_events', '$__itemx2_manual_events', '$__itemx2_aux_processed', '$__itemx2_lore_enrichment', '$__itemx2_state', '$__itemx2_codex_state', '$__itemx2_history_preferences']
# The selected site currently includes two old ITEMX v1 chats in the 19-chat total.
ids = json.loads(sql("SELECT json_agg(DISTINCT chat_id) FROM chat.script_state WHERE key ILIKE '%itemx%';"))
assert len(ids) == 19, 'live chat inventory changed; inspect before conversion'
id_sql = ','.join(literal(value) for value in ids)
rows = json.loads(sql(f"SELECT json_agg(s ORDER BY chat_id,key) FROM chat.script_state s WHERE chat_id IN ({id_sql});"))
messages = json.loads(sql(f"SELECT coalesce(json_agg(json_build_object('chat_id',chat_id,'id',id,'position',position,'role',role,'data',content_text) ORDER BY chat_id,position),'[]') FROM chat.messages WHERE chat_id IN ({id_sql});"))
assert sql(f"SELECT count(*) FROM chat.messages WHERE chat_id IN ({id_sql}) AND content_binary IS NOT NULL;") == '0', 'binary message content needs decoding'
assert sql(f"SELECT count(*) FROM chat.chats WHERE id IN ({id_sql}) AND is_streaming;") == '0', 'wait for committed outputs'
settings_rows = json.loads(sql("SELECT coalesce(json_agg(s ORDER BY key),'[]') FROM system.plugin_custom_storage s WHERE key ~ '^(enabled|mainOutput|auxOutput|rarityMode|itemsEnabled|skillsEnabled|encountersEnabled|debugEnabled|effectsEnabled|fontScale|moduleAssetsEnabled|lorebookEncounterEnabled|skin):' OR key IN ('badgePosition','auxZeroRing:v1','itemx:settings');"))
assert all(row['key'] != 'itemx:settings' for row in settings_rows), 'already migrated'
chats = []
for chat_id in ids:
    state = {row['key']: row['text_value'] if row['value_type'] == 'text' else row['number_value'] if row['value_type'] == 'number' else row['boolean_value'] for row in rows if row['chat_id'] == chat_id}
    chats.append({'id': chat_id, 'scriptstate': state, 'message': [{'chatId': row['id'], 'role': row['role'], 'data': row['data'] or ''} for row in messages if row['chat_id'] == chat_id]})
folder = pathlib.Path('/volume2/risu/backups/itemx2-production') / ('storage-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
folder.mkdir(mode=0o700, parents=True, exist_ok=False)
backup = {'state_rows': rows, 'message_rows': messages, 'settings_rows': settings_rows, 'chats': chats, 'settings': {row['key']: row['value'] for row in settings_rows}}
input_file, output_file = folder / 'before.json', folder / 'converted.json'
with input_file.open('x') as output:
    input_file.chmod(0o600); json.dump(backup, output, ensure_ascii=False)
subprocess.run(['node', 'scripts/convert-storage.mjs', str(input_file), str(output_file)], cwd=ROOT, check=True)
converted = json.loads(output_file.read_text())
if '--apply' not in sys.argv:
    print(json.dumps({'verified': converted['verified'], 'backup': str(input_file), 'applied': False})); sys.exit(0)
checks = [f"IF (SELECT jsonb_agg(to_jsonb(s) ORDER BY chat_id,key) FROM chat.script_state s WHERE chat_id IN ({id_sql})) IS DISTINCT FROM {literal(json.dumps(rows))}::jsonb THEN RAISE EXCEPTION 'chat state changed since backup'; END IF;"]
checks.append(f"IF (SELECT jsonb_agg(jsonb_build_object('chat_id',chat_id,'id',id,'position',position,'role',role,'data',content_text) ORDER BY chat_id,position) FROM chat.messages WHERE chat_id IN ({id_sql})) IS DISTINCT FROM {literal(json.dumps(messages))}::jsonb THEN RAISE EXCEPTION 'messages changed since backup'; END IF;")
checks.append("IF (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY key),'[]') FROM system.plugin_custom_storage s WHERE key ~ '^(enabled|mainOutput|auxOutput|rarityMode|itemsEnabled|skillsEnabled|encountersEnabled|debugEnabled|effectsEnabled|fontScale|moduleAssetsEnabled|lorebookEncounterEnabled|skin):' OR key IN ('badgePosition','auxZeroRing:v1','itemx:settings')) IS DISTINCT FROM " + literal(json.dumps(settings_rows)) + "::jsonb THEN RAISE EXCEPTION 'settings changed since backup'; END IF;")
updates = []
for chat in converted['chats']:
    for key in ('itemx:log','itemx:prefs','itemx:cache'):
        updates.append(f"INSERT INTO chat.script_state(chat_id,key,value_type,text_value) VALUES ({literal(chat['id'])},{literal(key)},'text',{literal(chat['scriptstate'][key])});")
updates.append(f"DELETE FROM chat.script_state WHERE chat_id IN ({id_sql}) AND key IN ({','.join(literal(key) for key in keys)});")
updates.append("INSERT INTO system.plugin_custom_storage(key,value) VALUES ('itemx:settings'," + literal(json.dumps(json.dumps(converted['settings'], ensure_ascii=False))) + "::jsonb);")
# Metadata is host-maintained attribution, not the setting values themselves.
updates.append("DELETE FROM system.plugin_custom_storage WHERE key IN (" + ','.join(literal(row['key']) for row in settings_rows) + ");")
query = f"""BEGIN;
SELECT revision FROM system.storage_meta WHERE singleton=TRUE FOR UPDATE;
DO $convert$ DECLARE audit_id bigint; BEGIN
{''.join(checks)}
INSERT INTO system.revisions(storage_revision,database_initialized,scope,action) SELECT revision+1,TRUE,'database','ITEMX append-only log conversion' FROM system.storage_meta WHERE singleton=TRUE RETURNING id INTO audit_id;
PERFORM set_config('risu.revision_id',audit_id::text,TRUE);
{''.join(updates)}
UPDATE system.storage_meta SET revision=revision+1,initialized=TRUE,updated_at=NOW() WHERE singleton=TRUE;
END $convert$;
COMMIT;"""
sql(query)
verified = json.loads(sql(f"SELECT json_agg(s ORDER BY chat_id,key) FROM chat.script_state s WHERE chat_id IN ({id_sql}) AND key IN ('itemx:log','itemx:prefs','itemx:cache');"))
expected = {(chat['id'], key): chat['scriptstate'][key] for chat in converted['chats'] for key in ('itemx:log','itemx:prefs','itemx:cache')}
assert len(verified) == len(expected) and all(row['text_value'] == expected[(row['chat_id'],row['key'])] for row in verified)
print(json.dumps({'verified': converted['verified'], 'backup': str(input_file), 'applied': True, 'documents': len(verified)}))
