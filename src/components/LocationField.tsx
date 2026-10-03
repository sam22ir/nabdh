import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import MapPicker from '@/components/MapPicker';
import type { Coordinates } from '@/lib/mapPickerHtml';
import { theme } from '@/lib/theme';

type Props = {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
};

/** Center location: use the phone's GPS, or pick on an OpenStreetMap pop-up. */
export default function LocationField({ value, onChange }: Props) {
  const [mapVisible, setMapVisible] = useState(false);
  const [locating, setLocating] = useState(false);

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('الموقع غير متاح', 'اسمح للتطبيق بالوصول إلى الموقع، أو اختر المكان من الخريطة.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      Alert.alert('تعذر تحديد الموقع', 'تأكد من تشغيل الموقع على هاتفك، أو اختر المكان من الخريطة.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>موقع المركز</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          disabled={locating}
          onPress={() => void useCurrentLocation()}
          style={styles.option}
        >
          {locating ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Ionicons name="locate-outline" size={20} color={theme.colors.primary} />
          )}
          <Text style={styles.optionText}>موقعي الحالي</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setMapVisible(true)} style={styles.option}>
          <Ionicons name="map-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.optionText}>اختر من الخريطة</Text>
        </Pressable>
      </View>
      {value ? (
        <View style={styles.selected}>
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
          <Text style={styles.selectedText}>
            تم تحديد الموقع ({value.latitude.toFixed(4)}، {value.longitude.toFixed(4)})
          </Text>
        </View>
      ) : (
        <Text style={styles.required}>الموقع مطلوب</Text>
      )}
      <MapPicker
        visible={mapVisible}
        initial={value}
        onCancel={() => setMapVisible(false)}
        onConfirm={(coordinates) => {
          onChange(coordinates);
          setMapVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  label: { fontFamily: 'Cairo-Bold', color: theme.colors.textPrimary, textAlign: 'right' },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  option: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  optionText: { fontFamily: 'Cairo-Bold', color: theme.colors.textPrimary },
  selected: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  selectedText: { fontFamily: 'Cairo-Regular', color: theme.colors.status.success.text },
  required: { fontFamily: 'Cairo-Regular', color: theme.colors.textSecondary, textAlign: 'right' },
});
