// app/components/FeedingManagementAction.tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useMemo, useState } from 'react';
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

interface Pond {
  id: string;
  pond_name: string;
}

interface FeedingAction {
  fm_id: number;
  pond_id: number;
  scheduled_timestamp: string;
  amount_of_feed: number;
  feed_unit: 'g' | 'kg';
  action_status: 'pending' | 'feeding' | 'completed' | 'canceled_by_user' | 'canceled_by_ai' | 'failed';
  control_mode: 'ai mode' | 'manual mode';
  fd_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface FeedingManagementProps {
  selectedPond: Pond | null;
  FEEDING_URL: string;
  onClose: () => void;
  onRefreshFeedings: (pondId: string) => Promise<void>;
  onRefreshAllFeedings: () => Promise<void>;
}

export default function FeedingManagementAction({
  selectedPond,
  FEEDING_URL,
  onClose,
  onRefreshFeedings,
  onRefreshAllFeedings,
}: FeedingManagementProps) {
  const [formVisible, setFormVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [actions, setActions] = useState<FeedingAction[]>([]);

  const [scheduledDateTime, setScheduledDateTime] = useState(new Date());
  const [showDateIOS, setShowDateIOS] = useState(false);
  const [showTimeIOS, setShowTimeIOS] = useState(false);
  const [showDateAndroid, setShowDateAndroid] = useState(false);
  const [showTimeAndroid, setShowTimeAndroid] = useState(false);
  const [tempDateAndroid, setTempDateAndroid] = useState(new Date());

  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'g' | 'kg'>('g');
  const [mode, setMode] = useState<'ai mode' | 'manual mode'>('ai mode');

  const screenWidth = Dimensions.get('window').width;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const getStatusText = (s: FeedingAction['action_status']): string =>
    ({
      pending: 'Pending',
      feeding: 'Feeding Now',
      completed: 'Completed',
      canceled_by_user: 'Canceled',
      canceled_by_ai: 'Canceled by AI',
      failed: 'Failed',
    }[s] ?? s);

  const getStatusColor = (s: FeedingAction['action_status']): string =>
    ({
      completed: '#22C55E',
      pending: '#F59E0B',
      feeding: '#3B82F6',
      canceled_by_user: '#EF4444',
      canceled_by_ai: '#EF4444',
      failed: '#EF4444',
    }[s] ?? '#6B7280');

  const isFuture = (ts: string) => new Date(ts) > new Date();

  const onDateChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'ios') setShowDateIOS(false);
    else setShowDateAndroid(false);
    if (selected) {
      const next = new Date(scheduledDateTime);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setScheduledDateTime(next);
    }
  };

  const onTimeChange = (_: any, selected?: Date) => {
    if (Platform.OS === 'ios') setShowTimeIOS(false);
    else setShowTimeAndroid(false);
    if (selected) {
      const next = new Date(scheduledDateTime);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setScheduledDateTime(next);
    }
  };

  const showDatePicker = () => {
    Platform.OS === 'ios' ? setShowDateIOS(true) : setShowDateAndroid(true);
  };

  const showTimePicker = () => {
    if (Platform.OS === 'ios') {
      setShowTimeIOS(true);
    } else {
      setTempDateAndroid(new Date(scheduledDateTime));
      setShowTimeAndroid(true);
    }
  };

  const resetForm = () => {
    const nowPlus1h = new Date();
    nowPlus1h.setHours(nowPlus1h.getHours() + 1);
    setScheduledDateTime(nowPlus1h);
    setTempDateAndroid(nowPlus1h);
    setAmount('');
    setUnit('g');
    setMode('ai mode');
  };

  const fetchActions = async (pondId: string) => {
    try {
      const res = await fetch(`${FEEDING_URL}?pond_id=${pondId}`);
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();

      if (json.success && Array.isArray(json.data?.records)) {
        setActions(
          json.data.records
            .map((r: any) => ({
              ...r,
              feed_unit: r.feed_unit ?? 'g',
              control_mode: r.control_mode ?? 'ai mode',
              amount_of_feed: typeof r.amount_of_feed === 'number'
                ? r.amount_of_feed
                : parseFloat(r.amount_of_feed || '0') || 0,
            }))
            .sort((a: FeedingAction, b: FeedingAction) =>
              new Date(b.scheduled_timestamp).getTime() - new Date(a.scheduled_timestamp).getTime()
            )
        );
      } else {
        setActions([]);
      }
    } catch (err) {
      console.error(err);
      setActions([]);
    }
  };

