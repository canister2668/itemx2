/* Direct module imports for unit tests. `rt` gathers the exports tests reach
 * for most, under the names they have always used. */
import * as Core from '../../src/engine/core.js';
import * as Codex from '../../src/engine/codex.js';
import * as Quality from '../../src/engine/quality.js';
import * as Backup from '../../src/engine/backup.js';
import * as History from '../../src/engine/history.js';
import * as Lorebook from '../../src/engine/lorebook.js';
import * as Renderer from '../../src/render/renderer.js';
import * as CodexCards from '../../src/render/codex-cards.js';
import * as Ledger from '../../src/ledger.js';
import * as Markers from '../../src/markers.js';
import * as Pipeline from '../../src/pipeline.js';
import * as Aux from '../../src/aux.js';
import * as Portraits from '../../src/portraits.js';
import * as LoreSync from '../../src/lore-sync.js';
import * as Session from '../../src/session.js';
import * as Settings from '../../src/settings.js';
import * as Store from '../../src/storage.js';
import * as Presentation from '../../src/ui/presentation.js';
import * as Panel from '../../src/ui/panel.js';
import * as SettingsUi from '../../src/ui/settings.js';
import * as Controls from '../../src/ui/controls.js';
import * as Style from '../../src/ui/style.js';
import { uiState } from '../../src/ui/view-state.js';
import { setHost } from '../../src/host.js';
import { workQueue } from '../../src/kernel.js';
import { after } from 'node:test';

// Watchdogs arm real intervals; a closed queue clears them so the file exits.
after(() => workQueue.close());

export const rt = {
  ...Markers,
  ...Ledger,
  ...Pipeline,
  ...Aux,
  ...Portraits,
  ...LoreSync,
  ...CodexCards,
  ...Presentation,
  ...Panel,
  ...SettingsUi,
  ...Controls,
  core: Core,
  codex: Codex,
  quality: Quality,
  backup: Backup,
  history: History,
  lorebook: Lorebook,
  renderer: Renderer,
  storage: Store,
  settings: Settings,
  session: Session,
  uiState,
  setHost,
  style: Style.ITEMX_STYLE + Style.rootDrawerStyle()
};

export {
  Core,
  Codex,
  Quality,
  Backup,
  History,
  Lorebook,
  Renderer,
  Ledger,
  Markers,
  Pipeline,
  Aux,
  Portraits,
  Session
};
export { Settings, Store, Presentation, Panel, SettingsUi, Controls, Style, uiState, setHost };
