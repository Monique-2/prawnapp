import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ── Default handler: show banner + play sound while app is foregrounded ───────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Android notification channel ──────────────────────────────────────────────
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pondora', {
      name: 'Pondora Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF8C00',
      sound: 'default',
    });
  }
}

// ── Request permissions ───────────────────────────────────────────────────────
export async function requestNotificationPermissions(): Promise<boolean> {
  await setupNotificationChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Derive a stable notification identifier for a water action from data
 * available both at creation time (pond.id + scheduled_timestamp) and at
 * cancellation time (WaterManagementRecord has pond_id + scheduled_timestamp).
 */
export function waterNotifId(pondId: number | string, scheduledTimestamp: string): string {
  const digits = scheduledTimestamp.replace(/\D/g, '');
  return `water-${pondId}-${digits}`;
}

export function waterRemindId(pondId: number | string, scheduledTimestamp: string): string {
  const digits = scheduledTimestamp.replace(/\D/g, '');
  return `water-remind-${pondId}-${digits}`;
}

// ── Feeding notification ──────────────────────────────────────────────────────
export async function scheduleFeedingNotification(
  fm_id: number,
  pondName: string,
  scheduledDate: Date,
  amount: number,
  unit: string,
): Promise<void> {
  if (scheduledDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `feeding-${fm_id}`,
    content: {
      title: '🍤 Time to Feed!',
      body: `${pondName}: ${amount.toFixed(1)} ${unit.toUpperCase()} feeding scheduled now.`,
      sound: 'default',
      data: { type: 'feeding', fm_id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledDate,
      channelId: 'pondora',
    },
  });
}

export async function cancelFeedingNotification(fm_id: number): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`feeding-${fm_id}`);
  } catch {
    // Notification may have already fired — safe to ignore
  }
}

// ── Water notification ────────────────────────────────────────────────────────
/**
 * Schedules two notifications:
 *  1. 1 hour before the refill (if there's enough time)
 *  2. At the exact scheduled time
 *
 * Uses a deterministic identifier so the same notification can be canceled
 * later using only pond_id + scheduled_timestamp.
 */
export async function scheduleWaterNotification(
  pondId: number | string,
  pondName: string,
  scheduledDate: Date,
  actionType: string,
  scheduledTimestamp: string,
): Promise<void> {
  const now = new Date();
  const notifId = waterNotifId(pondId, scheduledTimestamp);
  const remindId = waterRemindId(pondId, scheduledTimestamp);
  const friendlyType = actionType === 'refill from freshwater' ? 'freshwater refill' : 'brackishwater refill';

  // Exact-time notification
  if (scheduledDate > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title: '💧 Time to Refill!',
        body: `${pondName}: ${friendlyType} is starting now.`,
        sound: 'default',
        data: { type: 'water', pondId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledDate,
        channelId: 'pondora',
      },
    });
  }

  // 1-hour-before reminder
  const oneHourBefore = new Date(scheduledDate.getTime() - 60 * 60 * 1000);
  if (oneHourBefore > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: remindId,
      content: {
        title: '💧 Water Refill in 1 Hour',
        body: `${pondName}: ${friendlyType} is scheduled in 1 hour.`,
        sound: 'default',
        data: { type: 'water', pondId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: oneHourBefore,
        channelId: 'pondora',
      },
    });
  }
}

export async function cancelWaterNotification(
  pondId: number | string,
  scheduledTimestamp: string,
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(waterNotifId(pondId, scheduledTimestamp));
    await Notifications.cancelScheduledNotificationAsync(waterRemindId(pondId, scheduledTimestamp));
  } catch {
    // Already fired or not found — safe to ignore
  }
}
