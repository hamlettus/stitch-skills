import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, fonts } from '@/theme';
import { TabIcon, TabIconName } from '@/components/atoms/TabIcon';
import { CrateScreen } from '@/screens/CrateScreen';
import { WheelScreen } from '@/screens/WheelScreen';
import { StudioScreen } from '@/screens/StudioScreen';
import { FeedScreen } from '@/screens/FeedScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';

export interface RootTabsProps {
  readonly initialRoute?: string;
}

const Tab = createBottomTabNavigator();

const ICONS: Record<string, TabIconName> = {
  Crate: 'crate',
  Wheel: 'wheel',
  Studio: 'studio',
  Feed: 'feed',
  You: 'you',
};

export const RootTabs: React.FC<RootTabsProps> = ({ initialRoute = 'Crate' }) => {
  return (
    <Tab.Navigator
      initialRouteName={initialRoute}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: route.name === 'Studio' ? colors.energy : colors.key,
        tabBarInactiveTintColor: colors.muted2,
        tabBarStyle: {
          backgroundColor: colors.bg2,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 70,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.5 },
        tabBarIcon: ({ color }) => <TabIcon name={ICONS[route.name]} color={color} />,
      })}
    >
      <Tab.Screen name="Crate" component={CrateScreen} />
      <Tab.Screen name="Wheel" component={WheelScreen} />
      <Tab.Screen name="Studio" component={StudioScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="You" component={ProfileScreen} />
    </Tab.Navigator>
  );
};
