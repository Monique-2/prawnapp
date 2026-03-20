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

  const screenWidth = Dimensions.get('window').width;

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('en-US', {
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

  const updateStatusFromDate = (dt = dateTime) => {
    setStatus(dt > new Date() ? 'pending' : 'completed');
  };

  // ─── API ───────────────────────────────────────────────────────────────────
  const saveAction = async () => {
    if (!pond) {
      Alert.alert('Error', 'No pond selected.');
      return;
    }

    // MySQL-friendly format: 2025-03-20 13:45:00
    const scheduled = dateTime.toISOString().slice(0, 19).replace('T', ' ');

    try {
      const payload = {
        pond_id: Number(pond.id),
        action_type: 'refill' as const,
        scheduled_timestamp: scheduled,
        action_status: status,
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
        Alert.alert('Success', 'Refill scheduled successfully.');
        resetForm();
        onRefreshAllWaterActions();
        setFormVisible(false);
      } else {
        Alert.alert('Error', json.message || 'Failed to schedule refill.');
      }
    } catch (err) {
      console.error('Save action failed:', err);
      Alert.alert('Error', 'Failed to save refill. Please check your connection.');
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
        Alert.alert('Success', 'Refill has been canceled.');
        onRefreshAllWaterActions();
        setHistoryVisible(false);
      } else {
        Alert.alert('Error', json.message || 'Failed to cancel refill.');
      }
    } catch (err) {
      console.error('Cancel action failed:', err);
      Alert.alert('Error', 'Could not cancel the refill at this time.');
    }
  };

  // ─── Form logic ────────────────────────────────────────────────────────────
  const resetForm = () => {
    const now = new Date();
    setDateTime(now);
    setTempDateAndroid(now);
    setStatus('pending');
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
                <Text style={styles.label}>Action</Text>
                <Text style={styles.readonlyValue}>Refill</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Status</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#f3f4f6' }]}
                  value={getStatusText(status)}
                  editable={false}
                />
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
    backgroundColor: '#fefaf4',
    borderRadius: 20,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fef3c7',
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d44',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400e',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  closeBtn: {
    padding: 18,
  },
  closeTxt: {
    fontSize: 24,
    color: '#6b7280',
  },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activeCard: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateLarge: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
    flex: 1,
    paddingRight: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tagText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelTxt: {
    color: '#dc2626',
    fontWeight: '600',
  },
  addBtn: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
  },
  addTxt: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  historyLink: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 15,
  },
  field: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  readonlyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    padding: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fef3c7',
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#f3f4f6',
  },
  btnSave: {
    backgroundColor: '#f97316',
  },
  btnTxt: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  btnTxtCancel: {
    color: '#4b5563',
    fontWeight: '600',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 15,
  },
});

export default WaterManagement; 