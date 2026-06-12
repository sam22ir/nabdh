import { expect, test } from '@playwright/test';

function nextDateForDay(dayOfWeek: number) {
  const date = new Date();
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + offset);
    if (candidate.getDay() === dayOfWeek) {
      return {
        iso: candidate.toISOString().slice(0, 10),
        display: `${String(candidate.getDate()).padStart(2, '0')}/${String(
          candidate.getMonth() + 1,
        ).padStart(2, '0')}/${candidate.getFullYear()}`,
        day: candidate.getDate(),
        month: candidate.toLocaleDateString('ar-SA', { month: 'short' }),
      };
    }
  }
  throw new Error(`No day ${dayOfWeek} found in the next 14 days`);
}

test('patient can register, filter doctors, favorite, and book an appointment on web', async ({
  page,
}) => {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleProblems.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleProblems.push(error.message);
  });
  page.on('dialog', async (dialog) => {
    consoleProblems.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });

  const email = `codex-web-booking-${Date.now()}@example.test`;
  const password = 'Password123!';
  const patientName = 'مريض تجربة كودكس';
  const nextSunday = nextDateForDay(0);

  await page.goto('/');

  await expect(page.getByText('احجز في ثوانٍ')).toBeVisible();
  await page.getByRole('button', { name: 'الشريحة التالية' }).click();
  await expect(page.getByText('شفافية كاملة')).toBeVisible();
  await page.getByRole('button', { name: 'الشريحة التالية' }).click();
  await expect(page.getByText('تذكير بالموعد')).toBeVisible();
  await page.getByText('أنا مريض', { exact: true }).click();

  await expect(page.getByText('إنشاء حساب')).toBeVisible();
  await page.getByPlaceholder('الاسم الكامل بالعربية').fill(patientName);
  await page.getByPlaceholder('example@email.com').fill(email);
  await page.getByPlaceholder('كلمة المرور (6 أحرف على الأقل)').fill(password);
  await page.getByPlaceholder('أعد كتابة كلمة المرور').fill(password);
  await page.getByText('التالي', { exact: true }).click();

  await expect(page.getByText('الموقع')).toBeVisible();
  await page.getByText('اختر ولايتك', { exact: true }).click();
  await page.getByText('الجزائر', { exact: true }).click();
  await page.getByText('اختر بلديتك', { exact: true }).click();
  await page.getByText('سيدي امحمد', { exact: true }).click();
  await page.getByPlaceholder('YYYY-MM-DD').fill('1992-05-12');
  await page.getByText('تسجيل', { exact: true }).click();

  await expect(page.getByText('التخصصات الشائعة')).toBeVisible();

  await page.getByRole('button', { name: 'احجز موعد' }).click();
  await expect(page.getByRole('button', { name: 'تصفية حسب التخصص' })).toBeVisible();
  await page.getByRole('button', { name: 'تصفية حسب التخصص' }).click();
  await expect(page.getByText('اختر التخصص')).toBeVisible();
  await page.getByRole('button', { name: 'طب القلب', exact: true }).click();
  await expect(page.getByRole('button', { name: 'د. أمينة بن يوسف، طب القلب' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'د. كريم منصوري، جراحة العظام' })).toHaveCount(0);

  await page.getByRole('button', { name: 'د. أمينة بن يوسف، طب القلب' }).click();
  await expect(page.getByText('د. أمينة بن يوسف')).toBeVisible();
  await page.getByRole('button', { name: 'إضافة إلى المفضلة' }).click();
  await expect(page.getByRole('button', { name: 'إزالة من المفضلة' })).toBeVisible();
  await page.getByRole('button', { name: 'احجز موعداً' }).click();

  await expect(page.getByText('اختر العيادة')).toBeVisible();
  await page.getByRole('radio', { name: 'اختيار عيادة Cabinet Cardio Didouche' }).click();
  await page.getByRole('button', { name: 'التالي' }).click();

  await expect(page.getByText('اختر التاريخ')).toBeVisible();
  await page
    .getByRole('button', {
      name: `اختيار تاريخ ${nextSunday.day} ${nextSunday.month}`,
    })
    .click();
  const availableTime = page
    .locator('[role="button"]:not([aria-disabled="true"])')
    .filter({ hasText: /^\d{2}:\d{2}$/ })
    .first();
  await expect(availableTime).toBeVisible();
  await availableTime.click();
  await page.getByRole('button', { name: 'التالي' }).click();

  await expect(page.getByText('من سيزور الطبيب؟')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'نفسي' })).toBeVisible();
  await page.getByRole('button', { name: 'التالي' }).click();

  await expect(page.getByText('ملخص الحجز')).toBeVisible();
  await expect(page.getByText('د. أمينة بن يوسف').last()).toBeVisible();
  await expect(page.getByText('Cabinet Cardio Didouche').last()).toBeVisible();
  await page.getByRole('button', { name: 'تأكيد الحجز' }).click();

  await expect(page.getByText('تم الحجز بنجاح!')).toBeVisible();
  await expect(page.getByText('Cabinet Cardio Didouche').last()).toBeVisible();
  await page.getByRole('button', { name: 'عرض مواعيدي' }).click();

  await expect(page.getByText('د. أمينة بن يوسف').last()).toBeVisible();
  await expect(page.getByText(nextSunday.display).last()).toBeVisible();

  expect(consoleProblems.filter((entry) => !entry.includes('Download the React DevTools'))).toEqual([]);
});
