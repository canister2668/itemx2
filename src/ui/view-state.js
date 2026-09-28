/* Drawer view state. Shared by the UI modules only: no module outside src/ui
 * imports this (asserted by tests/layering.test.mjs). */
export const uiState = {
  rootDrawer: null,
  rootOpen: false,
  activeRootTab: 'inventory',
  rootItemPage: 0,
  rootClickBindings: [],
  panelOpen: false,
  allowDrawerOverSettings: false,
  backupOpen: false,
  cleanupArmed: false,
  storageCleanupArmed: false,
  historyView: { open: false, key: '', domain: 'item', filter: 'recent', selected: null, page: 0 },
  historyRows: [],
  powerButtonState: null,
  badgeDeltaSeen: '',
  query: ''
};
