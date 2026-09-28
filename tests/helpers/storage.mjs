import * as Store from '../../src/storage.js';
export const storageModel = Store;
export const hydrate = (chat) => Store.hydrate(chat);
export const migrate = (chat) => Store.persist(chat, { legacy: true });
