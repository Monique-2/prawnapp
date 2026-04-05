// app/index.tsx
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';


import AddPond from './components/AddPond';
import FeedingManagementAction from './components/FeedingManagementAction';
import NotificationsPanel from './components/NotificationsPanel';
import WaterManagement from './components/WaterManagement';
import WaterQualityParameters from './components/WaterQualityParameters';

export interface Pond {
  id: string;
  pond_name: string;
  pond_size: string;
  num_prawns: string;
  age: string;
  location?: string;
  created_at: string;
  status?: string;
  updated_at?: string;
}

export interface PostResponse {
  success: boolean;
  message: string;
}

export interface ParameterRecord {
  id: number;
  pond_id: number;
  temperature: string;
  dissolved_oxygen: string;
  pH: string;
  salinity: string;
  ammonia: string;
  updated_at: string;
  pond_code: string;
}

export interface ParameterInfo {
  description: string;
  color: string;
  unit: string;
}

export interface FeedingRecord {
  id: number;
  pond_id: number;
  feeding_schedule: string;
  amount_of_feed: number;
  feed_unit: 'g' | 'kg';
  time_schedule: string;
  status: 'pending' | 'feeding' | 'completed' | 'canceled_by_user' | 'canceled_by_ai' | 'failed';
  feeding_mode: 'ai mode' | 'manual mode';
  created_at: string;
  updated_at: string;
  fd_id?: number;
}

export interface WaterManagementRecord {
  wm_id: number;
  pond_id: number;
  wd_id?: number;
  action_type: 'refill from freshwater' | 'refill from brackishwater';
  scheduled_timestamp: string;
  action_status: 'pending' | 'in_progress' | 'completed' | 'canceled' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'feeding' | 'water' | 'pond' | 'alert';
  timestamp: string;
  read: boolean;
}

