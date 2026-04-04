<<<<<<< HEAD
import React, { useCallback, useRef, useState } from 'react';
=======
import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
>>>>>>> origin/ui2
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface Pond {
  id: string;
  pond_name: string;
}

interface ParameterRecord {
  id: number;
  pond_id: number;
  temperature: string;
  pH: string;
  salinity: string;
  ammonia: string;
  updated_at: string;
  pond_code: string;
}

type ParamKey = 'temperature' | 'pH' | 'salinity' | 'ammonia';

interface ParameterModal {
  visible: boolean;
  parameter: string;
  value: string;
  description: string;
  color: string;
  accentColor: string;
  paramKey?: ParamKey;
  pondId?: string;
}

interface TooltipData {
  x: number;
  pixelY: number;
  value: number;
  unit: string;
  timestamp: string;
  formattedDate: string;
  idealRange: { min: number; max: number };
}

interface Props {
  pond: Pond;
  parameters: { [key: string]: ParameterRecord };
  BASE_URL: string;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
  handlePressIn: () => void;
  handlePressOut: () => void;
}

const WaterQualityParameters: React.FC<Props> = ({
  pond,
  parameters,
  BASE_URL,
  fadeAnim,
  scaleAnim,
  handlePressIn,
  handlePressOut,
}) => {
  const [paramModal, setParamModal] = useState<ParameterModal>({
    visible: false,
    parameter: '',
    value: '',
    description: '',
    color: '#BFDBFE',
    accentColor: '#3B82F6',
  });

  const [paramHistory, setParamHistory] = useState<ParameterRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [scrollX, setScrollX] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;

  const waterQualityParams = ['Temperature', 'pH Level', 'Salinity', 'Ammonia'];

<<<<<<< HEAD
  const parameterInfo: { [key: string]: { 
    description: string; 
    color: string; 
    unit?: string; 
    chartColor: string; 
    idealRange: { min: number; max: number } 
  }} = {
=======
  const paramKeyMap: { [key: string]: ParamKey } = {
    Temperature: 'temperature',
    'pH Level': 'pH',
    Salinity: 'salinity',
    Ammonia: 'ammonia',
  };

  const parameterInfo: { [key: string]: { description: string; color: string; accentColor: string; unit?: string; chartColor: string; idealRange: { min: number; max: number } } } = {
>>>>>>> origin/ui2
    Temperature: {
      description: 'Water temperature affects prawn metabolism and growth. Ideal range: 26-30°C.',
      color: '#FFF7ED',
      accentColor: '#D97706',
      unit: '°C',
      chartColor: '#D97706',
      idealRange: { min: 26, max: 30 },
    },
    'pH Level': {
      description: 'pH measures water acidity/alkalinity. Ideal range for prawns: 7.5-8.5.',
      color: '#F0FDF4',
      accentColor: '#16A34A',
      unit: '',
      chartColor: '#047857',
      idealRange: { min: 7.5, max: 8.5 },
    },
    Salinity: {
      description: 'Salinity impacts prawn osmoregulation. Ideal range: 15-25 ppt.',
      color: '#EFF6FF',
      accentColor: '#3B82F6',
      unit: 'ppt',
      chartColor: '#3B82F6',
      idealRange: { min: 15, max: 25 },
    },
    Ammonia: {
      description: 'Ammonia levels indicate water quality. Should be kept below 0.1 ppm.',
      color: '#FFF1F2',
      accentColor: '#EF4444',
      unit: 'ppm',
      chartColor: '#EF4444',
      idealRange: { min: 0, max: 0.5 },
    },
  };

  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const fetchHistory = useCallback(async (pondId: string, showLoading = true) => {
    if (showLoading) setHistoryLoading(true);
    setTooltipData(null);

    try {
      const res = await fetch(`${BASE_URL}smart_prawn_parameters.php?pond_name=${pondId}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const sortedHistory = data.data.sort((a: ParameterRecord, b: ParameterRecord) => 
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        );
        setParamHistory(sortedHistory);
      } else {
        setParamHistory([]);
      }
    } catch (error) {
      console.error("History fetch error:", error);
      Alert.alert("Error", "Could not fetch parameter history.");
      setParamHistory([]);
    } finally {
      if (showLoading) setHistoryLoading(false);
      setRefreshing(false);
    }
  }, [BASE_URL]);

  const showParameterModal = (parameter: string, value: string, paramKey?: ParamKey, pondId?: string) => {
    setParamModal({
      visible: true,
      parameter,
      value,
      description: parameterInfo[parameter]?.description || 'No description available.',
      color: parameterInfo[parameter]?.color || '#BFDBFE',
      accentColor: parameterInfo[parameter]?.accentColor || '#3B82F6',
      paramKey,
      pondId,
    });
    setTooltipData(null);
  };

  const handleParamPress = async (parameter: string, value: string, paramKey: ParamKey, pondId: string) => {
    if (waterQualityParams.includes(parameter)) {
      await fetchHistory(pondId);
    }
    showParameterModal(parameter, value, paramKey, pondId);
  };

  const dismissTooltip = () => setTooltipData(null);

  const dismissOnChartPress = () => {
    if (tooltipData) dismissTooltip();
  };

  const onRefresh = () => {
    if (paramModal.pondId) {
      setRefreshing(true);
      fetchHistory(paramModal.pondId, false);
    }
  };

  const renderChart = () => {
    if (!paramModal.paramKey || paramHistory.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Text style={styles.emptyChartText}>No historical data available yet.</Text>
        </View>
      );
    }

    const paramInfo = parameterInfo[paramModal.parameter];
    const { chartColor, unit = '', idealRange } = paramInfo;

    const dataValues = paramHistory
      .map(record => parseFloat(record[paramModal.paramKey!] || '0'))
      .filter(val => !isNaN(val) && isFinite(val));

    if (dataValues.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Text style={styles.emptyChartText}>No valid numerical data to plot.</Text>
        </View>
      );
    }

    const average = dataValues.length > 0 
      ? (dataValues.reduce((a, b) => a + b, 0) / dataValues.length).toFixed(2) 
      : 'N/A';

    const minY = Math.min(...dataValues);
    const maxY = Math.max(...dataValues);
    const rangeY = maxY - minY || 1;

    const allSameDay = paramHistory.every(record => 
      new Date(record.updated_at).toDateString() === new Date(paramHistory[0].updated_at).toDateString()
    );

    const maxLabels = 8;
    const labelStep = Math.max(1, Math.ceil(paramHistory.length / maxLabels));

    const labels = paramHistory.map((record, idx) => {
      if (idx % labelStep !== 0) return '';
      const date = new Date(record.updated_at);
      return allSameDay 
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    const chartData = {
      labels,
      datasets: [{
        data: dataValues,
        color: () => chartColor,
        strokeWidth: 3,
      }],
    };

    const minChartWidth = Math.max(screenWidth * 0.9, paramHistory.length * 55);
    const chartWidth = Math.min(minChartWidth, 800);
    const chartHeight = 260;

    const chartConfig = {
      backgroundGradientFrom: '#ffffff',
<<<<<<< HEAD
      backgroundGradientTo: paramModal.color,
      backgroundGradientFromOpacity: 0.85,
      backgroundGradientToOpacity: 0.25,
=======
      backgroundGradientTo: '#ffffff',
      backgroundGradientFromOpacity: 1,
      backgroundGradientToOpacity: 1,
>>>>>>> origin/ui2
      decimalPlaces: 2,
      color: (opacity = 1) => hexToRgba(chartColor, opacity),
      labelColor: (opacity = 1) => hexToRgba('#374151', opacity),
      style: { borderRadius: 16 },
      propsForDots: { r: '7', strokeWidth: '3', stroke: '#ffffff' },
      propsForBackgroundLines: { strokeDasharray: '4,4', stroke: hexToRgba('#E5E7EB', 0.6) },
      withHorizontalLabels: true,
      withVerticalLabels: true,
      horizontalLabelRotation: labels.length > 6 ? -45 : 0,
    };

    const handleDataPointClick = ({ value, index }: { value: number; index: number }) => {
      const record = paramHistory[index];
      if (!record) return;

      const pointSpacing = chartWidth / (paramHistory.length - 1 || 1);
      const xPosition = index * pointSpacing;

      const plotHeight = 180;
      let pixelY = plotHeight / 2;
      if (rangeY > 0) {
        pixelY = plotHeight - ((value - minY) / rangeY) * plotHeight;
      }

      setTooltipData({
        x: xPosition,
        pixelY,
        value,
        unit,
        timestamp: record.updated_at,
        formattedDate: new Date(record.updated_at).toLocaleString(),
        idealRange,
      });
    };

    const tooltipLeft = tooltipData 
      ? Math.max(12, Math.min(tooltipData.x - scrollX - 85, screenWidth - 190))
      : 0;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>
          Historical Data (Avg: {average}{unit ? ` ${unit}` : ''})
        </Text>

        <View style={{ width: '100%' }}>
          <ScrollView 
            ref={scrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
            nestedScrollEnabled
            directionalLockEnabled
            bounces={false}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <TouchableOpacity activeOpacity={1} onPress={dismissOnChartPress}>
              <LineChart
                data={chartData}
                width={chartWidth}
                height={chartHeight}
                yAxisLabel=""
                yAxisSuffix={unit ? ` ${unit}` : ''}
                chartConfig={chartConfig}
                bezier
                onDataPointClick={handleDataPointClick}
                style={{ borderRadius: 16, marginVertical: 8 }}
              />
            </TouchableOpacity>
          </ScrollView>

          {tooltipData && (
            <View
              style={[
                styles.tooltip,
                { 
                  left: tooltipLeft,
                  top: 65 + tooltipData.pixelY,
                }
              ]}
            >
              <TouchableOpacity
                style={styles.tooltipContent}
                onPress={dismissTooltip}
                activeOpacity={0.9}
              >
                <Text style={styles.tooltipText}>
                  Value: <Text style={{ fontWeight: '700' }}>{tooltipData.value.toFixed(2)}</Text>{tooltipData.unit}
                </Text>
                <Text style={styles.tooltipText}>Time: {tooltipData.formattedDate}</Text>
                <Text style={styles.tooltipText}>
                  Ideal: {tooltipData.idealRange.min.toFixed(1)} — {tooltipData.idealRange.max.toFixed(1)}{tooltipData.unit}
                </Text>
                <Text style={[styles.tooltipStatus, {
                  color: tooltipData.value >= tooltipData.idealRange.min && 
                         tooltipData.value <= tooltipData.idealRange.max 
                    ? '#10B981' 
                    : '#EF4444'
                }]}>
                  {tooltipData.value >= tooltipData.idealRange.min && 
                   tooltipData.value <= tooltipData.idealRange.max 
                    ? '✅ Within Ideal Range' 
                    : '⚠️ Outside Ideal Range'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.chartFooter}>Tap any point on the line for details</Text>
      </View>
    );
  };

  // Latest parameter values
  const latestParam = parameters[pond.pond_name];
  const getParamValue = (key: ParamKey): string => 
    latestParam ? (latestParam[key] || 'N/A') : 'N/A';

  const unitForParam = (param: string): string => 
    parameterInfo[param]?.unit || '';

<<<<<<< HEAD
  const parameterCards = [
    { label: 'Temp',    param: 'Temperature', key: 'temperature', value: getParamValue('temperature'), icon: '🌡️' },
    { label: 'pH',      param: 'pH Level',    key: 'pH',          value: getParamValue('pH'),         icon: '🧪' },
    { label: 'Salinity',param: 'Salinity',    key: 'salinity',    value: getParamValue('salinity'),   icon: '💧' },
    { label: 'Ammonia', param: 'Ammonia',     key: 'ammonia',     value: getParamValue('ammonia'),    icon: '☣️' },
=======
  const parameterCards: { label: string; param: string; key: string; value: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
    { label: 'Temp',     param: 'Temperature', key: 'temperature', value: getParamValue('temperature'), icon: 'thermometer' },
    { label: 'pH',       param: 'pH Level',    key: 'pH',          value: getParamValue('pH'),          icon: 'activity' },
    { label: 'Salinity', param: 'Salinity',    key: 'salinity',    value: getParamValue('salinity'),    icon: 'droplet' },
    { label: 'Ammonia',  param: 'Ammonia',     key: 'ammonia',     value: getParamValue('ammonia'),     icon: 'wind' },
>>>>>>> origin/ui2
  ];

  return (
    <>
      <Text style={styles.parametersTitle}>Water Quality Parameters</Text>

      <View style={styles.parameterGrid}>
<<<<<<< HEAD
        {parameterCards.map(({ label, param, key, value, icon }) => (
          <TouchableOpacity
            key={param}
            style={[
              styles.parameterCard,
              { 
                backgroundColor: parameterInfo[param].color, 
                borderColor: parameterInfo[param].chartColor 
              }
            ]}
            onPress={() => key 
              ? handleParamPress(param, value, key as ParamKey, pond.pond_name) 
              : showParameterModal(param, value)
            }
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.85}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Text style={styles.paramIcon}>{icon}</Text>
              <Text style={styles.parameterLabel}>{label}</Text>
              <Text style={styles.parameterValue}>
                {value}{value !== 'N/A' ? unitForParam(param) : ''}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        ))}
=======
        {parameterCards.map(({ label, param, key, value, icon }) => {
          const info = parameterInfo[param];
          return (
            <TouchableOpacity
              key={param}
              style={[styles.parameterCard, { backgroundColor: info.color, borderColor: info.accentColor + '40' }]}
              onPress={() => key ? handleParamPress(param, value, key as ParamKey, pond.pond_name) : showParameterModal(param, value)}
              accessible
              accessibilityLabel={`${param}: ${value}`}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Animated.View style={{ alignItems: 'center', transform: [{ scale: scaleAnim }] }}>
                <View style={[styles.paramIconCircle, { backgroundColor: info.accentColor + '18', borderColor: info.accentColor + '30' }]}>
                  <Feather name={icon} size={18} color={info.accentColor} />
                </View>
                <Text style={styles.parameterLabel}>{label}</Text>
                <Text style={[styles.parameterValue, { color: info.accentColor }]}>{value ? `${value}${unit(param)}` : value}</Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
>>>>>>> origin/ui2
      </View>

      {/* Modal */}
      <Modal visible={paramModal.visible} animationType="slide" transparent>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <View style={[styles.modalCard, { backgroundColor: paramModal.color }]}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerContent}>
                <Text style={styles.modalTitle}>{paramModal.parameter}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setParamModal(prev => ({ ...prev, visible: false }));
                  setParamHistory([]);
                  setTooltipData(null);
                }}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
              >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </Animated.View>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView 
              style={styles.modalScrollContainer}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              <View style={styles.paramValueContainer}>
<<<<<<< HEAD
                <Text style={styles.paramValue}>
                  {paramModal.value}{paramModal.value !== 'N/A' ? unitForParam(paramModal.parameter) : ''}
                </Text>
=======
                <Text style={[styles.paramValue, { color: paramModal.accentColor }]}>{paramModal.value}</Text>
>>>>>>> origin/ui2
              </View>

              <Text style={styles.paramDescription}>{paramModal.description}</Text>

              {historyLoading ? (
                <ActivityIndicator 
                  size="large" 
                  color={parameterInfo[paramModal.parameter]?.chartColor || '#3B82F6'} 
                  style={styles.loadingIndicator} 
                />
              ) : (
                renderChart()
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  parametersTitle: {
<<<<<<< HEAD
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 14,
=======
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
>>>>>>> origin/ui2
  },
  parameterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  parameterCard: {
    borderRadius: 16,
<<<<<<< HEAD
    padding: 16,
    margin: 4,
    flexBasis: '47%',
=======
    padding: 14,
    flexBasis: '48%',
>>>>>>> origin/ui2
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
<<<<<<< HEAD
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1.5,
  },
  paramIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  parameterLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
=======
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  paramIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  parameterLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 3,
>>>>>>> origin/ui2
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  parameterValue: {
<<<<<<< HEAD
    fontSize: 19,
=======
    fontSize: 15,
>>>>>>> origin/ui2
    fontWeight: '700',
    textAlign: 'center',
    color: '#1F2937',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalCard: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
    width: '100%',
    height: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
<<<<<<< HEAD
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#ffffff',
=======
    borderBottomColor: '#F0EDE8',
    backgroundColor: '#FFFFFF',
  },
  headerActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
>>>>>>> origin/ui2
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    fontSize: 26,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalScrollContainer: {
    flex: 1,
    padding: 24,
  },
  paramValueContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  paramValue: {
    fontSize: 28,
    color: '#1F2937',
    fontWeight: '700',
  },
  paramDescription: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },

  // Chart Styles
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyChartContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyChartText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  chartFooter: {
    fontSize: 12.5,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },

  // Tooltip
  tooltip: {
    position: 'absolute',
<<<<<<< HEAD
    zIndex: 20,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    maxWidth: 210,
    borderWidth: 1,
    borderColor: '#BFDBFE',
=======
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: '#E5E7EB',
>>>>>>> origin/ui2
  },
  tooltipContent: {
    padding: 14,
  },
  tooltipText: {
    color: '#1F2937',
    fontSize: 13.5,
    marginBottom: 4,
  },
  tooltipStatus: {
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 8,
  },

  loadingIndicator: {
    marginVertical: 40,
  },
});

export default WaterQualityParameters;