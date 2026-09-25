/* ITEMX runtime config owner. Concatenated inside the runtime closure. */
  const ITEMX_PROTOCOL_TEXT = __ITEMX_PROTOCOL_JSON__;

  const ITEMX_PLUGIN_VERSION = __ITEMX_PLUGIN_VERSION_JSON__;

  const ITEMX_VERSION_LABEL = __ITEMX_VERSION_LABEL_JSON__;

  const ITEMX_UPDATE_URL = 'https://raw.githubusercontent.com/canister2668/itemx2/main/dist/itemx2.plugin.js';

  const ITEMX_UPDATE_CACHE_KEY = 'itemx2:update-check';

  const ITEMX_UPDATE_CHECK_MS = 30 * 60 * 1000;

  const ITEMX_MANUAL_KEY = '$__itemx2_manual_events';

  const ITEMX_MESSAGE_EVENT_KEY = '$__itemx2_message_events';

  const ITEMX_CHECKPOINT_KEY = '$__itemx2_checkpoint';

  const ITEMX_AUX_KEY = '$__itemx2_aux_processed';

  const ITEMX_LORE_KEY = '$__itemx2_lore_enrichment';

  const ITEMX_AUX_ZERO_STORAGE_KEY = 'auxZeroRing:v1';

  const ITEMX_AUX_ZERO_CHAT_LIMIT = 32;

  const ITEMX_REF_RE = /<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;

  const ITEMX_CODEX_REF_RE = /<!--CODEX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;

  const ITEMX_AUX_SETTLE_MS = 1500;
  // Slow providers regularly pass 90 s; a timeout discards a reply the provider still bills.
  const ITEMX_AUX_TIMEOUT_MS = 240000;
  // Automatic recovery gives up on a message after this many failures; the manual run still works.
  const ITEMX_AUX_AUTO_ATTEMPTS = 3;

  const ITEMX_AUX_PROMPT_REVISION = 2;

  const ITEMX_ROOT_PAGE_SIZE = 16;

  const ITEMX_CHECKPOINT_VERSION = 2;

  const ITEMX_CHECKPOINT_TAIL_EVENTS = 96;

  const ITEMX_CHECKPOINT_TAIL_MESSAGES = 24;

  const ITEMX_CHECKPOINT_TRIGGER_MESSAGES = 64;

  const ITEMX_CHECKPOINT_TAIL_BYTES = 196608;

  const ITEMX_STORAGE_WARNING_BYTES = 16 * 1024 * 1024;

  const ITEMX_AUX_HISTORY_MAX_BYTES = 65536;

  const ITEMX_AUX_ZERO_MAX_BYTES = 65536;
