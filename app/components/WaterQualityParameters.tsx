import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Modal,
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
  });
  const [paramHistory, setParamHistory] = useState<ParameterRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [scrollX, setScrollX] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const screenWidth = Dimensions.get('window').width;

  const waterQualityParams = ['Temperature', 'pH Level', 'Salinity', 'Ammonia'];

  const paramKeyMap: { [key: string]: ParamKey } = {
    Temperature: 'temperature',
    'pH Level': 'pH',
    Salinity: 'salinity',
    Ammonia: 'ammonia',
  };

  const parameterInfo: { [key: string]: { description: string; color: string; unit?: string; chartColor: string; idealRange: { min: number; max: number } } } = {
    Temperature: {
      description: 'Water temperature affects prawn metabolism and growth. Ideal range: 26-30°C.',
      color: '#BFDBFE',
      unit: '°C',
      chartColor: '#D97706',
      idealRange: { min: 26, max: 30 },
    },
    'pH Level': {
      description: 'pH measures water acidity/alkalinity. Ideal range for prawns: 7.5-8.5.',
      color: '#BFDBFE',
      unit: '',
      chartColor: '#047857',
      idealRange: { min: 7.5, max: 8.5 },
    },
    Salinity: {
      description: 'Salinity impacts prawn osmoregulation. Ideal range: 15-25 ppt.',
      color: '#BFDBFE',
      unit: 'ppt',
      chartColor: '#7C3AED',
      idealRange: { min: 15, max: 25 },
    },
    Ammonia: {
      description: 'Ammonia levels indicate water quality. Should be kept below 0.1 ppm.',
      color: '#BFDBFE',
      unit: 'ppm',
      chartColor: '#B91C1C',
      idealRange: { min: 0, max: 0.5 },
    },
  };

  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const fetchHistory = async (pondId: string) => {
    setHistoryLoading(true);
    setTooltipData(null);
    try {
      const res = await fetch(`${BASE_URL}smart_prawn_paramenters.php?pond_name=${pondId}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const sortedHistory = data.data.sort((a: ParameterRecord, b: ParameterRecord) => 
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        );
        setParamHistory(sortedHistory);
      }
    } catch (error) {
      console.error("History fetch error:", error);
      Alert.alert("Error", "Could not fetch parameter history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const showParameterModal = (parameter: string, value: string, paramKey?: ParamKey, pondId?: string) => {
    setParamModal({
      visible: true,
      parameter,
      value,
      description: parameterInfo[parameter]?.description || 'No description available.',
      color: parameterInfo[parameter]?.color || '#BFDBFE',
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

  const dismissTooltip = () => {
    setTooltipData(null);
  };

  const dismissOnChartPress = () => {
    if (tooltipData) {
      setTooltipData(null);
    }
  };

  const renderChart = () => {
    if (!paramModal.paramKey || paramHistory.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Text style={styles.emptyChartText}>No historical data available to display.</Text>
        </View>
      );
    }

    const { chartColor, unit = '', idealRange } = parameterInfo[paramModal.parameter];
    const dataValues = paramHistory.map(record => parseFloat(record[paramModal.paramKey!] || '0')).filter(val => !isNaN(val));

    if (dataValues.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Text style={styles.emptyChartText}>No valid data points to display.</Text>
        </View>
      );
    }

    const average = dataValues.length > 0 ? (dataValues.reduce((a, b) => a + b, 0) / dataValues.length).toFixed(2) : 'N/A';

    const minY = Math.min(...dataValues);
    const maxY = Math.max(...dataValues);
    const rangeY = maxY - minY;
    const plotHeight = 180; // Approximate plot area height

    const allSameDay = paramHistory.every(record => 
      new Date(record.updated_at).toDateString() === new Date(paramHistory[0].updated_at).toDateString()
    );

    const maxLabels = 10;
    const labelStep = Math.ceil(paramHistory.length / maxLabels);
    const labels = paramHistory.map((record, idx) => {
      if (idx % labelStep !== 0) return '';
      const date = new Date(record.updated_at);
      return allSameDay ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    });

    const chartData = {
      labels,
      datasets: [{
        data: dataValues,
        color: () => chartColor,
        strokeWidth: 3
      }],
    };

    const chartWidth = Math.max(Math.min(screenWidth * 0.85, 450), paramHistory.length * 60);
    const chartHeight = 280;

    const chartConfig = {
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: paramModal.color,
      backgroundGradientFromOpacity: 0.8,
      backgroundGradientToOpacity: 0.3,
      decimalPlaces: 2,
      color: (opacity = 1) => hexToRgba(chartColor, opacity),
      labelColor: (opacity = 1) => hexToRgba('#374151', opacity),
      style: { borderRadius: 16 },
      propsForDots: { 
        r: '8', 
        strokeWidth: '3', 
        stroke: chartColor 
      },
      propsForBackgroundLines: { strokeDasharray: '5,5', stroke: hexToRgba('#E5E7EB', 0.5) },
      horizontalLabelRotation: -45,
    };

    const handleDataPointClick = ({ value, index }: { value: number; index: number }) => {
      const record = paramHistory[index];
      const xPosition = index * (chartWidth / (paramHistory.length - 1 || 1));
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

    const tooltipLeft = tooltipData ? Math.min(Math.max(tooltipData.x - scrollX - 75, 10), screenWidth - 160) : 0;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{`Historical Data (Avg: ${average}${unit ? ` ${unit}` : ''})`}</Text>
        <View style={{ flex: 1, width: '100%' }}>
          <ScrollView 
            ref={scrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => setScrollX(event.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
            directionalLockEnabled={true}
            bounces={false}
            contentContainerStyle={{ alignItems: 'center' }}
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
                style={{ borderRadius: 16 }}
              />
            </TouchableOpacity>
          </ScrollView>
          {tooltipData && (
            <View
              style={[
                styles.tooltip, 
                { 
                  left: tooltipLeft, 
                  top: 50 + tooltipData.pixelY - 50 
                }
              ]}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                style={styles.tooltipContent}
                onPress={dismissTooltip}
                accessible
                accessibilityLabel="Dismiss tooltip"
              >
                <Text style={styles.tooltipText}>Value: {tooltipData.value.toFixed(2)}{tooltipData.unit ? ` ${tooltipData.unit}` : ''}</Text>
                <Text style={styles.tooltipText}>Time: {tooltipData.formattedDate}</Text>
                <Text style={styles.tooltipText}>Ideal Range: {tooltipData.idealRange.min.toFixed(2)} - {tooltipData.idealRange.max.toFixed(2)}{tooltipData.unit ? ` ${tooltipData.unit}` : ''}</Text>
                <Text style={[styles.tooltipText, { 
                  color: tooltipData.value >= tooltipData.idealRange.min && tooltipData.value <= tooltipData.idealRange.max ? '#10B981' : '#EF4444',
                  fontWeight: '600'
                }]}>
                  {tooltipData.value >= tooltipData.idealRange.min && tooltipData.value <= tooltipData.idealRange.max ? '✅ Within Ideal Range' : '⚠️ Outside Ideal Range'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.chartFooter}>Tap points on the chart for details</Text>
      </View>
    );
  };

  const latestParam = parameters[pond.pond_name];
  const getParamValue = (key: ParamKey) => latestParam ? (latestParam[key] || 'N/A') : 'N/A';
  const unit = (param: string) => parameterInfo[param]?.unit || '';

  const parameterCards = [
    { label: 'Temp',    param: 'Temperature',   key: 'temperature', value: getParamValue('temperature'), icon: '🌡️' },
    { label: 'pH',      param: 'pH Level',      key: 'pH',          value: getParamValue('pH'),         icon: '🧪' },
    { label: 'Salinity',param: 'Salinity',      key: 'salinity',    value: getParamValue('salinity'),   icon: '💧' },
    { label: 'Ammonia', param: 'Ammonia',       key: 'ammonia',     value: getParamValue('ammonia'),    icon: '☣️' },
  ];

  return (
    <>
      <Text style={styles.parametersTitle}>Water Quality Parameters</Text>
      <View style={styles.parameterGrid}>
        {parameterCards.map(({ label, param, key, value, icon }) => (
          <TouchableOpacity
            key={param}
            style={[styles.parameterCard, { backgroundColor: parameterInfo[param].color, borderWidth: 1, borderColor: parameterInfo[param].chartColor }]}
            onPress={() => key ? handleParamPress(param, value, key as ParamKey, pond.pond_name) : showParameterModal(param, value)}
            accessible
            accessibilityLabel={`${param}: ${value}`}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Text style={styles.paramIcon}>{icon}</Text>
              <Text style={styles.parameterLabel}>{label}</Text>
              <Text style={styles.parameterValue}>{value ? `${value}${unit(param)}` : value}</Text>
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={paramModal.visible} animationType="slide" transparent>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <View style={[styles.modalCard, { backgroundColor: paramModal.color }]}>
            <View style={styles.modalHeader}>
              <View style={styles.headerActionsLeft} />
              <View style={styles.headerContent}>
                <Text style={styles.modalTitle}>{paramModal.parameter}</Text>
              </View>
              <View style={styles.headerActionsRight}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setParamModal({ ...paramModal, visible: false });
                    setParamHistory([]);
                    setTooltipData(null);
                  }}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  accessible
                  accessibilityLabel="Close modal"
                >
                  <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView 
              style={styles.modalScrollContainer} 
              showsVerticalScrollIndicator={false}
              directionalLockEnabled={true}
              bounces={false}
            >
              <View style={styles.paramValueContainer}>
                <Text style={styles.paramValue}>{paramModal.value}</Text>
              </View>
              <Text style={styles.paramDescription}>{paramModal.description}</Text>
              {historyLoading ? (
                <ActivityIndicator size="large" color={parameterInfo[paramModal.parameter]?.chartColor || '#3B82F6'} style={styles.loadingIndicator} />
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  parameterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    marginBottom: 20,
  },
  parameterCard: {
    borderRadius: 16,
    padding: 16,
    margin: 2,
    flexBasis: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  paramIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  parameterLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  parameterValue: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  modalCard: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
    width: '100%',
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#BFDBFE',
  },
  headerActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 22,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalScrollContainer: {
    flex: 1,
    padding: 24,
  },
  paramValueContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  paramValue: {
    fontSize: 24,
    color: '#1F2937',
    fontWeight: '700',
  },
  paramDescription: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyChartContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  emptyChartText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  chartFooter: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  tooltip: {
    position: 'absolute',
    zIndex: 10,
    backgroundColor: '#BFDBFE',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  tooltipContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tooltipText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'left',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
});

export default WaterQualityParameters;