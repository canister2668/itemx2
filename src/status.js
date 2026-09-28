/* The one-line status shown in the drawer header and the settings panel. */
import { t } from './i18n.js';

let text = null;

export const status = () => text ?? t('status.ready');

export function setStatus(value) {
  text = String(value ?? '');
}
