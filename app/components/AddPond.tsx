import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface PostResponse {
  success: boolean;
  message: string;
}

interface AddPondProps {
  modalVisible: boolean;
  setModalVisible: (visible: boolean) => void;
  locationModalVisible: boolean;
  setLocationModalVisible: (visible: boolean) => void;
  pondSize: string;
  setPondSize: (size: string) => void;
  numPrawns: string;
  setNumPrawns: (num: string) => void;
  age: string;
  setAge: (age: string) => void;
  pondName: string;
  setPondName: (name: string) => void;
  location: string;
  setLocation: (loc: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  street: string;
  setStreet: (street: string) => void;
  barangay: string;
  setBarangay: (barangay: string) => void;
  cityMunicipality: string;
  setCityMunicipality: (city: string) => void;
  province: string;
  setProvince: (province: string) => void;
  country: string;
  setCountry: (country: string) => void;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  setRegion: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => void;
  markerCoords: { latitude: number; longitude: number } | null;
  setMarkerCoords: (coords: { latitude: number; longitude: number } | null) => void;
  fetchPonds: () => Promise<void>;
  BACKEND_URL: string;
}

// ── Age unit type ─────────────────────────────────────────────────────────────
type AgeUnit = 'days' | 'weeks' | 'months';

const AGE_UNITS: AgeUnit[] = ['days', 'weeks', 'months'];

// Convert any unit to days before sending to the backend
const convertToDays = (value: string, unit: AgeUnit): number => {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) return 0;
  if (unit === 'days')   return n;
  if (unit === 'weeks')  return n * 7;
  if (unit === 'months') return n * 30;
  return n;
};

