import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';
import { rtlTextAlign } from '../lib/rtl';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SearchBarProps {
  /** Controlled value of the search input. */
  value?: string;
  /** Called when the text changes. */
  onChangeText?: (text: string) => void;
  /** Called when the user presses the search / submit key on the keyboard. */
  onSubmit?: () => void;
  /** Called when the filter icon button is pressed. */
  onFilterPress?: () => void;
  /** Placeholder text. Defaults to Arabic. */
  placeholder?: string;
  /** Optional outer container override for embedded layouts. */
  containerStyle?: StyleProp<ViewStyle>;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const SearchBar: React.FC<SearchBarProps> = ({
  value: externalValue,
  onChangeText,
  onSubmit,
  onFilterPress,
  placeholder = 'ابحث عن طبيب، تخصص، أو مدينة...',
  containerStyle,
}) => {
  const [internalValue, setInternalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const isControlled = externalValue !== undefined;
  const value = isControlled ? externalValue : internalValue;

  const handleChangeText = useCallback(
    (text: string) => {
      if (!isControlled) setInternalValue(text);
      onChangeText?.(text);
    },
    [isControlled, onChangeText],
  );

  const handleClear = useCallback(() => {
    if (!isControlled) setInternalValue('');
    onChangeText?.('');
  }, [isControlled, onChangeText]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  const hasText = value.length > 0;

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        containerStyle,
      ]}
    >
      {/* Search icon */}
      <View style={styles.searchIconContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
      </View>

      {/* Text input */}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        textAlign={rtlTextAlign()}
        accessibilityLabel="بحث"
        returnKeyType="search"
      />

      {/* Clear button — visible only when text is present */}
      {hasText && (
        <Pressable
          style={styles.clearButton}
          onPress={handleClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="مسح النص"
        >
          <Ionicons
            name="close-circle"
            size={18}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      )}

      {/* Filter button */}
      <Pressable
        style={styles.filterButton}
        onPress={onFilterPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="تصفية"
      >
        <Ionicons
          name="options-outline"
          size={22}
          color={theme.colors.primary}
        />
      </Pressable>
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 50,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
  },
  containerFocused: {
    borderColor: theme.colors.focus,
    backgroundColor: theme.colors.white,
  },
  searchIconContainer: {
    marginLeft: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
    marginHorizontal: theme.spacing.sm,
  },
  clearButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  filterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    marginLeft: theme.spacing.sm,
  },
});

export default SearchBar;
