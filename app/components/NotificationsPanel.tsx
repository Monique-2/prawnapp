// app/components/NotificationsPanel.tsx
import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Modal,
    PanResponder,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { AppNotification } from '../index';

// ── helpers ──────────────────────────────────────────────────────────────────

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const typeIcon: Record<AppNotification['type'], FeatherName> = {
  feeding: 'package',
  water:   'droplet',
  pond:    'layers',
  alert:   'alert-triangle',
};

const typeIconColor: Record<AppNotification['type'], string> = {
  feeding: '#FF8C00',
  water:   '#3B82F6',
  pond:    '#10B981',
  alert:   '#EF4444',
};

const typeBadge: Record<AppNotification['type'], { bg: string }> = {
  feeding: { bg: '#FF8C00' },
  water:   { bg: '#3B82F6' },
  pond:    { bg: '#10B981' },
  alert:   { bg: '#EF4444' },
};

const typeAvatarBg: Record<AppNotification['type'], string> = {
  feeding: '#FFF4E6',
  water:   '#EFF6FF',
  pond:    '#ECFDF5',
  alert:   '#FEF2F2',
};

const typeLabel: Record<AppNotification['type'], string> = {
  feeding: 'Feeding',
  water:   'Water',
  pond:    'Pond',
  alert:   'Alert',
};

function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

function isNew(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() < 24 * 60 * 60 * 1000;
}

// ── SwipeRow ─────────────────────────────────────────────────────────────────
// Wraps a row with long-press-to-activate + left-drag-to-delete behaviour.
// Uses only built-in PanResponder so it works reliably inside a Modal.

const SWIPE_THRESHOLD = 80;

interface SwipeRowProps {
  enabled: boolean;
  onDelete: () => void;
  children: (onLongPress: () => void, onCancel: () => void, isSwipeActive: boolean) => React.ReactNode;
}

function SwipeRow({ enabled, onDelete, children }: SwipeRowProps) {
  const translateX   = useRef(new Animated.Value(0)).current;
  const isActiveRef  = useRef(false);
  const [swipeActive, setSwipeActive] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        enabled &&
        isActiveRef.current &&
        gs.dx < -5 &&
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDelete();
            translateX.setValue(0);
            isActiveRef.current = false;
            setSwipeActive(false);
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() => {
            isActiveRef.current = false;
            setSwipeActive(false);
          });
        }
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() => {
          isActiveRef.current = false;
          setSwipeActive(false);
        });
      },
    })
  ).current;

  const activate = () => {
    if (!enabled) return;
    isActiveRef.current = true;
    setSwipeActive(true);
  };

  const deactivate = () => {
    isActiveRef.current = false;
    setSwipeActive(false);
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  };

  const underlayOpacity = translateX.interpolate({
    inputRange: [-200, -10, 0],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp',
  });

  const iconScale = translateX.interpolate({
    inputRange: [-200, -SWIPE_THRESHOLD, 0],
    outputRange: [1.15, 1, 0.5],
    extrapolate: 'clamp',
  });

  return (
    <View style={swipeRowStyles.container}>
      {/* Red underlay revealed on drag */}
      <Animated.View
        style={[swipeRowStyles.underlay, { opacity: underlayOpacity }]}
        pointerEvents="none"
      >
        <Animated.View style={{ transform: [{ scale: iconScale }], alignItems: 'center' }}>
          <Feather name="trash-2" size={22} color="#FFFFFF" />
          <Text style={swipeRowStyles.underlayText}>Delete</Text>
        </Animated.View>
      </Animated.View>

      {/* Sliding row */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        {children(activate, deactivate, swipeActive)}
      </Animated.View>
    </View>
  );
}