// ── Component ─────────────────────────────────────────────────────────────────
const AddPond: React.FC<AddPondProps> = ({
  modalVisible,
  setModalVisible,
  locationModalVisible,
  setLocationModalVisible,
  pondSize,
  setPondSize,
  numPrawns,
  setNumPrawns,
  age,
  setAge,
  pondName,
  setPondName,
  location,
  setLocation,
  loading,
  setLoading,
  street,
  setStreet,
  barangay,
  setBarangay,
  cityMunicipality,
  setCityMunicipality,
  province,
  setProvince,
  country,
  setCountry,
  region,
  setRegion,
  markerCoords,
  setMarkerCoords,
  fetchPonds,
  BACKEND_URL,
}) => {
  // Local state for age unit — not stored in parent since we convert before submit
  const [ageUnit, setAgeUnit] = useState<AgeUnit>('days');

  // ── Pond size stepper ──────────────────────────────────────────────────────
  const getPondSizeNumber = (): number => {
    const n = parseInt(pondSize, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  };
  const handlePondSizeText = (text: string) => setPondSize(text.replace(/[^0-9]/g, ''));
  const incrementPondSize  = () => setPondSize(String(getPondSizeNumber() + 1));
  const decrementPondSize  = () => setPondSize(String(Math.max(0, getPondSizeNumber() - 1)));

  // ── Age helpers ────────────────────────────────────────────────────────────
  const handleAgeText = (text: string) => setAge(text.replace(/[^0-9]/g, ''));

  // Preview shown below the age row so the user can see the converted value
  const agePreview = (): string => {
    const days = convertToDays(age, ageUnit);
    if (!age || days === 0) return '';
    if (ageUnit === 'days') return '';           // no conversion needed, no preview
    return `= ${days} days`;
  };

  // ── Location auto-fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!locationModalVisible) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to auto-detect your location.');
        setLocationModalVisible(false);
        return;
      }

      try {
        setLoading(true);
        const userLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = {
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
        };

        setRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        setMarkerCoords(coords);

        const [geocode] = await Location.reverseGeocodeAsync(coords);
        if (geocode) {
          setStreet(geocode.street || geocode.name || '');
          setBarangay(geocode.district || geocode.subregion || '');
          setCityMunicipality(geocode.city || geocode.district || '');
          setProvince(geocode.region || geocode.subregion || '');
          setCountry('Philippines');

          const parts = [
            geocode.street || geocode.name || '',
            geocode.district || geocode.subregion || '',
            geocode.city || geocode.district || '',
            geocode.region || geocode.subregion || '',
          ].filter(Boolean);

          setLocation([...parts, 'Philippines'].join(', '));
        } else {
          Alert.alert('Warning', 'Could not fetch address. Please adjust manually.');
          setLocation('');
        }
      } catch (error) {
        console.error('Location fetch error:', error);
        Alert.alert('Error', 'Could not retrieve location. Please try again or enter manually.');
        setLocation('');
      } finally {
        setLoading(false);
      }
    })();
  }, [locationModalVisible]);

  // ── Map tap ────────────────────────────────────────────────────────────────
  const handleMapPress = async (e: any) => {
    const coords = e.nativeEvent.coordinate;
    setMarkerCoords(coords);

    try {
      const [geocode] = await Location.reverseGeocodeAsync(coords);
      if (geocode) {
        setStreet(geocode.street || geocode.name || '');
        setBarangay(geocode.district || geocode.subregion || '');
        setCityMunicipality(geocode.city || geocode.district || '');
        setProvince(geocode.region || geocode.subregion || '');
        setCountry('Philippines');

        const parts = [
          geocode.street || geocode.name || '',
          geocode.district || geocode.subregion || '',
          geocode.city || geocode.district || '',
          geocode.region || geocode.subregion || '',
        ].filter(Boolean);

        setLocation([...parts, 'Philippines'].join(', '));
      } else {
        Alert.alert('Warning', 'Could not fetch address for selected location.');
        setLocation('');
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
      Alert.alert('Error', 'Could not fetch address. Enter manually.');
      setLocation('');
    }
  };

  const confirmLocation = () => {
    if (!location) {
      Alert.alert('Error', 'No location selected. Please try again.');
      return;
    }
    setLocationModalVisible(false);
  };

  const resetForm = () => {
    setPondSize('');
    setNumPrawns('');
    setAge('');
    setAgeUnit('days');
    setLocation('');
    setStreet('');
    setBarangay('');
    setCityMunicipality('');
    setProvince('');
    setCountry('Philippines');
    setMarkerCoords(null);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!pondName || !pondSize || !numPrawns || !age || !location) {
      Alert.alert('Validation Error', 'All fields are required!');
      return;
    }

    if (!/^PND-\d{3,}$/.test(pondName)) {
      Alert.alert('Validation Error', 'Pond Name should be like "PND-001".');
      return;
    }

    if (parseInt(numPrawns, 10) <= 0) {
      Alert.alert('Validation Error', 'Number of Prawns must be positive.');
      return;
    }

    const ageNumber = parseInt(age, 10);
    if (isNaN(ageNumber) || ageNumber <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid age.');
      return;
    }

    // Convert to days here — database always receives e.g. "14 days"
    const ageInDays = convertToDays(age, ageUnit);
    const ageForBackend = `${ageInDays} days`;

    setLoading(true);

    const formData = new FormData();
    formData.append('pond_name', pondName.trim());
    formData.append('pond_size', `${pondSize.trim()} sq m`);
    formData.append('num_prawns', numPrawns.trim());
    formData.append('age', ageForBackend);          // always "N days"
    formData.append('location', location.trim());

    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });

      const data: PostResponse = await res.json();

      if (data.success) {
        Alert.alert('Success', data.message || 'Pond added!');
        setModalVisible(false);
        resetForm();
        fetchPonds();
      } else {
        Alert.alert('Failed', data.message || 'Could not add pond.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Add Pond Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.overlay}>
          <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
              <Feather name="x" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Pond</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.formBody} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

          {/* Pond Name */}
          <Text style={styles.inputLabel}>Pond Name</Text>
          <TextInput
            style={[styles.input, styles.readOnlyInput]}
            value={pondName}
            editable={false}
            placeholder="e.g., PND-001"
          />

          {/* Pond Size stepper */}
          <Text style={styles.inputLabel}>Pond Size</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepperBtn} onPress={decrementPondSize}>
              <Text style={styles.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.stepperInput}
              value={pondSize}
              onChangeText={handlePondSizeText}
              keyboardType="numeric"
              placeholder="0"
              textAlign="center"
            />
            <TouchableOpacity style={styles.stepperBtn} onPress={incrementPondSize}>
              <Text style={styles.stepperBtnText}>+</Text>
            </TouchableOpacity>
            <View style={styles.unitBadge}>
              <Text style={styles.unitText}>sq m</Text>
            </View>
          </View>

          {/* Number of Prawns */}
          <Text style={styles.inputLabel}>Number of Prawns</Text>
          <TextInput
            style={styles.input}
            placeholder="Number of Prawns"
            keyboardType="numeric"
            value={numPrawns}
            onChangeText={setNumPrawns}
          />

          {/* Age — number input + unit selector */}
          <Text style={styles.inputLabel}>Age</Text>
          <View style={styles.ageRow}>
            <TextInput
              style={styles.ageInput}
              placeholder="0"
              keyboardType="numeric"
              value={age}
              onChangeText={handleAgeText}
              textAlign="center"
            />
            <View style={styles.unitSelector}>
              {AGE_UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitOption,
                    ageUnit === unit && styles.unitOptionActive,
                  ]}
                  onPress={() => setAgeUnit(unit)}
                >
                  <Text
                    style={[
                      styles.unitOptionText,
                      ageUnit === unit && styles.unitOptionTextActive,
                    ]}
                  >
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Conversion preview */}
          {agePreview() !== '' && (
            <Text style={styles.agePreview}>{agePreview()}</Text>
          )}

          {/* Location */}
          <Text style={styles.inputLabel}>Location</Text>
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={() => setLocationModalVisible(true)}
          >
            <Feather name="map-pin" size={16} color={location ? '#FF8C00' : '#9CA3AF'} />
            <Text style={[styles.locationBtnText, location ? styles.locationBtnTextFilled : null]}>
              {location || 'Add location...'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Add Pond</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => { setModalVisible(false); resetForm(); }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Location Picker Modal ── */}
      <Modal visible={locationModalVisible} animationType="slide" transparent={true}>
        <View style={styles.overlay}>
          <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => {
              setLocationModalVisible(false);
              setStreet(''); setBarangay(''); setCityMunicipality('');
              setProvince(''); setCountry('Philippines');
              setMarkerCoords(null); setLocation('');
            }}>
              <Feather name="x" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Location</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.formBody} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

          <View style={styles.mapContainer}>
            <MapView
              style={{ flex: 1, borderRadius: 16 }}
              region={region}
              onPress={handleMapPress}
            >
              {markerCoords && <Marker coordinate={markerCoords} />}
            </MapView>
            <Text style={styles.mapHint}>Tap on the map to adjust location</Text>
          </View>

          <TextInput style={styles.input} placeholder="Street / House No." value={street} onChangeText={setStreet} />
          <TextInput style={styles.input} placeholder="Barangay" value={barangay} onChangeText={setBarangay} />
          <TextInput style={styles.input} placeholder="City / Municipality" value={cityMunicipality} onChangeText={setCityMunicipality} />
          <TextInput style={styles.input} placeholder="Province" value={province} onChangeText={setProvince} />
          <TextInput style={[styles.input, styles.readOnlyInput]} value={country} editable={false} placeholder="Philippines" />

          <TouchableOpacity style={styles.submitButton} onPress={confirmLocation} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Confirm Location</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setLocationModalVisible(false);
              setStreet(''); setBarangay(''); setCityMunicipality('');
              setProvince(''); setCountry('Philippines');
              setMarkerCoords(null); setLocation('');
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#F8F5F0',
    borderRadius: 24,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F0EB',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  formBody: {
    flexGrow: 0,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#F0EDE8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
    fontSize: 15,
    justifyContent: 'center',
  },
  readOnlyInput: {
    backgroundColor: '#F8F5F0',
    color: '#374151',
  },

  // Pond size stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  stepperBtnText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 26,
  },
  stepperInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F0EDE8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  unitBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8F5F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0EDE8',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Age row
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  ageInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#F0EDE8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#F0EDE8',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  unitOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  unitOptionActive: {
    backgroundColor: '#FF8C00',
  },
  unitOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  unitOptionTextActive: {
    color: '#FFFFFF',
  },
  agePreview: {
    fontSize: 12,
    color: '#FF8C00',
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 4,
  },

  // Location button
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F0EDE8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  locationBtnText: {
    flex: 1,
    fontSize: 15,
    color: '#9CA3AF',
  },
  locationBtnTextFilled: {
    color: '#1F2937',
  },

  // Map
  mapContainer: {
    height: 220,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0EDE8',
  },
  mapHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },

  // Buttons
  submitButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AddPond;