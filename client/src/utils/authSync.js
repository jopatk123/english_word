import { createTabSyncChannel } from './tabSync.js';

let userSessionChannel;
let adminSessionChannel;

const getUserSessionChannel = () => {
  if (!userSessionChannel) {
    userSessionChannel = createTabSyncChannel('user-session');
  }

  return userSessionChannel;
};

const getAdminSessionChannel = () => {
  if (!adminSessionChannel) {
    adminSessionChannel = createTabSyncChannel('admin-session');
  }

  return adminSessionChannel;
};

export const notifyUserSessionChanged = (payload) => {
  getUserSessionChannel().publish(payload);
};

export const subscribeUserSessionChanges = (handler) => getUserSessionChannel().subscribe(handler);

export const notifyAdminSessionChanged = (payload) => {
  getAdminSessionChannel().publish(payload);
};

export const subscribeAdminSessionChanges = (handler) =>
  getAdminSessionChannel().subscribe(handler);
