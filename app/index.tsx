// app/index.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import AddPond from './components/AddPond';
import FeedingManagementAction from './components/FeedingManagementAction';
import WaterManagement from './components/WaterManagement';
import WaterQualityParameters from './components/WaterQualityParameters';

// ==================== INTERFACES ====================
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

export interface ParameterRecord {
  id: number;
  pond_id: number;
  temperature: string;
  dissolved_oxygen?: string;
  pH: string;
  salinity: string;
  ammonia: string;
  updated_at: string;
  pond_code: string;
}

export interface FeedingRecord {
  fm_id?: number;
  id?: number;
  pond_id: number;
  amount_of_feed: number;
  feed_unit: 'g' | 'kg';
  action_status: string;
  control_mode?: string;
  created_at: string;
  updated_at: string;
}

export interface WaterManagementRecord {
  wm_id: number;
  pond_id: number;
  water_quality_parameters_id?: number;
  action_type: string;
  scheduled_timestamp: string;
  action_status: string;
  created_at: string;
  updated_at: string;
}

// ==================== MAIN COMPONENT ====================
export default function HomeScreen() {
  // ==================== STATE ====================
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

  // Add Pond Form States
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

  const [notificationsVisible, setNotificationsVisible] = useState(false);

  // ==================== CONSTANTS & REFS ====================
  const BASE_URL = 'http://136.112.99.103/';
  const PONDS_URL = `${BASE_URL}ponds.php`;
  const FEEDING_URL = `${BASE_URL}feeding_management_action.php`;
  const WATER_URL = `${BASE_URL}water_management_action.php`;
  const PARAMETERS_URL = `${BASE_URL}smart_prawn_paramenters.php`;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}] ${message}`, data || '');
  };

  // ==================== STATUS HELPERS ====================
  const getStatusInfo = (status: string = 'new'): { display: string; color: string } => {
    const statuses: Record<string, { display: string; color: string }> = {
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
    return statuses[status] || { display: status, color: '#EF4444' };
  };

  const getStatusDisplay = (status: string): string =>
    ({
      pending: 'Pending',
      feeding: 'Feeding',
      completed: 'Completed',
      canceled_by_user: 'Canceled by User',
      canceled_by_ai: 'Canceled by AI',
      failed: 'Failed',
    }[status] || status);

  const getWaterStatusDisplay = (status: string): string =>
    ({
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      failed: 'Failed',
    }[status] || status);

  // ==================== SAFE JSON FETCH (Handles "Connected successfully") ====================
  const safeJsonFetch = async (url: string): Promise<any> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    let text = (await res.text()).trim();

    log('RAW_RESPONSE', text.substring(0, 300) + (text.length > 300 ? '...' : ''));

    // Remove debug prefix
    const prefixes = ['Connected successfully', 'Connected successfully\n', 'Connected successfully\r\n', 'Success'];
    for (const prefix of prefixes) {
      if (text.startsWith(prefix)) {
        text = text.slice(prefix.length).trim();
        break;
      }
    }

    // Extract first valid JSON object
    const jsonStart = text.indexOf('{');
    if (jsonStart !== -1) {
      text = text.substring(jsonStart);
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      log('JSON_PARSE_FAILED', text.substring(0, 500));
      throw error;
    }
  };

  // ==================== DATA FETCHING ====================
  const fetchPonds = async () => {
    log('FETCH_PONDS_START');
    setLoading(true);
    try {
      const data = await safeJsonFetch(PONDS_URL);
      if (data.success && Array.isArray(data.data)) {
        const sortedPonds = [...data.data].sort((a: Pond, b: Pond) => {
          const aNum = parseInt(a.pond_name?.split('-')[1] || '0', 10);
          const bNum = parseInt(b.pond_name?.split('-')[1] || '0', 10);
          return bNum - aNum;
        });
        setPonds(sortedPonds);
        log('PONDS_LOADED', sortedPonds.length);
      }
    } catch (error) {
      log('FETCH_PONDS_ERROR', error);
      Alert.alert('Error', 'Could not fetch ponds. Please check network or server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchParameters = async () => {
    log('FETCH_PARAMETERS_START');
    try {
      const data = await safeJsonFetch(PARAMETERS_URL);
      if (data.success && Array.isArray(data.data)) {
        const paramMap: { [key: string]: ParameterRecord } = {};
        data.data.forEach((param: ParameterRecord) => {
          const code = param.pond_code;
          if (!paramMap[code] || new Date(param.updated_at) > new Date(paramMap[code]?.updated_at || '')) {
            paramMap[code] = param;
          }
        });
        setParameters(paramMap);
        log('PARAMETERS_LOADED', Object.keys(paramMap).length);
      }
    } catch (error) {
      log('FETCH_PARAMETERS_ERROR', error);
    }
  };

  const fetchAllFeedings = async () => {
    log('FETCH_ALL_FEEDINGS_START');
    try {
      const data = await safeJsonFetch(FEEDING_URL);
      let records: any[] = Array.isArray(data.data) ? data.data : (data.data?.records || []);
      
      const processed = records
        .map((r: any) => ({
          ...r,
          pond_id: Number(r.pond_id),
          amount_of_feed: parseFloat(r.amount_of_feed || '0') || 0,
          feed_unit: (r.feed_unit || 'g') as 'g' | 'kg',
          action_status: r.action_status || r.status || 'pending',
          control_mode: r.control_mode || r.feeding_mode,
        }))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      setAllFeedings(processed);
      log('FEEDINGS_LOADED', processed.length);
    } catch (error) {
      log('FETCH_ALL_FEEDINGS_ERROR', error);
      setAllFeedings([]);
    }
  };

  const fetchAllWaterActions = async () => {
    log('FETCH_ALL_WATER_ACTIONS_START');
    try {
      const data = await safeJsonFetch(WATER_URL);
      if (data.success && Array.isArray(data.data)) {
        const sorted = [...data.data].sort((a: WaterManagementRecord, b: WaterManagementRecord) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setAllWaterActions(sorted);
        log('WATER_ACTIONS_LOADED', sorted.length);
      } else {
        setAllWaterActions([]);
      }
    } catch (error) {
      log('FETCH_ALL_WATER_ACTIONS_ERROR', error);
      setAllWaterActions([]);
    }
  };

  const deletePond = async (pondName: string) => {
    try {
      const res = await fetch(`${PONDS_URL}?pond_name=${encodeURIComponent(pondName)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', data.message || 'Pond deleted successfully!');
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

  const onRefreshFeedingsForPond = async () => await fetchAllFeedings();

  const getLatestWaterStatus = (pondId: string) => {
    const pondActions = allWaterActions.filter((w) => w.pond_id === parseInt(pondId));
    if (pondActions.length === 0) return 'No records yet';
    const latest = pondActions[0];
    return `${getWaterStatusDisplay(latest.action_status)}: ${latest.action_type}`;
  };

  const generatePondName = () => {
    const existingNames = new Set(ponds.map((p) => p.pond_name));
    let index = 1;
    let newName = `PND-${String(index).padStart(3, '0')}`;
    while (existingNames.has(newName)) {
      index++;
      newName = `PND-${String(index).padStart(3, '0')}`;
    }
    return newName;
  };

  // ==================== ANIMATION HANDLERS ====================
  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, friction: 5, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  // ==================== MODAL HANDLERS ====================
  const openFeedingModal = (pond: Pond) => setSelectedPondForFeeding(pond);
  const closeFeedingModal = () => setSelectedPondForFeeding(null);
  const openWaterModal = (pond: Pond) => {
    setSelectedPondForWater(pond);
    setWaterModalVisible(true);
  };
  const closeWaterModal = () => {
    setWaterModalVisible(false);
    setSelectedPondForWater(null);
  };

  // ==================== RENDER POND ITEM ====================
  const renderPondItem = ({ item }: { item: Pond }) => {
    const pondFeedings = allFeedings.filter((f) => f.pond_id === parseInt(item.id));
    const latestFeeding = pondFeedings[0];

    const getLatestFeedingStatus = () => {
      if (!latestFeeding) return 'No records yet';
      const amountStr = `${Number(latestFeeding.amount_of_feed).toFixed(2)} ${latestFeeding.feed_unit.toUpperCase()}`;
      return `${getStatusDisplay(latestFeeding.action_status)}: ${amountStr}`;
    };

    const latestWaterStatus = getLatestWaterStatus(item.id);
    const statusInfo = getStatusInfo(item.status || 'new');

    const managementCards = [
      { label: 'Water', value: latestWaterStatus, icon: '💧', onPress: () => openWaterModal(item) },
      { label: 'Feeding', value: getLatestFeedingStatus(), icon: '🍚', onPress: () => openFeedingModal(item) },
    ];

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
                <Text style={styles.deleteButtonText}>🗑️</Text>
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
              style={[styles.managementCard, { backgroundColor: '#FFF7E6' }]}
              onPress={onPress}
            >
              <Text style={styles.paramIcon}>{icon}</Text>
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

  // ==================== EFFECTS ====================
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchPonds();
    fetchParameters();
    fetchAllFeedings();
    fetchAllWaterActions();
  }, []);

  useEffect(() => {
    setPondName(generatePondName());
  }, [ponds]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ==================== RENDER ====================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/smartprawn_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.titleContainer}>
            <Text style={styles.mainTitle}>Smart Prawn Aquaculture</Text>
            <Text style={styles.subTitle}>Pond Monitoring & Management</Text>
          </View>
        </View>

        <View style={styles.iconsContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setNotificationsVisible(true)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Image source={require('../assets/images/notification_bell.png')} style={styles.icon} resizeMode="contain" />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Image source={require('../assets/images/user_icon.png')} style={styles.icon} resizeMode="contain" />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#BFDBFE', borderWidth: 1, borderColor: '#FF8C00' }]}>
          <Text style={styles.summaryTitle}>Total Ponds</Text>
          <Text style={styles.summaryValue}>{ponds.length}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#FF8C00' }]}>
          <Text style={styles.summaryTitle}>Total Prawns</Text>
          <Text style={styles.summaryValue}>
            {ponds.reduce((sum, pond) => sum + parseInt(pond.num_prawns || '0'), 0)}
          </Text>
        </View>
      </View>

      {/* Pond List */}
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

      {/* Floating Action Button */}
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

      {/* Modals */}
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
    </View>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7E6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 30,
    backgroundColor: '#FFE4B5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logo: { width: 50, height: 50, marginRight: 12 },
  titleContainer: { justifyContent: 'center', flexShrink: 1 },
  mainTitle: { fontSize: 21, fontWeight: '700', color: '#FF8C00', letterSpacing: 0.5 },
  subTitle: { fontSize: 14, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 8, padding: 8, borderRadius: 8 },
  icon: { width: 28, height: 28 },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 0.48,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  summaryTitle: { fontSize: 14, color: '#374151', fontWeight: '600', textAlign: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#FF8C00', marginTop: 4 },
  pondList: { flex: 1, paddingHorizontal: 16 },
  pondCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  pondHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pondInfo: { flex: 1 },
  pondId: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  pondDetails: { fontSize: 14, color: '#6B7280', marginBottom: 2 },
  pondLocation: { fontSize: 14, color: '#9CA3AF' },
  headerActions: { flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  deleteButton: { padding: 8, borderRadius: 8, backgroundColor: '#FEE2E2' },
  deleteButtonText: { fontSize: 16, color: '#DC2626' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  managementTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 16 },
  managementGrid: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 20 },
  managementCard: {
    borderRadius: 16,
    padding: 16,
    flex: 0.48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#FF8C00',
  },
  paramIcon: { fontSize: 28, marginBottom: 6 },
  managementLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginBottom: 4 },
  managementValue: { fontSize: 15, fontWeight: '600', color: '#1F2937', textAlign: 'center' },
  emptyText: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 48, fontWeight: '500' },
  fabContainer: { position: 'absolute', bottom: 24, right: 24, zIndex: 1000 },
  plusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF8C00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  plusText: { fontSize: 32, color: '#FFFFFF', fontWeight: '700' },
  loadingIndicator: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});