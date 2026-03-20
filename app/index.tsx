// app/index.tsx
import React, { useEffect, useRef, useState } from 'react';
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
  action_type: 'refill';
  scheduled_timestamp: string;
  action_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
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

  const screenWidth = Dimensions.get('window').width;
  const BASE_URL = 'http://10.0.0.35/smartprawn/backend/';
  const PONDS_URL = `${BASE_URL}ponds.php`;
  const FEEDING_URL = `${BASE_URL}management/feeding_management_action.php`;
  const WATER_URL = `${BASE_URL}management/water_management_action.php`;

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
      const res = await fetch(`${BASE_URL}smart_prawn_paramenters.php`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const paramMap: { [key: string]: ParameterRecord } = {};
        data.data.forEach((param: ParameterRecord) => {
          const code = param.pond_code;
          if (!paramMap[code] || new Date(param.updated_at) > new Date(paramMap[code].updated_at)) {
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
          return bNum - aNum;
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
      { label: 'Water', value: latestWaterStatus, icon: '💧', onPress: () => openWaterModal(item) },
      { label: 'Feeding', value: getLatestFeedingStatus(), icon: '🍚', onPress: () => openFeedingModal(item) },
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
              style={[styles.managementCard, { backgroundColor: parameterInfo[label as 'Water' | 'Feeding'].color }]}
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
            <Text style={styles.mainTitle}>Smart Prawn Aquaculture</Text>
            <Text style={styles.subTitle}>Pond Monitoring & Management</Text>
          </View>
        </View>

        <View style={styles.iconsContainer}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={openNotifications}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Image
                source={require('../assets/images/notification_bell.png')}
                style={styles.icon}
                resizeMode="contain"
              />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Image
                source={require('../assets/images/user_icon.png')}
                style={styles.icon}
                resizeMode="contain"
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

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

    
    </View>
  );
}

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