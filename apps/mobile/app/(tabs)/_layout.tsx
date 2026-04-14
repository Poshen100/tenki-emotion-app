import { Tabs } from 'expo-router';
import { colors, spacing } from '../../theme';

/**
 * 5-tab bottom navigation for TENKI Core.
 * Tabs: Today | Scan | Session | Timeline | Lab
 *
 * Uses simple Unicode icons as placeholders until the icon system
 * (docs/ICON-SYSTEM-BATCH1.md) is integrated with react-native-svg.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          paddingBottom: spacing.sm,
          paddingTop: spacing.xs,
          height: 84,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <TabIcon icon="◉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => <TabIcon icon="◎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: 'Session',
          tabBarIcon: ({ color }) => <TabIcon icon="▶" color={color} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color }) => <TabIcon icon="≡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="lab"
        options={{
          title: 'Lab',
          tabBarIcon: ({ color }) => <TabIcon icon="⚙" color={color} />,
        }}
      />
    </Tabs>
  );
}

import { Text } from 'react-native';

/** Placeholder tab icon using Unicode characters. */
function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 22, color }}>{icon}</Text>;
}
