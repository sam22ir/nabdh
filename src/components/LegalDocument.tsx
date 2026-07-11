import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';

export type LegalSection = { title: string; paragraphs: string[] };

export default function LegalDocument({
  title,
  version,
  intro,
  sections,
}: {
  title: string;
  version: string;
  intro: string;
  sections: LegalSection[];
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="العودة" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-forward" size={22} color={theme.colors.official} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.version}>الإصدار: {version}</Text>
        <Text style={styles.intro}>{intro}</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
            ))}
          </View>
        ))}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>تنبيه قبل الإطلاق التجاري</Text>
          <Text style={styles.noticeText}>
            يجب استكمال هوية مشغل نبض وعنوانه المسجل ورقم التعريف الجبائي أو السجل التجاري
            ووسيلة التواصل القانونية ومدد الاحتفاظ الدقيقة، ثم اعتماد النص من مستشار قانوني جزائري.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceRaised,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  title: { flex: 1, fontFamily: 'Cairo-Bold', fontSize: 19, color: theme.colors.official, textAlign: 'center' },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing['4xl'], gap: theme.spacing.lg },
  version: { fontFamily: 'Cairo-Regular', fontSize: 12, color: theme.colors.textMuted, textAlign: 'right' },
  intro: { fontFamily: 'Cairo-Regular', fontSize: 15, lineHeight: 28, color: theme.colors.textPrimary, textAlign: 'right' },
  section: { gap: theme.spacing.sm },
  sectionTitle: { fontFamily: 'Cairo-Bold', fontSize: 17, color: theme.colors.official, textAlign: 'right' },
  paragraph: { fontFamily: 'Cairo-Regular', fontSize: 14, lineHeight: 27, color: theme.colors.textSecondary, textAlign: 'right' },
  notice: { borderRightWidth: 4, borderRightColor: theme.colors.warning, padding: theme.spacing.md, backgroundColor: theme.colors.status.warning.background },
  noticeTitle: { fontFamily: 'Cairo-Bold', color: theme.colors.status.warning.text, textAlign: 'right' },
  noticeText: { marginTop: theme.spacing.xs, fontFamily: 'Cairo-Regular', lineHeight: 25, color: theme.colors.status.warning.text, textAlign: 'right' },
});
