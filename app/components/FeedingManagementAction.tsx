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
import { cancelFeedingNotification, scheduleFeedingNotification } from '../utils/notifications';
import AppToast, { ToastType } from './AppToast';

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
  const [modeConfirmVisible, setModeConfirmVisible] = useState(false);
  const [actions, setActions] = useState<FeedingAction[]>([]);
  const [feedingMode, setFeedingMode] = useState<'ai mode' | 'manual mode'>('ai mode');

  const [scheduledDateTime, setScheduledDateTime] = useState(new Date());
  const [showDateIOS, setShowDateIOS] = useState(false);
  const [showTimeIOS, setShowTimeIOS] = useState(false);
  const [showDateAndroid, setShowDateAndroid] = useState(false);
  const [showTimeAndroid, setShowTimeAndroid] = useState(false);
  const [tempDateAndroid, setTempDateAndroid] = useState(new Date());

  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'g' | 'kg'>('g');
  const [mode, setMode] = useState<'ai mode' | 'manual mode'>('ai mode');
  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; title: string; message?: string }>({ visible: false, type: 'success', title: '' });

  const showToast = (type: ToastType, title: string, message?: string) => {
    setToast({ visible: true, type, title, message });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  const screenWidth = Dimensions.get('window').width;

  const formatDate = (iso: string) =>
    new Date(iso.replace(' ', 'T')).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (iso: string) =>
    new Date(iso.replace(' ', 'T')).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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

  const isFuture = (ts: string) => new Date(ts.replace(' ', 'T')) > new Date();

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

    const pad = (n: number) => String(n).padStart(2, '0');
    const isoTimestamp = `${scheduledDateTime.getFullYear()}-${pad(scheduledDateTime.getMonth() + 1)}-${pad(scheduledDateTime.getDate())} ${pad(scheduledDateTime.getHours())}:${pad(scheduledDateTime.getMinutes())}:00`;

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
          control_mode: 'manual mode',
          action_status: optimistic.action_status,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.fm_id) {
        setActions((prev) =>
          prev.map((r) => (r.fm_id === optimistic.fm_id ? { ...json.data, feed_unit: json.data.feed_unit ?? 'g' } : r))
        );
        // Schedule a local push notification at the feeding time
        scheduleFeedingNotification(
          json.data.fm_id,
          selectedPond.pond_name,
          scheduledDateTime,
          amt,
          unit,
        ).catch(console.error);
        showToast('success', 'Feeding Scheduled', 'Your feeding action has been saved.');
        resetForm();
        setFormVisible(false);
        await onRefreshFeedings(selectedPond.id);
        await onRefreshAllFeedings();
      } else {
        setActions((prev) => prev.filter((r) => r.fm_id !== optimistic.fm_id));
        showToast('error', 'Failed', json.message || 'Failed to create schedule.');
      }
    } catch (err) {
      setActions((prev) => prev.filter((r) => r.fm_id !== optimistic.fm_id));
      showToast('error', 'Network Error', 'Could not reach the server.');
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
        // Cancel the scheduled notification for this feeding
        cancelFeedingNotification(fm_id).catch(console.error);
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
            <AppToast visible={toast.visible} type={toast.type} title={toast.title} message={toast.message} />
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Feeding Management</Text>
                <Text style={styles.subtitle}>Pond: {selectedPond.pond_name}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.modeBadge,
                  feedingMode === 'ai mode' ? styles.modeBadgeAI : styles.modeBadgeManual,
                ]}
                onPress={() => setModeConfirmVisible(true)}
              >
                <Text style={[
                  styles.modeBadgeTxt,
                  feedingMode === 'ai mode' ? styles.modeBadgeTxtAI : styles.modeBadgeTxtManual,
                ]}>
                  {feedingMode === 'ai mode' ? 'AI Mode' : 'Manual Mode'}
                </Text>
              </TouchableOpacity>
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
              ListFooterComponent={() =>
                feedingMode === 'manual mode' ? (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setFormVisible(true)}>
                    <Text style={styles.addTxt}>+ Schedule New Feeding</Text>
                  </TouchableOpacity>
                ) : null
              }
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
              ListHeaderComponent={() => {
                if (historyActions.length === 0) return null;
                const totalFed = historyActions.reduce((sum, r) => {
                  const amt = Number(r.amount_of_feed) || 0;
                  const grams = r.feed_unit === 'kg' ? amt * 1000 : amt;
                  return sum + grams;
                }, 0);
                const completed = historyActions.filter((r) => r.action_status === 'completed').length;
                const failed = historyActions.filter((r) =>
                  ['failed', 'canceled_by_user', 'canceled_by_ai'].includes(r.action_status)
                ).length;
                const chartItems = historyActions.slice(0, 8);
                const maxGrams = Math.max(...chartItems.map((r) => {
                  const amt = Number(r.amount_of_feed) || 0;
                  return r.feed_unit === 'kg' ? amt * 1000 : amt;
                }), 1);
                return (
                  <View style={histStyles.summaryContainer}>
                    <Text style={histStyles.summaryTitle}>Summary</Text>
                    <View style={histStyles.statsRow}>
                      <View style={histStyles.statBox}>
                        <Text style={histStyles.statValue}>{historyActions.length}</Text>
                        <Text style={histStyles.statLabel}>Total</Text>
                      </View>
                      <View style={histStyles.statBox}>
                        <Text style={[histStyles.statValue, { color: '#22C55E' }]}>{completed}</Text>
                        <Text style={histStyles.statLabel}>Completed</Text>
                      </View>
                      <View style={histStyles.statBox}>
                        <Text style={[histStyles.statValue, { color: '#EF4444' }]}>{failed}</Text>
                        <Text style={histStyles.statLabel}>Missed/Failed</Text>
                      </View>
                      <View style={histStyles.statBox}>
                        <Text style={histStyles.statValue}>{totalFed >= 1000 ? `${(totalFed / 1000).toFixed(1)}kg` : `${totalFed.toFixed(0)}g`}</Text>
                        <Text style={histStyles.statLabel}>Total Fed</Text>
                      </View>
                    </View>
                    <Text style={[histStyles.summaryTitle, { marginTop: 16 }]}>Recent Feedings (g)</Text>
                    {chartItems.map((r) => {
                      const amt = Number(r.amount_of_feed) || 0;
                      const grams = r.feed_unit === 'kg' ? amt * 1000 : amt;
                      const barW = Math.max((grams / maxGrams) * 100, 4);
                      const color = getStatusColor(r.action_status);
                      const dateLabel = new Date(r.scheduled_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      return (
                        <View key={r.fm_id} style={histStyles.barRow}>
                          <Text style={histStyles.barLabel}>{dateLabel}</Text>
                          <View style={histStyles.barTrack}>
                            <View style={[histStyles.barFill, { width: `${barW}%`, backgroundColor: color }]} />
                          </View>
                          <Text style={histStyles.barValue}>{grams.toFixed(0)}g</Text>
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

      <Modal transparent animationType="fade" visible={modeConfirmVisible} onRequestClose={() => setModeConfirmVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.card, { width: Math.min(screenWidth * 0.85, 360), maxHeight: 'auto' as any }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Change Feeding Mode</Text>
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <TouchableOpacity
                style={[styles.modeOptionBtn, feedingMode === 'ai mode' && styles.modeOptionBtnActive]}
                onPress={() => { setFeedingMode('ai mode'); setModeConfirmVisible(false); }}
              >
                <Text style={[styles.modeOptionTxt, feedingMode === 'ai mode' && styles.modeOptionTxtActive]}>AI Mode</Text>
                <Text style={styles.modeOptionDesc}>Feeding is managed automatically by AI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeOptionBtn, feedingMode === 'manual mode' && styles.modeOptionBtnActive]}
                onPress={() => { setFeedingMode('manual mode'); setModeConfirmVisible(false); }}
              >
                <Text style={[styles.modeOptionTxt, feedingMode === 'manual mode' && styles.modeOptionTxtActive]}>Manual Mode</Text>
                <Text style={styles.modeOptionDesc}>You schedule feedings manually</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnCancel, { marginTop: 4 }]} onPress={() => setModeConfirmVisible(false)}>
                <Text style={styles.btnTxtCancel}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={formVisible} onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.card, { width: Math.min(screenWidth * 0.92, 440) }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Schedule Feeding</Text>
              <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.closeBtn}>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  title: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeTxt: { fontSize: 18, color: '#6B7280', lineHeight: 22 },
  modeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    marginLeft: 8,
  },
  modeBadgeAI: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  modeBadgeManual: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  modeBadgeTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  modeBadgeTxtAI: {
    color: '#1D4ED8',
  },
  modeBadgeTxtManual: {
    color: '#15803D',
  },
  modeOptionBtn: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  modeOptionBtnActive: {
    borderColor: '#FF8C00',
    backgroundColor: '#FFF7ED',
  },
  modeOptionTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 3,
  },
  modeOptionTxtActive: {
    color: '#FF8C00',
  },
  modeOptionDesc: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  section: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
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
  dateLarge: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  timeText: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  labelSmall: { fontSize: 11, color: '#9CA3AF', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  valueSmall: { fontSize: 14, color: '#374151' },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: { color: 'white', fontSize: 12, fontWeight: '700' },
  cancelBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelTxt: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
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
  addTxt: { color: 'white', fontSize: 16, fontWeight: '700' },
  historyLink: {
    color: '#FF8C00',
    fontWeight: '600',
    fontSize: 14,
  },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
    flex: 1,
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
  btnCancel: { backgroundColor: '#F3F4F6' },
  btnSave: { backgroundColor: '#FF8C00' },
  btnTxt: { color: 'white', fontSize: 15, fontWeight: '700' },
  btnTxtCancel: { color: '#6B7280', fontWeight: '600' },
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
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  barLabel: {
    width: 50,
    fontSize: 11,
    color: '#6b7280',
  },
  barTrack: {
    flex: 1,
    height: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 7,
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  barFill: {
    height: 14,
    borderRadius: 7,
  },
  barValue: {
    width: 44,
    fontSize: 11,
    color: '#374151',
    textAlign: 'right',
  },
});