  const createFeedingAction = async () => {
    if (!selectedPond || !amount.trim()) {
      Alert.alert('Error', 'Please enter amount of feed.');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Amount must be positive.');
      return;
    }

    const isoTimestamp = scheduledDateTime.toISOString().slice(0, 19).replace('T', ' ');

    const optimistic: FeedingAction = {
      fm_id: -Date.now(),
      pond_id: parseInt(selectedPond.id),
      scheduled_timestamp: isoTimestamp,
      amount_of_feed: amt,
      feed_unit: unit,
      action_status: isFuture(isoTimestamp) ? 'pending' : 'completed',
      control_mode: mode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setActions((prev) =>
      [...prev, optimistic].sort((a: FeedingAction, b: FeedingAction) =>
        new Date(b.scheduled_timestamp).getTime() - new Date(a.scheduled_timestamp).getTime()
      )
    );

    try {
      const res = await fetch(FEEDING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pond_id: parseInt(selectedPond.id),
          scheduled_timestamp: isoTimestamp,
          amount_of_feed: amt,
          feed_unit: unit,
          control_mode: mode,
          action_status: optimistic.action_status,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.fm_id) {
        setActions((prev) =>
          prev.map((r) => (r.fm_id === optimistic.fm_id ? { ...json.data, feed_unit: json.data.feed_unit ?? 'g' } : r))
        );
        Alert.alert('Success', 'Feeding action scheduled.');
        resetForm();
        setFormVisible(false);
        await onRefreshFeedings(selectedPond.id);
        await onRefreshAllFeedings();
      } else {
        setActions((prev) => prev.filter((r) => r.fm_id !== optimistic.fm_id));
        Alert.alert('Error', json.message || 'Failed to create schedule.');
      }
    } catch (err) {
      setActions((prev) => prev.filter((r) => r.fm_id !== optimistic.fm_id));
      Alert.alert('Error', 'Network or server error.');
    }
  };

  const cancelAction = async (fm_id: number) => {
    const prevActions = [...actions];

    setActions((prev) =>
      prev
        .map((a) =>
          a.fm_id === fm_id
            ? { ...a, action_status: 'canceled_by_user' as const, updated_at: new Date().toISOString() }
            : a
        )
        .sort((a: FeedingAction, b: FeedingAction) =>
          new Date(b.scheduled_timestamp).getTime() - new Date(a.scheduled_timestamp).getTime()
        )
    );

    try {
      const res = await fetch(`${FEEDING_URL}?fm_id=${fm_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_status: 'canceled_by_user' }),
      });

      const json = await res.json();
      if (!json.success) {
        setActions(prevActions);
        Alert.alert('Error', json.message || 'Cancel failed.');
      } else {
        Alert.alert('Success', 'Feeding action canceled.');
        await onRefreshFeedings(selectedPond!.id);
        await onRefreshAllFeedings();
      }
    } catch {
      setActions(prevActions);
      Alert.alert('Error', 'Network error while canceling.');
    }
  };

  useEffect(() => {
    if (selectedPond?.id) {
      fetchActions(selectedPond.id);
    } else {
      setActions([]);
    }
  }, [selectedPond?.id]);

  const activeActions = useMemo(
    () =>
      actions
        .filter((a) => ['pending', 'feeding'].includes(a.action_status))
        .sort((a: FeedingAction, b: FeedingAction) =>
          new Date(a.scheduled_timestamp).getTime() - new Date(b.scheduled_timestamp).getTime()
        ),
    [actions]
  );

  const historyActions = useMemo(
    () => actions.filter((a) => !['pending', 'feeding'].includes(a.action_status)),
    [actions]
  );

  if (!selectedPond) return null;

  const renderAction = ({ item }: { item: FeedingAction }) => {
    const isActive = ['pending', 'feeding'].includes(item.action_status);
    const canCancel = isActive;

    return (
      <View style={[styles.actionCard, isActive && styles.activeCard]}>
        <View style={styles.actionHeader}>
          <View>
            <Text style={styles.dateLarge}>{formatDate(item.scheduled_timestamp)}</Text>
            <Text style={styles.timeText}>{formatTime(item.scheduled_timestamp)}</Text>
          </View>
          {canCancel && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() =>
                Alert.alert(
                  item.action_status === 'feeding' ? 'Stop Feeding?' : 'Cancel Schedule?',
                  'Are you sure?',
                  [
                    { text: 'No' },
                    { text: 'Yes', onPress: () => cancelAction(item.fm_id) },
                  ]
                )
              }
            >
              <Text style={styles.cancelTxt}>{item.action_status === 'feeding' ? 'Stop' : 'Cancel'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.detailsRow}>
          <View>
            <Text style={styles.labelSmall}>Amount</Text>
            <Text style={styles.value}>
              {Number(item.amount_of_feed || 0).toFixed(1)} {item.feed_unit.toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.labelSmall}>Mode</Text>
            <Text style={styles.valueSmall}>{item.control_mode}</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.labelSmall}>Status</Text>
          <View style={[styles.tag, { backgroundColor: getStatusColor(item.action_status) }]}>
            <Text style={styles.tagText}>{getStatusText(item.action_status)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Modal transparent animationType="slide" visible={true} onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.card, { width: Math.min(screenWidth * 0.94, 520) }]}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Feeding Management</Text>
                <Text style={styles.subtitle}>Pond: {selectedPond.pond_name}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={activeActions}
              keyExtractor={(item) => item.fm_id.toString()}
              renderItem={renderAction}
              ListHeaderComponent={() => (
                <View style={styles.headerRow}>
                  <Text style={styles.section}>Active / Pending</Text>
                  {historyActions.length > 0 && (
                    <TouchableOpacity onPress={() => setHistoryVisible(true)}>
                      <Text style={styles.historyLink}>View History →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No pending or active feeding actions.</Text>}
              ListFooterComponent={() => (
                <TouchableOpacity style={styles.addBtn} onPress={() => setFormVisible(true)}>
                  <Text style={styles.addTxt}>+ Schedule New Feeding</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: 20 }}
            />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={historyVisible} onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.card, { width: Math.min(screenWidth * 0.94, 520) }]}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <Text style={styles.closeTxt}>←</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.title}>Feeding History</Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <Text style={styles.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={historyActions}
              renderItem={renderAction}
              keyExtractor={(item) => item.fm_id.toString()}
              ListEmptyComponent={<Text style={styles.emptyText}>No past feeding records.</Text>}
              contentContainerStyle={{ padding: 20 }}
            />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={formVisible} onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.card, { width: Math.min(screenWidth * 0.92, 440) }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Schedule Feeding</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)}>
                <Text style={styles.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 24 }}>
              <View style={styles.field}>
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity onPress={showDatePicker}>
                  <TextInput
                    style={styles.input}
                    value={scheduledDateTime.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    editable={false}
                  />
                </TouchableOpacity>
                {Platform.OS === 'ios' && showDateIOS && (
                  <DateTimePicker value={scheduledDateTime} mode="date" onChange={onDateChange} />
                )}
                {Platform.OS === 'android' && showDateAndroid && (
                  <DateTimePicker value={scheduledDateTime} mode="date" onChange={onDateChange} />
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Time</Text>
                <TouchableOpacity onPress={showTimePicker}>
                  <TextInput
                    style={styles.input}
                    value={scheduledDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    editable={false}
                  />
                </TouchableOpacity>
                {Platform.OS === 'ios' && showTimeIOS && (
                  <DateTimePicker value={scheduledDateTime} mode="time" onChange={onTimeChange} />
                )}
                {Platform.OS === 'android' && showTimeAndroid && (
                  <DateTimePicker value={tempDateAndroid} mode="time" onChange={onTimeChange} />
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Amount of Feed</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 450"
                  />
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={unit} onValueChange={(v: 'g' | 'kg') => setUnit(v)} style={{ height: 50 }}>
                      <Picker.Item label="grams" value="g" />
                      <Picker.Item label="kg" value="kg" />
                    </Picker>
                  </View>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Control Mode</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={mode}
                    onValueChange={(v: 'ai mode' | 'manual mode') => setMode(v)}
                    style={{ height: 50 }}
                  >
                    <Picker.Item label="AI Mode" value="ai mode" />
                    <Picker.Item label="Manual Mode" value="manual mode" />
                  </Picker>
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setFormVisible(false)}>
                <Text style={styles.btnTxtCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={createFeedingAction}>
                <Text style={styles.btnTxt}>Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

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
  title: { fontSize: 20, fontWeight: '700', color: '#92400e' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  closeBtn: { padding: 12 },
  closeTxt: { fontSize: 24, color: '#6b7280' },
  section: { fontSize: 18, fontWeight: '700', color: '#92400e', marginBottom: 12 },
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
  dateLarge: { fontSize: 17, fontWeight: '700', color: '#92400e' },
  timeText: { fontSize: 15, color: '#4b5563', marginTop: 2 },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  labelSmall: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  valueSmall: { fontSize: 15, color: '#1f2937' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: { color: 'white', fontSize: 12, fontWeight: '600' },
  cancelBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelTxt: { color: '#dc2626', fontWeight: '600' },
  addBtn: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
  },
  addTxt: { color: 'white', fontSize: 16, fontWeight: '600' },
  historyLink: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 15,
  },
  field: { marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '600', color: '#92400e', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    overflow: 'hidden',
    flex: 1,
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
  btnCancel: { backgroundColor: '#f3f4f6' },
  btnSave: { backgroundColor: '#f97316' },
  btnTxt: { color: 'white', fontSize: 16, fontWeight: '600' },
  btnTxtCancel: { color: '#4b5563', fontWeight: '600' },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 15,
  },
});