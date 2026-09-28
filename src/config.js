/* Runtime constants. */
import protocolText from './main-protocol.txt';
import pkg from '../package.json' with { type: 'json' };

export const ITEMX_PROTOCOL_TEXT = protocolText;

export const ITEMX_PLUGIN_VERSION = pkg.version;

const beta = pkg.version.match(/^(\d+)\.(\d+)\.\d+-beta\.(\d+)$/);
export const ITEMX_VERSION_LABEL = beta ? `${beta[1]}.${beta[2]} · BETA ${beta[3]}` : pkg.version;

export const ITEMX_UPDATE_URL = 'https://raw.githubusercontent.com/canister2668/itemx2/main/dist/itemx2.plugin.js';

export const ITEMX_UPDATE_CACHE_KEY = 'itemx2:update-check';

export const ITEMX_UPDATE_CHECK_MS = 30 * 60 * 1000;

export const ITEMX_MANUAL_KEY = '$__itemx2_manual_events';

export const ITEMX_MESSAGE_EVENT_KEY = '$__itemx2_message_events';

export const ITEMX_CHECKPOINT_KEY = '$__itemx2_checkpoint';

export const ITEMX_AUX_KEY = '$__itemx2_aux_processed';

export const ITEMX_LORE_KEY = '$__itemx2_lore_enrichment';

export const ITEMX_AUX_ZERO_STORAGE_KEY = 'auxZeroRing:v1';

export const ITEMX_AUX_ZERO_CHAT_LIMIT = 32;

export const ITEMX_REF_RE = /<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;

export const ITEMX_CODEX_REF_RE = /<!--CODEX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;

export const ITEMX_AUX_SETTLE_MS = 1500;
// Slow providers regularly pass 90 s; a timeout discards a reply the provider still bills.
export const ITEMX_AUX_TIMEOUT_MS = 240000;
// Automatic recovery gives up on a message after this many failures; the manual run still works.
export const ITEMX_AUX_AUTO_ATTEMPTS = 3;

export const ITEMX_AUX_PROMPT_REVISION = 2;

export const ITEMX_ROOT_PAGE_SIZE = 16;

export const ITEMX_CHECKPOINT_VERSION = 2;

export const ITEMX_CHECKPOINT_TAIL_EVENTS = 96;

export const ITEMX_CHECKPOINT_TAIL_MESSAGES = 24;

export const ITEMX_CHECKPOINT_TRIGGER_MESSAGES = 64;

export const ITEMX_CHECKPOINT_TAIL_BYTES = 196608;

export const ITEMX_STORAGE_WARNING_BYTES = 16 * 1024 * 1024;

export const ITEMX_AUX_HISTORY_MAX_BYTES = 65536;

export const ITEMX_AUX_ZERO_MAX_BYTES = 65536;
