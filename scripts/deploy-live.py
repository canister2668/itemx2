#!/usr/bin/env python3
import datetime
import hashlib
import json
import os
import pathlib
import re
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
if not os.environ.get('ITEMX_RISU_DB') or not os.environ.get('ITEMX_BACKUP_DIR'):
    raise SystemExit('set ITEMX_RISU_DB and ITEMX_BACKUP_DIR explicitly')
DB = pathlib.Path(os.environ['ITEMX_RISU_DB'])
BUNDLE = ROOT / 'dist' / 'itemx2.plugin.js'
BACKUPS = pathlib.Path(os.environ['ITEMX_BACKUP_DIR'])
ALLOW_DOWNGRADE = os.environ.get('ITEMX_ALLOW_DOWNGRADE') == '1'

def version_key(value):
    match = re.fullmatch(r'(\d+)\.(\d+)\.(\d+)(?:-(preview|beta)\.(\d+))?', value or '')
    if not match:
        return None
    major, minor, patch, channel, number = match.groups()
    return int(major), int(minor), int(patch), {'preview': 0, 'beta': 1, None: 2}[channel], int(number or 0)

bundle = BUNDLE.read_text(encoding='utf-8')
new_version = re.search(r'^//@version\s+(\S+)', bundle, re.MULTILINE)
if not new_version:
    raise SystemExit('built plugin has no version metadata')
new_version_value = new_version.group(1)
new_update_url_match = re.search(r'^//@update-url\s+(\S+)', bundle, re.MULTILINE)
new_update_url = new_update_url_match.group(1) if new_update_url_match else ''
new_display_name_match = re.search(r'^//@display-name\s+(.+)$', bundle, re.MULTILINE)
new_display_name = new_display_name_match.group(1).strip() if new_display_name_match else 'ITEMX CODEX'

con = sqlite3.connect(DB)
try:
    con.execute('BEGIN IMMEDIATE')
    row = con.execute('SELECT data, updated_at FROM settings WHERE id=1').fetchone()
    if not row:
        raise RuntimeError('settings row 1 not found')
    raw, updated_at = row
    settings = json.loads(raw)
    matches = [
        (index, plugin) for index, plugin in enumerate(settings.get('plugins') or [])
        if plugin.get('name') == 'itemx2'
    ]
    if len(matches) != 1:
        raise RuntimeError(f'expected one live ITEMX plugin, found {len(matches)}')
    index, plugin = matches[0]
    old_script = plugin.get('script') or ''
    old_match = re.search(r'^//@version\s+(\S+)', old_script, re.MULTILINE)
    old_version = old_match.group(1) if old_match else 'unknown'
    metadata_matches = (
        plugin.get('name') == 'itemx2'
        and plugin.get('displayName') == new_display_name
        and plugin.get('versionOfPlugin') == new_version_value
        and (plugin.get('updateURL') or '') == new_update_url
    )
    if old_script == bundle and metadata_matches:
        con.rollback()
        print(f'unchanged version={new_version_value}')
        raise SystemExit(0)
    if old_script != bundle:
        old_key, new_key = version_key(old_version), version_key(new_version_value)
        if not ALLOW_DOWNGRADE and (old_key is None or new_key is None or old_key >= new_key):
            raise RuntimeError(f'refusing non-forward ITEMX deployment: {old_version} -> {new_version_value}')

    BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    backup_path = BACKUPS / f'itemx2-{old_version}-before-{new_version_value}-{stamp}.json'
    backup_path.write_text(json.dumps({
        'settings_updated_at': updated_at,
        'plugin_index': index,
        'plugin': plugin,
    }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    settings['plugins'][index] = {
        **plugin,
        'name': 'itemx2',
        'displayName': new_display_name,
        'script': bundle,
        'versionOfPlugin': new_version_value,
        'updateURL': new_update_url,
    }
    next_raw = json.dumps(settings, ensure_ascii=False, separators=(',', ':'))
    changed = con.execute(
        "UPDATE settings SET data=?, updated_at=unixepoch() WHERE id=1 AND data=? AND updated_at=?",
        (next_raw, raw, updated_at),
    ).rowcount
    if changed != 1:
        raise RuntimeError('settings compare-and-swap failed')
    stored = json.loads(con.execute('SELECT data FROM settings WHERE id=1').fetchone()[0])
    if stored != settings:
        raise RuntimeError('stored settings differ from intended deployment')
    untouched = json.loads(json.dumps(stored))
    untouched['plugins'][index] = plugin
    if untouched != json.loads(raw):
        raise RuntimeError('deployment modified non-ITEMX settings')
    quick = con.execute('PRAGMA quick_check').fetchone()[0]
    if quick != 'ok':
        raise RuntimeError(f'quick_check failed: {quick}')
    con.commit()
    action = 'metadata-repaired' if old_script == bundle else 'updated'
    print(f'{action} index={index} {old_version}->{new_version_value}')
    print(f'bundle_sha256={hashlib.sha256(bundle.encode()).hexdigest()}')
    print(f'backup={backup_path} bytes={backup_path.stat().st_size}')
    print('quick_check=ok')
    print('non_itemx_settings_unchanged=true')
finally:
    con.close()
