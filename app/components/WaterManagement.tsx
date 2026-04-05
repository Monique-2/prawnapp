import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Pond, PostResponse, WaterManagementRecord } from '../index';
import { cancelWaterNotification, scheduleWaterNotification } from '../utils/notifications';
import AppToast, { ToastType } from './AppToast';

interface WaterManagementProps {
  visible: boolean;
  pond: Pond | null;
  allWaterActions: WaterManagementRecord[];
  onClose: () => void;
  WATER_URL: string;
  onRefreshAllWaterActions: () => void;
}

type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'canceled' | 'failed';

const WaterManagement: React.FC<WaterManagementProps> = ({
  visible,
  pond,
  allWaterActions,
  onClose,
  WATER_URL,
  onRefreshAllWaterActions,
}) => {
  const [formVisible, setFormVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const [dateTime, setDateTime] = useState(new Date());
  const [showDateIOS, setShowDateIOS] = useState(false);
  const [showTimeIOS, setShowTimeIOS] = useState(false);
  const [showDateAndroid, setShowDateAndroid] = useState(false);
  const [showTimeAndroid, setShowTimeAndroid] = useState(false);
  const [tempDateAndroid, setTempDateAndroid] = useState(new Date());

  const [status, setStatus] = useState<ActionStatus>('pending');
  const [waterType, setWaterType] = useState<'refill from freshwater' | 'refill from brackishwater'>('refill from freshwater');
  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; title: string; message?: string }>({ visible: false, type: 'success', title: '' });

  const showToast = (type: ToastType, title: string, message?: string) => {
    setToast({ visible: true, type, title, message });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const screenWidth = Dimensions.get('window').width;

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const formatDateTime = (iso: string) => {
    // Replace space with T so JS parses it as local time consistently
    return new Date(iso.replace(' ', 'T')).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusText = (s: ActionStatus): string =>
    ({
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      canceled: 'Canceled',
      failed: 'Failed',
    }[s] ?? s);

  const getStatusColor = (s: ActionStatus): string =>
    ({
      completed: '#22C55E',
      pending: '#F59E0B',
      in_progress: '#3B82F6',
      canceled: '#EF4444',
      failed: '#EF4444',
    }[s] ?? '#6B7280');

  const updateStatusFromDate = (_dt = dateTime) => {};

  // ─── API ───────────────────────────────────────────────────────────────────
  const saveAction = async () => {
    if (!pond) {
      Alert.alert('Error', 'No pond selected.');
      return;
    }

    // MySQL-friendly format using LOCAL time (avoids UTC offset shifting the time)
    const pad = (n: number) => String(n).padStart(2, '0');
    const scheduled = `${dateTime.getFullYear()}-${pad(dateTime.getMonth() + 1)}-${pad(dateTime.getDate())} ${pad(dateTime.getHours())}:${pad(dateTime.getMinutes())}:00`;

    try {
      const payload = {
        pond_id: Number(pond.id),
        action_type: waterType,
        scheduled_timestamp: scheduled,
        action_status: 'pending' as const,
      };

      const res = await fetch(WATER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }

      const json: PostResponse = await res.json();

      if (json.success) {
        // Schedule push notifications for this refill
        scheduleWaterNotification(
          Number(pond.id),
          pond.pond_name,
          dateTime,
          waterType,
          scheduled,
        ).catch(console.error);
        showToast('success', 'Refill Scheduled', 'Your water refill has been saved.');
        resetForm();
        onRefreshAllWaterActions();
        setFormVisible(false);
      } else {
        showToast('error', 'Failed', json.message || 'Failed to schedule refill.');
      }
    } catch (err) {
      console.error('Save action failed:', err);
      showToast('error', 'Network Error', 'Failed to save refill. Check your connection.');
    }
  };

  const cancelAction = async (wm_id: number) => {
    try {
      const res = await fetch(`${WATER_URL}?wm_id=${wm_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_status: 'canceled' }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }

      const json: PostResponse = await res.json();

      if (json.success) {
        // Cancel the scheduled notifications for this refill
        const record = allWaterActions.find((w) => w.wm_id === wm_id);
        if (record) {
          cancelWaterNotification(record.pond_id, record.scheduled_timestamp).catch(console.error);
        }
        showToast('success', 'Refill Canceled', 'The water refill has been canceled.');
        onRefreshAllWaterActions();
        setHistoryVisible(false);
      } else {
        showToast('error', 'Failed', json.message || 'Failed to cancel refill.');
      }
    } catch (err) {
      console.error('Cancel action failed:', err);
      showToast('error', 'Network Error', 'Could not cancel the refill at this time.');
    }
  };

  // ─── Form logic ────────────────────────────────────────────────────────────
  const resetForm = () => {
    const now = new Date();
    setDateTime(now);
    setTempDateAndroid(now);
    setStatus('pending');
    setWaterType('refill from freshwater');
    setShowDateIOS(false);
    setShowTimeIOS(false);
    setShowDateAndroid(false);
    setShowTimeAndroid(false);
    updateStatusFromDate(now);
  };

  const onDateChangeIOS = (_: any, selected?: Date) => {
    setShowDateIOS(false);
    if (selected) {
      const next = new Date(dateTime);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setDateTime(next);
      updateStatusFromDate(next);
    }
  };

  const onTimeChangeIOS = (_: any, selected?: Date) => {
    setShowTimeIOS(false);
    if (selected) {
      const next = new Date(dateTime);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setDateTime(next);
      updateStatusFromDate(next);
    }
  };

  const onDateChangeAndroid = (_: any, selected?: Date) => {
    setShowDateAndroid(false);
    if (selected) {
      const next = new Date(dateTime);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setDateTime(next);
      updateStatusFromDate(next);
    }
  };

  const onTimeChangeAndroid = (_: any, selected?: Date) => {
    setShowTimeAndroid(false);
    if (selected) {
      const next = new Date(dateTime);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setDateTime(next);
      updateStatusFromDate(next);
    }
  };

  const showDate = () => {
    if (Platform.OS === 'ios') {
      setShowDateIOS(true);
    } else {
      setShowDateAndroid(true);
    }
  };

  const showTime = () => {
    if (Platform.OS === 'ios') {
      setShowTimeIOS(true);
    } else {
      setTempDateAndroid(new Date(dateTime));
      setShowTimeAndroid(true);
    }
  };

  useEffect(() => {
    if (visible) {
      resetForm();
    } else {
      setFormVisible(false);
      setHistoryVisible(false);
    }
  }, [visible]);

  useEffect(() => {
    updateStatusFromDate();
  }, [dateTime]);

  if (!visible || !pond) return null;

  // ─── Render single action ──────────────────────────────────────────────────
  const renderAction = ({ item }: { item: WaterManagementRecord }) => {
    const isActive = item.action_status === 'pending' || item.action_status === 'in_progress';
    const canCancel = isActive;

    return (
      <View style={[styles.actionCard, isActive && styles.activeCard]}>
        <View style={styles.actionHeader}>
          <Text style={styles.dateLarge}>
            {formatDateTime(item.scheduled_timestamp)}
          </Text>

          {canCancel && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() =>
                Alert.alert('Cancel Refill', 'Are you sure you want to cancel this refill?', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes', onPress: () => cancelAction(item.wm_id) },
                ])
              }
            >
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Type</Text>
          <Text style={styles.actionTypeText}>
            {item.action_type === 'refill from freshwater' ? '💧 Fresh Water' : '🌊 Brackish Water'}
          </Text>
        </View>

        <View style={[styles.statusRow, { marginTop: 6 }]}>
          <Text style={styles.label}>Status</Text>
          <View style={[styles.tag, { backgroundColor: getStatusColor(item.action_status) }]}>
            <Text style={styles.tagText}>{getStatusText(item.action_status)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Main modal – Upcoming Refills */}
      <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.card, { width: Math.min(screenWidth * 0.94, 520) }]}>
            <AppToast visible={toast.visible} type={toast.type} title={toast.title} message={toast.message} />
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Water Refill Management</Text>
                <Text style={styles.subtitle}>Pond: {pond.pond_name}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={allWaterActions.filter((r) => r.action_status === 'pending' || r.action_status === 'in_progress')}
              keyExtractor={(item) => item.wm_id.toString()}
              renderItem={renderAction}
              ListHeaderComponent={() => (
                <View style={styles.headerRow}>
                  <Text style={styles.section}>Upcoming Refills</Text>
                  <TouchableOpacity onPress={() => setHistoryVisible(true)}>
                    <Text style={styles.historyLink}>View History →</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No upcoming refill actions scheduled.</Text>
              }
              ListFooterComponent={() => (
                <TouchableOpacity style={styles.addBtn} onPress={() => setFormVisible(true)}>
                  <Text style={styles.addTxt}>+ Schedule New Refill</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: 20 }}
            />
          </View>
        </View>
      </Modal>

      {/* Form modal – Schedule Refill */}
      <Modal transparent animationType="slide" visible={formVisible} onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.card, { width: Math.min(screenWidth * 0.92, 440) }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Schedule Refill</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}>
               
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 24 }}>
              <View style={styles.field}>
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity onPress={showDate}>
                  <TextInput
                    style={styles.input}
                    value={dateTime.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    editable={false}
                  />
                </TouchableOpacity>
                {Platform.OS === 'ios' && showDateIOS && (
                  <DateTimePicker value={dateTime} mode="date" onChange={onDateChangeIOS} />
                )}
                {Platform.OS === 'android' && showDateAndroid && (
                  <DateTimePicker value={dateTime} mode="date" onChange={onDateChangeAndroid} />
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Time</Text>
                <TouchableOpacity onPress={showTime}>
                  <TextInput
                    style={styles.input}
                    value={dateTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    editable={false}
                  />
                </TouchableOpacity>
                {Platform.OS === 'ios' && showTimeIOS && (
                  <DateTimePicker value={dateTime} mode="time" onChange={onTimeChangeIOS} />
                )}
                {Platform.OS === 'android' && showTimeAndroid && (
                  <DateTimePicker
                    value={tempDateAndroid}
                    mode="time"
                    onChange={onTimeChangeAndroid}
                  />
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Water Type</Text>
                <View style={styles.waterTypeRow}>
                  <TouchableOpacity
                    style={[styles.waterTypeBtn, styles.waterTypeFresh, waterType === 'refill from freshwater' && styles.waterTypeFreshActive]}
                    onPress={() => setWaterType('refill from freshwater')}
                  >
                    <Text style={[styles.waterTypeTxt, waterType === 'refill from freshwater' && styles.waterTypeFreshTxtActive]}>Fresh Water</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.waterTypeBtn, styles.waterTypeBrackish, waterType === 'refill from brackishwater' && styles.waterTypeBrackishActive]}
                    onPress={() => setWaterType('refill from brackishwater')}
                  >
                    <Text style={[styles.waterTypeTxt, waterType === 'refill from brackishwater' && styles.waterTypeBrackishTxtActive]}>Brackish Water</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => setFormVisible(false)}
              >
                <Text style={styles.btnTxtCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={saveAction}>
                <Text style={styles.btnTxt}>Schedule Refill</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History modal */}
      <Modal
        transparent
        animationType="slide"
        visible={historyVisible}
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.card, { width: Math.min(screenWidth * 0.94, 520) }]}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <Text style={styles.closeTxt}>← </Text>
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.title}>Refill History</Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <Text style={styles.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={allWaterActions.filter((r) => !['pending', 'in_progress'].includes(r.action_status))}
              keyExtractor={(item) => item.wm_id.toString()}
              renderItem={renderAction}
              ListEmptyComponent={<Text style={styles.emptyText}>No past refill actions found.</Text>}
              contentContainerStyle={{ padding: 20 }}
              ListHeaderComponent={() => {
                const histData = allWaterActions.filter((r) => !['pending', 'in_progress'].includes(r.action_status));
                if (histData.length === 0) return null;
                const completed = histData.filter((r) => r.action_status === 'completed').length;
                const failed = histData.filter((r) => ['failed', 'canceled'].includes(r.action_status)).length;
                const timelineItems = histData.slice(0, 10);
                return (
                  <View style={histStyles.summaryContainer}>
                    <Text style={histStyles.summaryTitle}>Summary</Text>
                    <View style={histStyles.statsRow}>
                      <View style={histStyles.statBox}>
                        <Text style={histStyles.statValue}>{histData.length}</Text>
                        <Text style={histStyles.statLabel}>Total</Text>
                      </View>
                      <View style={histStyles.statBox}>
                        <Text style={[histStyles.statValue, { color: '#22C55E' }]}>{completed}</Text>
                        <Text style={histStyles.statLabel}>Completed</Text>
                      </View>
                      <View style={histStyles.statBox}>
                        <Text style={[histStyles.statValue, { color: '#EF4444' }]}>{failed}</Text>
                        <Text style={histStyles.statLabel}>Failed/Canceled</Text>
                      </View>
                    </View>
                    <Text style={[histStyles.summaryTitle, { marginTop: 16 }]}>Recent Activity</Text>
                    {timelineItems.map((r, idx) => {
                      const color = getStatusColor(r.action_status);
                      const label = formatDateTime(r.scheduled_timestamp);
                      const statusText = getStatusText(r.action_status);
                      return (
                        <View key={r.wm_id} style={histStyles.timelineRow}>
                          <View style={[histStyles.timelineDot, { backgroundColor: color }]} />
                          {idx < timelineItems.length - 1 && <View style={histStyles.timelineLine} />}
                          <View style={histStyles.timelineContent}>
                            <Text style={histStyles.timelineDate}>{label}</Text>
                            <View style={[histStyles.timelineBadge, { backgroundColor: color + '22' }]}>
                              <Text style={[histStyles.timelineBadgeText, { color }]}>{statusText}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    maxHeight: '88%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F0EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeTxt: {
    fontSize: 18,
    color: '#6B7280',
    lineHeight: 22,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: '#FAFAF8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0EDE8',
  },
  activeCard: {
    borderColor: '#FBBF24',
    backgroundColor: '#FFFBEB',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dateLarge: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    paddingRight: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelTxt: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: '#FF8C00',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 12,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  addTxt: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  historyLink: {
    color: '#FF8C00',
    fontWeight: '600',
    fontSize: 14,
  },
  field: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
  },
  readonlyValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    padding: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  waterTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  waterTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  waterTypeFresh: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  waterTypeFreshActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#DBEAFE',
  },
  waterTypeBrackish: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  waterTypeBrackishActive: {
    borderColor: '#22C55E',
    backgroundColor: '#DCFCE7',
  },
  waterTypeTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  waterTypeFreshTxtActive: {
    color: '#1D4ED8',
  },
  waterTypeBrackishTxtActive: {
    color: '#15803D',
  },
  actionTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F0EB',
    backgroundColor: '#FFFFFF',
  },
  btn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#F3F4F6',
  },
  btnSave: {
    backgroundColor: '#FF8C00',
  },
  btnTxt: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  btnTxtCancel: {
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 14,
  },
});

const histStyles = StyleSheet.create({
  summaryContainer: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
    marginRight: 10,
    flexShrink: 0,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 15,
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineDate: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  timelineBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  timelineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default WaterManagement; 