import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  buildMapPickerHtml,
  parsePinMessage,
  type Coordinates,
} from '@/lib/mapPickerHtml';
import { theme } from '@/lib/theme';

type Props = {
  visible: boolean;
  initial: Coordinates | null;
  onConfirm: (coordinates: Coordinates) => void;
  onCancel: () => void;
};

export default function MapPicker({ visible, initial, onConfirm, onCancel }: Props) {
  const [pin, setPin] = useState<Coordinates | null>(initial);
  const html = useMemo(() => buildMapPickerHtml(initial), [initial, visible]);

  useEffect(() => {
    if (!visible) return;
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      const next = parsePinMessage(event.data);
      if (next) setPin(next);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.screen}>
        <Text style={styles.title}>اختر موقع المركز</Text>
        <Text style={styles.hint}>اضغط على الخريطة أو اسحب العلامة إلى مكان المركز.</Text>
        <View style={styles.map}>
          {/* eslint-disable-next-line react/no-unknown-property */}
          <iframe title="map" srcDoc={html} style={{ width: '100%', height: '100%', border: 0 }} />
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.button, styles.cancel]}>
            <Text style={styles.cancelText}>إلغاء</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!pin}
            onPress={() => pin && onConfirm(pin)}
            style={[styles.button, styles.confirm, !pin && styles.disabled]}
          >
            <Text style={styles.confirmText}>تأكيد الموقع</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  title: {
    fontFamily: 'Cairo-Bold',
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    paddingTop: theme.spacing.md,
  },
  hint: {
    fontFamily: 'Cairo-Regular',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingBottom: theme.spacing.sm,
  },
  map: { flex: 1 },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, padding: theme.spacing.md },
  button: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  cancel: { backgroundColor: theme.colors.surfaceMuted },
  cancelText: { fontFamily: 'Cairo-Bold', color: theme.colors.textPrimary },
  confirm: { backgroundColor: theme.colors.primary },
  confirmText: { fontFamily: 'Cairo-Bold', color: theme.colors.white },
  disabled: { opacity: 0.5 },
});
