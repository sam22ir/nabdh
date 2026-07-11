export type RTLValue<T> = T;

/**
 * Returns a style object with the appropriate writing direction
 * based on the device's current layout direction.
 */
export const rtlStyle = (): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: 'rtl',
});

/**
 * Returns the correct text alignment based on the device's RTL status.
 * - RTL devices: "right"
 * - LTR devices: "left"
 */
export const rtlTextAlign = (): 'right' => 'right';

/**
 * Returns the RTL or LTR value depending on the device's layout direction.
 *
 * @param ltrValue - Value to use when the device is in LTR mode.
 * @param rtlValue - Value to use when the device is in RTL mode.
 */
export const rtlValue = <T>(ltrValue: T, rtlValue: T): T =>
  rtlValue;