const swipeRowStyles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  underlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
  },
  underlayIcon: {
    marginBottom: 2,
  },
  underlayText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function NotificationsPanel({ visible, onClose, notifications, onMarkRead, onDelete }: Props) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const displayed = filter === 'unread'
    ? notifications.filter((n) => !n.read || n.id === expandedId)
    : notifications;

  const newItems     = displayed.filter((n) => isNew(n.timestamp));
  const earlierItems = displayed.filter((n) => !isNew(n.timestamp));

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handlePress = (item: AppNotification) => {
    const isExpanding = expandedId !== item.id;
    setExpandedId(isExpanding ? item.id : null);
    if (isExpanding && !item.read) {
      onMarkRead(item.id);
    }
  };

  const renderItem = (item: AppNotification) => {
    const badge      = typeBadge[item.type];
    const avatarBg   = typeAvatarBg[item.type];
    const icon       = typeIcon[item.type];
    const iconColor  = typeIconColor[item.type];
    const isUnread   = !item.read;
    const isExpanded = expandedId === item.id;
    const canSwipe   = filter === 'all';

    const rowContent = (onLongPress: () => void, onCancel: () => void, isSwipeActive: boolean) => (
      <Pressable
        key={item.id}
        style={[
          styles.row,
          isUnread && styles.rowUnread,
          isExpanded && styles.rowExpanded,
          isSwipeActive && styles.rowSwipeActive,
        ]}
        android_ripple={{ color: '#00000011' }}
        onPress={() => {
          if (isSwipeActive) {
            onCancel();
          } else {
            handlePress(item);
          }
        }}
        onLongPress={onLongPress}
        delayLongPress={350}
      >
        {/* Avatar + badge */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Feather name={icon} size={22} color={iconColor} />
          </View>
          <View style={[styles.badgeCircle, { backgroundColor: badge.bg }]}>
            <Feather name={icon} size={10} color="#FFFFFF" />
          </View>
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <Text style={styles.message} numberOfLines={isExpanded ? undefined : 3}>
            <Text style={styles.bold}>{item.title}{'  '}</Text>
            {item.message}
          </Text>
          <Text style={[styles.time, isUnread && !isExpanded && styles.timeUnread]}>
            {timeAgo(item.timestamp)}
          </Text>

          {/* Expanded detail card */}
          {isExpanded && (
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category</Text>
                <View style={[styles.categoryBadge, { backgroundColor: badge.bg }]}>
                  <Text style={styles.categoryBadgeText}>{typeLabel[item.type]}</Text>
                </View>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Recorded at</Text>
                <Text style={styles.detailValue}>{formatFullDate(item.timestamp)}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={styles.readBadge}>
                  <Text style={styles.readBadgeText}>✓ Read</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Unread dot — hidden once expanded/read */}
        {isUnread && !isExpanded && <View style={styles.unreadDot} />}
        {/* Swipe hint shown when long-press activates and card is not expanded */}
        {isSwipeActive && !isExpanded && (
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>← slide to delete</Text>
          </View>
        )}
      </Pressable>
    );

    if (!canSwipe) {
      return (
        <View key={item.id}>
          {rowContent(() => {}, () => {}, false)}
        </View>
      );
    }

    return (
      <SwipeRow
        key={item.id}
        enabled={canSwipe}
        onDelete={() => onDelete(item.id)}
      >
        {(onLongPress, onCancel, isSwipeActive) => rowContent(onLongPress, onCancel, isSwipeActive)}
      </SwipeRow>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Filter pills */}
        <View style={styles.pills}>
          <TouchableOpacity
            style={[styles.pill, filter === 'all' && styles.pillActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.pillText, filter === 'all' && styles.pillTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, filter === 'unread' && styles.pillActive]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.pillText, filter === 'unread' && styles.pillTextActive]}>
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {displayed.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptyText}>No notifications to show.</Text>
          </View>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {newItems.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>New</Text>
                {newItems.map(renderItem)}
              </>
            )}
            {earlierItems.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Earlier</Text>
                {earlierItems.map(renderItem)}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const UNREAD_BG = '#FFF8F0';
const AMBER_DOT = '#FF8C00';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F5F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F0EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 20,
    color: '#374151',
    fontWeight: '600',
    lineHeight: 24,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F0EB',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  pillActive: {
    backgroundColor: '#FFF4E6',
    borderWidth: 1,
    borderColor: '#FDDBB0',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillTextActive: {
    color: '#FF8C00',
  },
  list: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F0EB',
  },
  rowUnread: {
    backgroundColor: UNREAD_BG,
    borderColor: '#FDDBB0',
  },
  rowExpanded: {
    backgroundColor: '#FFF8F0',
    borderColor: '#FF8C00',
    borderLeftWidth: 3,
  },
  rowSwipeActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  swipeHint: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingRight: 4,
  },
  swipeHintText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  avatarWrap: {
    position: 'relative',
    width: 56,
    height: 56,
    flexShrink: 0,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textWrap: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  timeUnread: {
    color: '#FF8C00',
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AMBER_DOT,
    flexShrink: 0,
    marginTop: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Expanded detail card ──────────────────────────────────────────────────
  detailCard: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDE8',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#F8F5F0',
    marginHorizontal: 14,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  readBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  readBadgeText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '700',
  },


});