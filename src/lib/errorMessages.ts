function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

export function getArabicErrorMessage(
  error: unknown,
  fallback = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
): string {
  const rawMessage = getRawErrorMessage(error).toLowerCase();

  if (rawMessage.includes('patient profile not found')) {
    return 'يرجى إكمال ملفك الشخصي قبل المتابعة.';
  }

  if (
    rawMessage.includes('not authenticated') ||
    rawMessage.includes('unauthenticated')
  ) {
    return 'يجب تسجيل الدخول أولاً.';
  }

  if (
    rawMessage.includes('access denied') ||
    rawMessage.includes('do not own') ||
    rawMessage.includes('not involved')
  ) {
    return 'لا تملك صلاحية تنفيذ هذا الإجراء.';
  }

  if (
    rawMessage.includes('network') ||
    rawMessage.includes('websocket') ||
    rawMessage.includes('failed to fetch') ||
    rawMessage.includes('timeout') ||
    rawMessage.includes('timed out')
  ) {
    return 'تعذر الاتصال بالخادم. تحقق من اتصالك ثم حاول مرة أخرى.';
  }

  return fallback;
}
