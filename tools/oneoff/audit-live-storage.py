"""Read-only snapshot for the ITEMX audit. Raw chat data stays in a private backup."""
import json, pathlib, subprocess, datetime, os
command = ['docker','exec','-i','risu-haejeok-trial-postgres','sh','-c',
           'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d risuai_trial']
query = """BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
 'chats', (SELECT json_agg(json_build_object('id',c.id,'scriptstate',
   (SELECT json_object_agg(key,text_value) FROM chat.script_state s WHERE s.chat_id=c.id),
   'message',(SELECT coalesce(json_agg(json_build_object('chatId',m.id,'role',m.role,'data',coalesce(m.content_text,'')) ORDER BY m.position),'[]') FROM chat.messages m WHERE m.chat_id=c.id)))
 FROM chat.chats c WHERE EXISTS(SELECT 1 FROM chat.script_state s WHERE s.chat_id=c.id AND s.key LIKE 'itemx:%')),
 'binaryMessages',(SELECT count(*) FROM chat.messages m WHERE m.content_binary IS NOT NULL AND EXISTS(SELECT 1 FROM chat.script_state s WHERE s.chat_id=m.chat_id AND s.key='itemx:log')),
 'plugin',(SELECT json_build_object('version',plugin_version,'sha256',encode(sha256(convert_to(script,'UTF8')),'hex')) FROM system.plugins WHERE name='itemx2'));
COMMIT;"""
result = subprocess.run(command,input=query,text=True,capture_output=True,check=True)
data=json.loads(result.stdout.strip())
folder=pathlib.Path('/volume2/risu/backups/itemx2-production') / ('audit-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
folder.mkdir(mode=0o700)
path=folder/'snapshot.json'
with os.fdopen(os.open(str(path),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'w') as f: json.dump(data,f,ensure_ascii=False)
print(json.dumps({'snapshot':str(path),'chats':len(data['chats']),'binaryMessages':data['binaryMessages'],'plugin':data['plugin']}))
