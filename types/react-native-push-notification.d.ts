declare module 'react-native-push-notification' {
  export interface PushNotificationPermissions {
    alert?: boolean;
    badge?: boolean;
    sound?: boolean;
  }

  export interface PushNotificationToken {
    os: string;
    token: string;
  }

  export interface PushNotification {
    foreground: boolean;
    userInteraction: boolean;
    message: string | object;
    data: object;
    badge: number;
    alert: object;
    sound: string;
    finish: (fetchResult: string) => void;
  }

  export interface PushNotificationOptions {
    onRegister?: (token: PushNotificationToken) => void;
    onNotification?: (notification: PushNotification) => void;
    onAction?: (notification: PushNotification) => void;
    onRegistrationError?: (error: Error) => void;
    permissions?: PushNotificationPermissions;
    popInitialNotification?: boolean;
    requestPermissions?: boolean;
  }

  export interface LocalNotificationOptions {
    id?: string | number;
    title?: string;
    message: string;
    ticker?: string;
    showWhen?: boolean;
    autoCancel?: boolean;
    largeIcon?: string;
    largeIconUrl?: string;
    smallIcon?: string;
    bigText?: string;
    subText?: string;
    bigPictureUrl?: string;
    color?: string;
    vibrate?: boolean;
    vibration?: number;
    tag?: string;
    group?: string;
    groupSummary?: boolean;
    ongoing?: boolean;
    priority?: string;
    visibility?: string;
    importance?: string;
    allowWhileIdle?: boolean;
    ignoreInForeground?: boolean;
    shortcutId?: string;
    channelId?: string;
    onlyAlertOnce?: boolean;
    when?: Date;
    usesChronometer?: boolean;
    timeoutAfter?: number;
    messageId?: string;
    actions?: string[];
    invokeApp?: boolean;
    userInfo?: object;
    playSound?: boolean;
    soundName?: string;
    number?: number;
    repeatType?: 'week' | 'day' | 'hour' | 'minute' | 'time';
    repeatTime?: number;
    date?: Date;
  }

  export interface ScheduledNotificationOptions extends LocalNotificationOptions {
    date: Date;
  }

  export interface PushNotificationScheduleResult {
    id: string;
  }

  export interface ChannelObject {
    channelId: string;
    channelName: string;
    channelDescription?: string;
    playSound?: boolean;
    soundName?: string;
    importance?: number;
    vibrate?: boolean;
  }

  interface PushNotificationStatic {
    configure(options: PushNotificationOptions): void;
    unregister(): void;
    localNotification(details: LocalNotificationOptions): void;
    localNotificationSchedule(details: ScheduledNotificationOptions): PushNotificationScheduleResult;
    requestPermissions(permissions?: PushNotificationPermissions[]): Promise<PushNotificationPermissions>;
    abandonPermissions(): void;
    checkPermissions(callback: (permissions: PushNotificationPermissions) => void): void;
    getInitialNotification(): Promise<PushNotification | null>;
    removeAllDeliveredNotifications(): void;
    getDeliveredNotifications(callback: (notifications: object[]) => void): void;
    getScheduledLocalNotifications(callback: (notifications: object[]) => void): void;
    setApplicationIconBadgeNumber(badgeCount: number): void;
    getApplicationIconBadgeNumber(callback: (badgeCount: number) => void): void;
    cancelAllLocalNotifications(): void;
    cancelLocalNotifications(details: { id: string }): void;
    clearLocalNotification(notificationId: string, notificationRequestId?: string): void;
    clearAllNotifications(): void;
    removeDeliveredNotifications(identifiers: string[]): void;
    invokeApp(notification: object): void;
    subscribeToTopic(topic: string): void;
    unsubscribeFromTopic(topic: string): void;
    createChannel(channel: ChannelObject, callback?: (created: boolean) => void): void;
    channelExists(channelId: string, callback: (exists: boolean) => void): void;
    channelBlocked(channelId: string, callback: (blocked: boolean) => void): void;
    deleteChannel(channelId: string): void;
    getChannels(callback: (channels: string[]) => void): void;
  }

  const PushNotification: PushNotificationStatic;
  export default PushNotification;
} 