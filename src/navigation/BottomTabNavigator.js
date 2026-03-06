/**
 * Bottom Tab Navigator
 * Clean tab bar matching Expo project design
 * 4 main tabs + More button with bottom sheet for secondary screens
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Pressable,
    Platform,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/Colors';
import { Shadow, BorderRadius } from '../constants/Spacing';
import { ms } from '../utils/Responsive';
import {
    FollowUpEngineScreen,
    LeadsScreen,
    PipelineScreen,
    TasksScreen,
} from '../screens';
import { ROUTES } from '../constants';

const Tab = createBottomTabNavigator();

// Tab icon configuration matching Expo project
const TAB_ICONS = {
    FollowUp: { active: 'call', inactive: 'call-outline' },
    Leads: { active: 'people', inactive: 'people-outline' },
    Pipeline: { active: 'trending-up', inactive: 'trending-up-outline' },
    Tasks: { active: 'checkbox', inactive: 'checkbox-outline' },
};

// More menu items - secondary screens
const MORE_ITEMS = [
    { key: ROUTES.COMPANY, icon: 'grid-outline', label: 'Companies' },
    { key: ROUTES.CONTACTS, icon: 'people-outline', label: 'Contacts' },
    { key: ROUTES.REPORTS, icon: 'bar-chart-outline', label: 'Reports' },
];

function TabBarIcon({ name, focused }) {
    const iconConfig = TAB_ICONS[name];
    if (!iconConfig) return null;
    const iconName = focused ? iconConfig.active : iconConfig.inactive;
    return (
        <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
            <IonIcon
                name={iconName}
                size={ms(22)}
                color={focused ? Colors.primary : Colors.textTertiary}
            />
        </View>
    );
}

function MoreSheet({ visible, onClose, onSelect }) {
    const insets = useSafeAreaInsets();
    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={moreStyles.overlay} onPress={onClose}>
                <Pressable
                    style={[moreStyles.sheet, { paddingBottom: insets.bottom + ms(16) }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={moreStyles.handle} />
                    <Text style={moreStyles.sheetTitle}>More</Text>
                    <View style={moreStyles.grid}>
                        {MORE_ITEMS.map((item) => (
                            <TouchableOpacity
                                key={item.key}
                                style={moreStyles.gridItem}
                                onPress={() => {
                                    onClose();
                                    onSelect(item.key);
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={moreStyles.gridIcon}>
                                    <IonIcon name={item.icon} size={24} color={Colors.textPrimary} />
                                </View>
                                <Text style={moreStyles.gridLabel}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function CustomTabBar({ state, descriptors, navigation }) {
    const [moreVisible, setMoreVisible] = useState(false);
    const insets = useSafeAreaInsets();

    return (
        <>
            <MoreSheet
                visible={moreVisible}
                onClose={() => setMoreVisible(false)}
                onSelect={(key) => navigation.navigate(key)}
            />
            <View style={[tabStyles.tabBar, { paddingBottom: insets.bottom || ms(12) }]}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const label = options.tabBarLabel || route.name;
                    const isFocused = state.index === index;
                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            style={tabStyles.tabItem}
                            onPress={onPress}
                            activeOpacity={0.7}
                        >
                            <TabBarIcon name={route.name} focused={isFocused} />
                            <Text style={[tabStyles.tabLabel, isFocused && { color: Colors.primary }]}>
                                {label}
                            </Text>
                            {isFocused && <View style={tabStyles.activeDot} />}
                        </TouchableOpacity>
                    );
                })}
                {/* More button */}
                <TouchableOpacity
                    style={tabStyles.tabItem}
                    onPress={() => setMoreVisible(true)}
                    activeOpacity={0.7}
                >
                    <View style={tabStyles.iconWrap}>
                        <IonIcon name="ellipsis-horizontal" size={ms(22)} color={Colors.textTertiary} />
                    </View>
                    <Text style={tabStyles.tabLabel}>More</Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

const BottomTabNavigator = () => {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen
                name="FollowUp"
                component={FollowUpEngineScreen}
                options={{ tabBarLabel: 'Follow Up' }}
            />
            <Tab.Screen name="Leads" component={LeadsScreen} />
            <Tab.Screen name="Pipeline" component={PipelineScreen} />
            <Tab.Screen name="Tasks" component={TasksScreen} />
        </Tab.Navigator>
    );
};

const tabStyles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        paddingTop: ms(8),
        borderTopWidth: 0,
        ...Shadow.md,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        gap: ms(2),
    },
    tabLabel: {
        fontSize: ms(10),
        fontWeight: '600',
        color: Colors.textTertiary,
    },
    iconWrap: {
        width: ms(44),
        height: ms(36),
        borderRadius: ms(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconWrapActive: {
        backgroundColor: Colors.primaryBackground,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.primary,
        marginTop: 2,
    },
});

const moreStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        padding: ms(16),
        paddingTop: ms(12),
    },
    handle: {
        width: 36,
        height: 4,
        backgroundColor: Colors.divider,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: ms(12),
    },
    sheetTitle: {
        fontSize: ms(18),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: ms(16),
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ms(16),
    },
    gridItem: {
        alignItems: 'center',
        width: ms(80),
    },
    gridIcon: {
        width: ms(56),
        height: ms(56),
        borderRadius: ms(16),
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: ms(4),
    },
    gridLabel: {
        fontSize: ms(12),
        fontWeight: '600',
        color: Colors.textPrimary,
    },
});

export default BottomTabNavigator;
