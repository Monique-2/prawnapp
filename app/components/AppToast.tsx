import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

interface AppToastProps {
  visible: boolean;
  type: ToastType;
  title: string;
  message?: string;
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; title: string }> = {
  success: { bg: '#F0FDF4', border: '#86EFAC', icon: '#16A34A', title: '#15803D' },
  error:   { bg: '#FFF1F2', border: '#FECDD3', icon: '#EF4444', title: '#DC2626' },
  info:    { bg: '#FFF7ED', border: '#FDDBB0', icon: '#F97316', title: '#EA580C' },
};

export default function AppToast({ visible, type, title, message }: AppToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const c = COLORS[type];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { backgroundColor: c.bg, borderColor: c.border, opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: c.icon + '22' }]}>
        <Text style={[styles.icon, { color: c.icon }]}>{ICONS[type]}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: c.title }]}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 16,
    fontWeight: '800',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});
