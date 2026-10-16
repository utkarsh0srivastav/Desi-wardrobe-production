import { ShopkeeperNotification } from '../types/models';
import { storage } from '../utils/storage';

/**
 * Notification Service — DESI WARDROBE
 *
 * Prepared as a modular service so Firebase Cloud Messaging (FCM) can be
 * connected in Version 2 without changing UI components.
 */

export const notificationService = {
  areNotificationsEnabled: (): boolean => {
    return storage.getSettings().notificationsEnabled;
  },

  setNotificationsEnabled: (enabled: boolean): void => {
    const current = storage.getSettings();
    storage.saveSettings({
      ...current,
      notificationsEnabled: enabled,
    });
  },

  getShopkeeperNotifications: (shopkeeperId: string): ShopkeeperNotification[] => {
    return storage.getShopkeeperNotifications(shopkeeperId);
  },

  sendShopkeeperNotification: (params: {
    shopkeeperId: string;
    shopId: string;
    orderId?: string;
    title: string;
    message: string;
    type: ShopkeeperNotification['type'];
  }): ShopkeeperNotification => {
    const current = storage.getShopkeeperNotifications();
    const newNotif: ShopkeeperNotification = {
      notificationId: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      shopkeeperId: params.shopkeeperId,
      shopId: params.shopId,
      orderId: params.orderId,
      title: params.title,
      message: params.message,
      type: params.type,
      read: false,
      createdAt: new Date().toISOString(),
    };
    storage.saveShopkeeperNotifications([newNotif, ...current]);
    return newNotif;
  },

  markShopkeeperNotificationAsRead: (notificationId: string): void => {
    const current = storage.getShopkeeperNotifications();
    const updated = current.map((n) =>
      n.notificationId === notificationId ? { ...n, read: true } : n
    );
    storage.saveShopkeeperNotifications(updated);
  },

  markAllShopkeeperNotificationsAsRead: (shopkeeperId: string): void => {
    const current = storage.getShopkeeperNotifications();
    const updated = current.map((n) =>
      n.shopkeeperId === shopkeeperId ? { ...n, read: true } : n
    );
    storage.saveShopkeeperNotifications(updated);
  },
};