export default function HomeScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [selectedPondForFeeding, setSelectedPondForFeeding] = useState<Pond | null>(null);
  const [selectedPondForWater, setSelectedPondForWater] = useState<Pond | null>(null);
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [parameters, setParameters] = useState<{ [key: string]: ParameterRecord }>({});
  const [allFeedings, setAllFeedings] = useState<FeedingRecord[]>([]);
  const [allWaterActions, setAllWaterActions] = useState<WaterManagementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form states for adding pond
  const [pondSize, setPondSize] = useState('');
  const [numPrawns, setNumPrawns] = useState('');
  const [age, setAge] = useState('');
  const [pondName, setPondName] = useState('');
  const [location, setLocation] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [cityMunicipality, setCityMunicipality] = useState('');
  const [province, setProvince] = useState('');
  const [country, setCountry] = useState('Philippines');
  const [region, setRegion] = useState({
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [markerCoords, setMarkerCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Notification modal state
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Load persisted notification state on mount
  useEffect(() => {
    AsyncStorage.multiGet(['notif_read_ids', 'notif_deleted_ids']).then((pairs) => {
      pairs.forEach(([key, value]) => {
        if (!value) return;
        try {
          const arr: string[] = JSON.parse(value);
          if (key === 'notif_read_ids') setReadIds(new Set(arr));
          if (key === 'notif_deleted_ids') setDeletedIds(new Set(arr));
        } catch {}
      });
    });
  }, []);

  const markNotificationRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem('notif_read_ids', JSON.stringify([...next]));
      return next;
    });
  };

  const deleteNotification = (id: string) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem('notif_deleted_ids', JSON.stringify([...next]));
      return next;
    });
  };

  // Ticks every minute so water-change reminders stay accurate
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const screenWidth = Dimensions.get('window').width;
  const BASE_URL = 'http://136.112.99.103/';
  const PONDS_URL = `${BASE_URL}ponds.php`;
  const FEEDING_URL = `${BASE_URL}feeding_management_action.php`;
  const WATER_URL = `${BASE_URL}water_management_action.php`;
  const PARAMETERS_URL = `${BASE_URL}smart_prawn_parameters.php`;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const parameterInfo: { [key in 'Water' | 'Feeding']: ParameterInfo } = {
    Water: { description: 'Volume of reserve water available.', color: '#FFF7E6', unit: 'L' },
    Feeding: { description: 'Amount of feed provided to prawns.', color: '#FFF7E6', unit: '' },
  };

  const getStatusInfo = (status: string): { display: string; color: string } => {
    const statuses = {
      new: { display: 'New', color: '#3B82F6' },
      active: { display: 'Active', color: '#10B981' },
      good: { display: 'Good', color: '#22C55E' },
      moderate: { display: 'Moderate', color: '#F59E0B' },
      critical: { display: 'Critical', color: '#EF4444' },
      under_maintenance: { display: 'Under Maintenance', color: '#F97316' },
      inactive: { display: 'Inactive', color: '#6B7280' },
      harvested: { display: 'Harvested', color: '#14B8A6' },
      feeding_alert: { display: 'Feeding Alert', color: '#F87171' },
      water_alert: { display: 'Water Alert', color: '#FCA5A5' },
    };
    return statuses[status as keyof typeof statuses] || { display: status, color: '#EF4444' };
  };

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}] ${message}`, data || '');
  };

  const getStatusDisplay = (status: FeedingRecord['status']): string =>
    ({
      pending: 'Pending',
      feeding: 'Feeding',
      completed: 'Completed',
      canceled_by_user: 'Canceled by User',
      canceled_by_ai: 'Canceled by AI',
      failed: 'Failed',
    }[status] || status);

  const getWaterStatusDisplay = (status: WaterManagementRecord['action_status']): string =>
    ({
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      canceled: 'Canceled',
      failed: 'Failed',
    }[status] || status);

  const getLatestWaterStatus = (pondId: string) => {
    const pondWaterActions = allWaterActions.filter((w) => w.pond_id === parseInt(pondId));
    if (pondWaterActions.length === 0) return 'No records yet';
    const latest = pondWaterActions[0];
    return `${getWaterStatusDisplay(latest.action_status)}: ${latest.action_type}`;
  };

  const generatePondName = () => {
    const existingNames = new Set(ponds.map((pond) => pond.pond_name));
    let index = 1;
    let newPondName = `PND-${String(index).padStart(3, '0')}`;
    while (existingNames.has(newPondName)) {
      index++;
      newPondName = `PND-${String(index).padStart(3, '0')}`;
    }
    return newPondName;
  };

  const fetchParameters = async () => {
    log('FETCH_PARAMETERS_START');
    try {
      const res = await fetch(`${BASE_URL}smart_prawn_parameters.php`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const paramMap: { [key: string]: ParameterRecord } = {};
        // Backend returns DESC by updated_at — first record per pond is already the latest
        data.data.forEach((param: ParameterRecord) => {
          const code = param.pond_code;
          if (!paramMap[code]) {
            paramMap[code] = param;
          }
        });
        setParameters(paramMap);
      }
    } catch (error) {
      log('FETCH_PARAMETERS_ERROR', error);
    }
  };

  const fetchAllFeedings = async () => {
    log('FETCH_ALL_FEEDINGS_START');
    try {
      const res = await fetch(FEEDING_URL);
      if (!res.ok) {
        if (res.status === 404) {
          setAllFeedings([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const sorted = data.data
          .map((record: any) => ({
            ...record,
            feed_unit: record.feed_unit || 'g',
            amount_of_feed:
              typeof record.amount_of_feed === 'number'
                ? record.amount_of_feed
                : parseFloat(record.amount_of_feed || '0') || 0,
          }))
          .sort((a: FeedingRecord, b: FeedingRecord) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        setAllFeedings(sorted);
      } else {
        setAllFeedings([]);
      }
    } catch (error) {
      log('FETCH_ALL_FEEDINGS_ERROR', error);
      setAllFeedings([]);
    }
  };

  const fetchAllWaterActions = async () => {
    log('FETCH_ALL_WATER_ACTIONS_START');
    try {
      const res = await fetch(WATER_URL);
      if (!res.ok) {
        if (res.status === 404) {
          setAllWaterActions([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const sorted = data.data.sort((a: WaterManagementRecord, b: WaterManagementRecord) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setAllWaterActions(sorted);
      } else {
        setAllWaterActions([]);
      }
    } catch (error) {
      log('FETCH_ALL_WATER_ACTIONS_ERROR', error);
      setAllWaterActions([]);
    }
  };

  const onRefreshFeedingsForPond = async (pondId: string): Promise<void> => {
    await fetchAllFeedings();
  };

  const fetchPonds = async () => {
    log('FETCH_PONDS_START');
    setLoading(true);
    try {
      const res = await fetch(PONDS_URL);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('JSON parse error:', err);
        Alert.alert('Error', 'Invalid server response.');
        return;
      }
      if (data.success && Array.isArray(data.data)) {
        const sortedPonds = data.data.sort((a: Pond, b: Pond) => {
          const aNum = parseInt(a.pond_name.split('-')[1] || '0', 10);
          const bNum = parseInt(b.pond_name.split('-')[1] || '0', 10);
          return aNum - bNum;
        });
        setPonds(sortedPonds);
        setPondName(generatePondName());
      } else {
        Alert.alert('Error', data.message || 'Server did not return a valid array.');
      }
    } catch (error) {
      log('FETCH_PONDS_ERROR', error);
      Alert.alert('Error', 'Could not fetch ponds. Please check your network.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deletePond = async (pondName: string) => {
    try {
      const res = await fetch(`${PONDS_URL}?pond_name=${pondName}`, { method: 'DELETE' });
      const data: PostResponse = await res.json();
      if (data.success) {
        Alert.alert('Success', data.message || 'Pond deleted!');
        fetchPonds();
        fetchParameters();
        fetchAllFeedings();
        fetchAllWaterActions();
      } else {
        Alert.alert('Failed', data.message || 'Could not delete pond.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server.');
    }
  };

  const confirmDelete = (pondName: string) => {
    Alert.alert('Delete Pond', `Are you sure you want to delete ${pondName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePond(pondName) },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPonds();
    fetchParameters();
    fetchAllFeedings();
    fetchAllWaterActions();
  };

  // Derive notifications from existing data — no extra fetch needed
  const notifications: AppNotification[] = useMemo(() => {
    const items: AppNotification[] = [];

    // ─── Water quality parameter alerts ──────────────────────────────────────
    ponds.forEach((pond) => {
      const param = parameters[pond.pond_name];
      if (!param) return;

      const temp     = parseFloat(param.temperature);
      const ph       = parseFloat(param.pH);
      const ammonia  = parseFloat(param.ammonia);
      const salinity = parseFloat(param.salinity);

      if (!isNaN(temp) && (temp <= 24 || temp >= 31)) {
        const nid = `alert-temp-${pond.id}-${param.updated_at}`;
        items.push({
          id: nid,
          title: '🌡️ Temperature Alert',
          message: `${pond.pond_name}: Temperature is ${temp}°C — outside safe range (25–30°C).`,
          type: 'alert',
          timestamp: param.updated_at,
          read: readIds.has(nid),
        });
      }

      if (!isNaN(ph) && (ph <= 7.28 || ph >= 7.81)) {
        const nid = `alert-ph-${pond.id}-${param.updated_at}`;
        items.push({
          id: nid,
          title: '🧪 pH Alert',
          message: `${pond.pond_name}: pH is ${ph} — outside safe range (7.29–7.80).`,
          type: 'alert',
          timestamp: param.updated_at,
          read: readIds.has(nid),
        });
      }

      if (!isNaN(ammonia) && ammonia > 0.1) {
        const nid = `alert-ammonia-${pond.id}-${param.updated_at}`;
        items.push({
          id: nid,
          title: '☣️ Ammonia Alert',
          message: `${pond.pond_name}: Ammonia is ${ammonia} ppm — above safe limit of 0.1 ppm.`,
          type: 'alert',
          timestamp: param.updated_at,
          read: readIds.has(nid),
        });
      }

      if (!isNaN(salinity) && (salinity < 20 || salinity > 30)) {
        const nid = `alert-salinity-${pond.id}-${param.updated_at}`;
        items.push({
          id: nid,
          title: '🌊 Salinity Alert',
          message: `${pond.pond_name}: Salinity is ${salinity} ppt — outside safe range (20–30 ppt).`,
          type: 'alert',
          timestamp: param.updated_at,
          read: readIds.has(nid),
        });
      }
    });

    // ─── Water change reminders (1 hour before scheduled time) ───────────────
    allWaterActions
      .filter((w) => w.action_status === 'pending')
      .forEach((w) => {
        const scheduledTime = new Date(w.scheduled_timestamp);
        const msUntil = scheduledTime.getTime() - now.getTime();
        const oneHour = 60 * 60 * 1000;
        if (msUntil > 0 && msUntil <= oneHour) {
          const minutesLeft = Math.round(msUntil / 60_000);
          const pond = ponds.find((p) => parseInt(p.id) === w.pond_id);
          const pondLabel = pond ? pond.pond_name : `Pond #${w.pond_id}`;
          const nid = `water-remind-${w.wm_id}`;
          items.push({
            id: nid,
            title: '💧 Water Change Reminder',
            message: `${pondLabel}: Water refill scheduled in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
            type: 'water',
            timestamp: w.scheduled_timestamp,
            read: readIds.has(nid),
          });
        }
      });

    // ─── Completed feedings (within last 24 hours) ────────────────────────────
    const oneDayAgo = now.getTime() - 24 * 60 * 60 * 1000;
    allFeedings
      .filter((f) => f.status === 'completed' && new Date(f.updated_at).getTime() >= oneDayAgo)
      .slice(0, 10)
      .forEach((f) => {
        const pond = ponds.find((p) => parseInt(p.id) === f.pond_id);
        const pondLabel = pond ? pond.pond_name : `Pond #${f.pond_id}`;
        const nid = `feeding-done-${f.id}`;
        const timeStr = new Date(f.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        items.push({
          id: nid,
          title: '✅ Feeding Done',
          message: `${pondLabel}: Feeding completed at ${timeStr} — ${Number(f.amount_of_feed).toFixed(2)} ${f.feed_unit.toUpperCase()}.`,
          type: 'feeding',
          timestamp: f.updated_at,
          read: readIds.has(nid),
        });
      });

    // ─── Missed feedings (pending but scheduled time already passed) ──────────
    allFeedings
      .filter((f) => {
        if (f.status !== 'pending') return false;
        // FeedingRecord uses `feeding_schedule` (date) + `time_schedule` (time)
        const scheduledAt = new Date(`${f.feeding_schedule}T${f.time_schedule}`);
        if (isNaN(scheduledAt.getTime())) return false;
        return scheduledAt < now;
      })
      .slice(0, 5)
      .forEach((f) => {
        const pond = ponds.find((p) => parseInt(p.id) === f.pond_id);
        const pondLabel = pond ? pond.pond_name : `Pond #${f.pond_id}`;
        const nid = `feeding-missed-${f.id}`;
        const scheduledAt = new Date(`${f.feeding_schedule}T${f.time_schedule}`);
        const timeStr = scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        items.push({
          id: nid,
          title: '⚠️ Feeding Not Done',
          message: `${pondLabel}: Feeding scheduled at ${timeStr} was not completed.`,
          type: 'feeding',
          timestamp: scheduledAt.toISOString(),
          read: readIds.has(nid),
        });
      });

    // ─── Failed or AI-canceled feedings ──────────────────────────────────────
    allFeedings
      .filter((f) => ['failed', 'canceled_by_ai'].includes(f.status))
      .slice(0, 5)
      .forEach((f) => {
        const pond = ponds.find((p) => parseInt(p.id) === f.pond_id);
        const pondLabel = pond ? pond.pond_name : `Pond #${f.pond_id}`;
        const nid = `feeding-${f.id}`;
        items.push({
          id: nid,
          title: f.status === 'failed' ? '❌ Feeding Failed' : '🤖 Feeding Canceled by AI',
          message: `${pondLabel}: ${getStatusDisplay(f.status)} — ${Number(f.amount_of_feed).toFixed(2)} ${f.feed_unit.toUpperCase()}.`,
          type: 'feeding',
          timestamp: f.updated_at,
          read: readIds.has(nid),
        });
      });

    // ─── Completed water actions (within last 24 hours) ──────────────────────
    allWaterActions
      .filter((w) => w.action_status === 'completed' && new Date(w.updated_at).getTime() >= oneDayAgo)
      .slice(0, 5)
      .forEach((w) => {
        const pond = ponds.find((p) => parseInt(p.id) === w.pond_id);
        const pondLabel = pond ? pond.pond_name : `Pond #${w.pond_id}`;
        const nid = `water-done-${w.wm_id}`;
        const timeStr = new Date(w.updated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        items.push({
          id: nid,
          title: '✅ Water Change Done',
          message: `${pondLabel}: Refill completed at ${timeStr}.`,
          type: 'water',
          timestamp: w.updated_at,
          read: readIds.has(nid),
        });
      });

    // ─── Missed water changes (pending but scheduled time already passed) ─────
    allWaterActions
      .filter((w) => {
        if (!['pending', 'in_progress'].includes(w.action_status)) return false;
        return new Date(w.scheduled_timestamp) < now;
      })
      .slice(0, 5)
      .forEach((w) => {
        const pond = ponds.find((p) => parseInt(p.id) === w.pond_id);
        const pondLabel = pond ? pond.pond_name : `Pond #${w.pond_id}`;
        const nid = `water-missed-${w.wm_id}`;
        const timeStr = new Date(w.scheduled_timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        items.push({
          id: nid,
          title: '⚠️ Water Change Not Done',
          message: `${pondLabel}: Refill scheduled at ${timeStr} was not completed.`,
          type: 'water',
          timestamp: w.scheduled_timestamp,
          read: readIds.has(nid),
        });
      });

    // ─── Failed water actions ─────────────────────────────────────────────────
    allWaterActions
      .filter((w) => w.action_status === 'failed')
      .slice(0, 5)
      .forEach((w) => {
        const pond = ponds.find((p) => parseInt(p.id) === w.pond_id);
        const pondLabel = pond ? pond.pond_name : `Pond #${w.pond_id}`;
        const nid = `water-${w.wm_id}`;
        items.push({
          id: nid,
          title: '❌ Water Action Failed',
          message: `${pondLabel}: Scheduled refill could not be completed.`,
          type: 'water',
          timestamp: w.updated_at,
          read: readIds.has(nid),
        });
      });

    // ─── Ponds with critical / alert statuses ────────────────────────────────
    ponds
      .filter((p) => ['critical', 'feeding_alert', 'water_alert'].includes(p.status || ''))
      .forEach((p) => {
        const nid = `pond-${p.id}`;
        items.push({
          id: nid,
          title: 'Pond Status Alert',
          message: `${p.pond_name} is in ${getStatusInfo(p.status!).display} status`,
          type: 'alert',
          timestamp: p.updated_at || p.created_at,
          read: readIds.has(nid),
        });
      });

    return items
      .filter((item) => !deletedIds.has(item.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allFeedings, allWaterActions, ponds, parameters, now, readIds, deletedIds]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchPonds();
    fetchParameters();
    fetchAllFeedings();
    fetchAllWaterActions();
    setPondName(generatePondName());
  }, []);

  useEffect(() => {
    setPondName(generatePondName());
  }, [ponds]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, friction: 5, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const openFeedingModal = (pond: Pond) => {
    setSelectedPondForFeeding(pond);
  };

  const closeFeedingModal = () => {
    setSelectedPondForFeeding(null);
  };

  const openWaterModal = (pond: Pond) => {
    setSelectedPondForWater(pond);
    setWaterModalVisible(true);
  };

  const closeWaterModal = () => {
    setWaterModalVisible(false);
    setSelectedPondForWater(null);
  };

  const openNotifications = () => {
    setNotificationsVisible(true);
  };

  const renderPondItem = ({ item }: { item: Pond }) => {
    const getLatestFeedingStatus = () => {
      const pondFeedings = allFeedings.filter((f) => f.pond_id === parseInt(item.id));
      if (pondFeedings.length === 0) return 'No records yet';
      const latest = pondFeedings[0];
      const unit = latest.feed_unit || 'g';
      const amountStr = `${Number(latest.amount_of_feed || 0).toFixed(2)} ${unit.toUpperCase()}`;
      return `${getStatusDisplay(latest.status)}: ${amountStr}`;
    };

    const latestWaterStatus = getLatestWaterStatus(item.id);
    const managementCards = [
      { label: 'Water', value: latestWaterStatus, icon: 'droplet' as const, onPress: () => openWaterModal(item) },
      { label: 'Feeding', value: getLatestFeedingStatus(), icon: 'package' as const, onPress: () => openFeedingModal(item) },
    ];

    const statusInfo = getStatusInfo(item.status || 'new');

    return (
      <Animated.View style={[styles.pondCard, { opacity: fadeAnim }]}>
        <View style={styles.pondHeader}>
          <View style={styles.pondInfo}>
            <Text style={styles.pondId}>{item.pond_name}</Text>
            <Text style={styles.pondDetails}>
              {item.pond_size} • {item.num_prawns} Prawns • {item.age}
            </Text>
            <Text style={styles.pondLocation}>Location: {item.location || 'Not specified'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => confirmDelete(item.pond_name)}
              style={styles.deleteButton}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Feather name="trash-2" size={16} color="#DC2626" />
              </Animated.View>
            </TouchableOpacity>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
              <Text style={styles.statusText}>{statusInfo.display}</Text>
            </View>
          </View>
        </View>

        <WaterQualityParameters
          pond={item}
          parameters={parameters}
          BASE_URL={BASE_URL}
          fadeAnim={fadeAnim}
          scaleAnim={scaleAnim}
          handlePressIn={handlePressIn}
          handlePressOut={handlePressOut}
        />

        <Text style={styles.managementTitle}>Management Parameters</Text>
        <View style={styles.managementGrid}>
          {managementCards.map(({ label, value, icon, onPress }) => (
            <TouchableOpacity
              key={label}
              style={styles.managementCard}
              onPress={onPress}
            >
              <View style={styles.paramIconCircle}>
                <Feather name={icon} size={20} color="#FF8C00" />
              </View>
              <Text style={styles.managementLabel}>{label}</Text>
              <Text style={styles.managementValue} numberOfLines={2}>
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/smartprawn_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.titleContainer}>
            <Text style={styles.mainTitle}>PONDORA</Text>
            <Text style={styles.subTitle}>Pond Optimization & Regulation Assistant</Text>
          </View>
        </View>

        <View style={styles.iconsContainer}>
          {/* Bell icon with notification badge */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={openNotifications}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <View>
                <Feather name="bell" size={22} color="#374151" />
                {notifications.filter((n) => !n.read).length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {notifications.filter((n) => !n.read).length > 9 ? '9+' : notifications.filter((n) => !n.read).length}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE' }]}>
          <Text style={styles.summaryTitle}>Total Ponds</Text>
          <Text style={styles.summaryValue}>{ponds.length}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDDBB0' }]}>
          <Text style={styles.summaryTitle}>Total Prawns</Text>
          <Text style={styles.summaryValue}>
            {ponds.reduce((sum, pond) => sum + parseInt(pond.num_prawns || '0'), 0)}
          </Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#FF8C00" style={styles.loadingIndicator} />
      ) : (
        <FlatList
          data={ponds}
          renderItem={renderPondItem}
          keyExtractor={(item) => item.id}
          style={styles.pondList}
          ListEmptyComponent={<Text style={styles.emptyText}>No ponds available yet. Tap + to add one!</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8C00']} />}
        />
      )}

      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.plusCircle}
          onPress={() => setModalVisible(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
            <Text style={styles.plusText}>+</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <AddPond
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
        locationModalVisible={locationModalVisible}
        setLocationModalVisible={setLocationModalVisible}
        pondSize={pondSize}
        setPondSize={setPondSize}
        numPrawns={numPrawns}
        setNumPrawns={setNumPrawns}
        age={age}
        setAge={setAge}
        pondName={pondName}
        setPondName={setPondName}
        location={location}
        setLocation={setLocation}
        loading={loading}
        setLoading={setLoading}
        street={street}
        setStreet={setStreet}
        barangay={barangay}
        setBarangay={setBarangay}
        cityMunicipality={cityMunicipality}
        setCityMunicipality={setCityMunicipality}
        province={province}
        setProvince={setProvince}
        country={country}
        setCountry={setCountry}
        region={region}
        setRegion={setRegion}
        markerCoords={markerCoords}
        setMarkerCoords={setMarkerCoords}
        fetchPonds={fetchPonds}
        BACKEND_URL={PONDS_URL}
      />

      <FeedingManagementAction
        selectedPond={selectedPondForFeeding}
        FEEDING_URL={FEEDING_URL}
        onClose={closeFeedingModal}
        onRefreshFeedings={onRefreshFeedingsForPond}
        onRefreshAllFeedings={fetchAllFeedings}
      />

      <WaterManagement
        visible={waterModalVisible}
        pond={selectedPondForWater}
        onClose={closeWaterModal}
        WATER_URL={WATER_URL}
        allWaterActions={allWaterActions}
        onRefreshAllWaterActions={fetchAllWaterActions}
      />

      <NotificationsPanel
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
        notifications={notifications}
        onMarkRead={markNotificationRead}
        onDelete={deleteNotification}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5F0' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 48,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logo: { width: 40, height: 40, marginRight: 10 },
  titleContainer: { justifyContent: 'center', flexShrink: 1 },
  mainTitle: { fontSize: 18, fontWeight: '700', color: '#FF8C00', letterSpacing: 0.3 },
  subTitle: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginTop: 1 },
  iconsContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: { fontSize: 9, color: '#FFF', fontWeight: '700' },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: { fontSize: 12, color: '#6B7280', fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 28, fontWeight: '800', color: '#FF8C00', marginTop: 4 },
  pondList: { flex: 1, paddingHorizontal: 16 },
  pondCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F0EB',
  },
  pondHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  pondInfo: { flex: 1 },
  pondId: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 3 },
  pondDetails: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  pondLocation: { fontSize: 12, color: '#9CA3AF' },
  headerActions: { flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: { fontSize: 16, color: '#DC2626' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    minWidth: 72,
    alignItems: 'center',
  },
  statusText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  managementTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  managementGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  managementCard: {
    borderRadius: 16,
    padding: 14,
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderWidth: 1,
    borderColor: '#F0EDE8',
  },
  paramIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDDBB0',
  },
  managementLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  managementValue: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 48, fontWeight: '500' },
  fabContainer: { position: 'absolute', bottom: 28, right: 24, zIndex: 1000 },
  plusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF8C00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  plusText: { fontSize: 32, color: '#FFFFFF', fontWeight: '300', lineHeight: 36 },
  loadingIndicator: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});