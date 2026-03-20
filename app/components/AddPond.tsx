import * as Location from 'expo-location';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface Pond {
  pond_name: string;
  pond_size: string;
  num_prawns: string;
  age: string;
  location?: string;
  created_at: string;
}

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
  // Auto-fetch location when location modal opens
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

        setRegion({
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setMarkerCoords(coords);

        const [geocode] = await Location.reverseGeocodeAsync(coords);
        if (geocode) {
          setStreet(geocode.street || geocode.name || '');
          setBarangay(geocode.district || geocode.subregion || '');
          setCityMunicipality(geocode.city || geocode.district || '');
          setProvince(geocode.region || geocode.subregion || '');
          setCountry('Philippines');

          const addressParts = [
            geocode.street || geocode.name || '',
            geocode.district || geocode.subregion || '',
            geocode.city || geocode.district || '',
            geocode.region || geocode.subregion || '',
          ].filter(Boolean);

          setLocation([...addressParts, 'Philippines'].join(', '));
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

  // Handle manual map tap
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

        const addressParts = [
          geocode.street || geocode.name || '',
          geocode.district || geocode.subregion || '',
          geocode.city || geocode.district || '',
          geocode.region || geocode.subregion || '',
        ].filter(Boolean);

        setLocation([...addressParts, 'Philippines'].join(', '));
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
    setLocation('');
    setStreet('');
    setBarangay('');
    setCityMunicipality('');
    setProvince('');
    setCountry('Philippines');
    setMarkerCoords(null);
  };

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

    if (!/^\d+\s*(weeks|months|days)$/i.test(age)) {
      Alert.alert('Validation Error', 'Age should be like "8 weeks".');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("pond_name", pondName.trim());
    formData.append("pond_size", pondSize.trim());
    formData.append("num_prawns", numPrawns.trim());
    formData.append("age", age.trim());
    formData.append("location", location.trim());
    // ← image field intentionally removed

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        body: formData,
        headers: { "ngrok-skip-browser-warning": "true" },
      });

      const data: PostResponse = await res.json();

      if (data.success) {
        Alert.alert("Success", data.message || "Pond added!");
        setModalVisible(false);
        resetForm();
        fetchPonds();
      } else {
        Alert.alert("Failed", data.message || "Could not add pond.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Add Pond Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add Pond</Text>

            <Text style={styles.inputLabel}>Pond Name</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={pondName}
              editable={false}
              placeholder="e.g., PND-001"
            />

            <Text style={styles.inputLabel}>Pond Size</Text>
            <TextInput
              style={styles.input}
              placeholder="Pond Size"
              value={pondSize}
              onChangeText={setPondSize}
            />

            <Text style={styles.inputLabel}>Number of Prawns</Text>
            <TextInput
              style={styles.input}
              placeholder="Number of Prawns"
              keyboardType="numeric"
              value={numPrawns}
              onChangeText={setNumPrawns}
            />

            <Text style={styles.inputLabel}>Age (e.g., 8 weeks)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 8 weeks"
              value={age}
              onChangeText={setAge}
            />

            <Text style={styles.inputLabel}>Location</Text>
            <TouchableOpacity
              style={[styles.input, { justifyContent: 'center' }]}
              onPress={() => setLocationModalVisible(true)}
            >
              <Text style={{ color: location ? '#000' : '#aaa' }}>
                {location || 'Add location...'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Add Pond</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal visible={locationModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Pond Location</Text>

            <View style={styles.mapContainer}>
              <MapView
                style={{ flex: 1, borderRadius: 10 }}
                region={region}
                onPress={handleMapPress}
              >
                {markerCoords && <Marker coordinate={markerCoords} />}
              </MapView>
              <Text style={{ marginTop: 5, fontSize: 12, color: '#555' }}>
                Tap on map to adjust location
              </Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Street / House No."
              value={street}
              onChangeText={setStreet}
            />

            <TextInput
              style={styles.input}
              placeholder="Barangay"
              value={barangay}
              onChangeText={setBarangay}
            />

            <TextInput
              style={styles.input}
              placeholder="City / Municipality"
              value={cityMunicipality}
              onChangeText={setCityMunicipality}
            />

            <TextInput
              style={styles.input}
              placeholder="Province"
              value={province}
              onChangeText={setProvince}
            />

            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={country}
              editable={false}
              placeholder="Philippines"
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={confirmLocation}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Confirm Location</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setLocationModalVisible(false);
                setStreet('');
                setBarangay('');
                setCityMunicipality('');
                setProvince('');
                setCountry('Philippines');
                setMarkerCoords(null);
                setLocation('');
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#FF6B35',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    justifyContent: 'center',
  },
  readOnlyInput: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  cancelText: {
    color: '#666',
    fontSize: 14,
  },
  mapContainer: {
    height: 250,
    marginBottom: 12,
  },
});

export default AddPond;