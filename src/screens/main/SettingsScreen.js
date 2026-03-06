/**
 * Settings Screen
 * Main settings hub with navigation to sub-screens
 */

import React from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, ROUTES } from '../../constants';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText } from '../../components';
import { useAuth } from '../../context';

// Settings menu configuration
const ORGANIZATION_SETTINGS = [
    {
        id: 'companies',
        title: 'Companies',
        subtitle: 'Manage company profiles',
        icon: 'business',
        iconColor: '#3b82f6',
        route: ROUTES.COMPANY,
    },
    {
        id: 'contacts',
        title: 'Contacts',
        subtitle: 'Manage CRM contacts',
        icon: 'people',
        iconColor: '#10b981',
        route: ROUTES.CONTACTS,
    },
    {
        id: 'reports',
        title: 'Reports',
        subtitle: 'View detailed reports and analytics',
        icon: 'bar-chart',
        iconColor: '#f59e0b',
        route: ROUTES.REPORTS,
    },
    {
        id: 'followUpEngine',
        title: 'Follow Up Engine',
        subtitle: 'Configure follow-up automation',
        icon: 'time',
        iconColor: '#8b5cf6',
        route: ROUTES.FOLLOW_UP_ENGINE,
    },
];

// Settings Menu Item Component
const SettingsMenuItem = ({ item, onPress }) => (
    <TouchableOpacity
        style={styles.menuItem}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[styles.iconContainer, { backgroundColor: item.iconColor + '15' }]}>
            <Icon name={item.icon} size={ms(22)} color={item.iconColor} />
        </View>
        <View style={styles.menuItemContent}>
            <AppText size="base" weight="semiBold" color={Colors.textPrimary}>
                {item.title}
            </AppText>
            <AppText size="sm" color={Colors.textMuted}>
                {item.subtitle}
            </AppText>
        </View>
        <Icon name="chevron-forward" size={ms(22)} color={Colors.textMuted} />
    </TouchableOpacity>
);

// Section Header Component
const SectionHeader = ({ title }) => (
    <View style={styles.sectionHeader}>
        <AppText size="sm" weight="semiBold" color={Colors.textMuted} style={styles.sectionTitle}>
            {title}
        </AppText>
    </View>
);

const SettingsScreen = ({ navigation }) => {
    const { user } = useAuth();

    const handleMenuPress = (item) => {
        if (item.route) {
            navigation.navigate(item.route);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerContent}>
                {/* <AppText size="sm" color={Colors.textSecondary}>
                    Manage
                </AppText> */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-back" size={ms(24)} color={Colors.textPrimary} />
                </TouchableOpacity>
                <AppText size="xl" weight="bold">
                    Others
                </AppText>
            </View>
            {/* <TouchableOpacity
                style={styles.profileButton}
                onPress={() => navigation.navigate('Profile')}
            >
                <Icon name="account-circle" size={ms(24)} color={Colors.textPrimary} />
            </TouchableOpacity> */}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.headerContainer}>
                    {renderHeader()}
                </View>

                {/* Organization Section */}
                <SectionHeader title="ORGANIZATION" />
                <View style={styles.menuGroup}>
                    {ORGANIZATION_SETTINGS.map((item) => (
                        <SettingsMenuItem
                            key={item.id}
                            item={item}
                            onPress={() => handleMenuPress(item)}
                        />
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: vs(100),
    },
    headerContainer: {
        paddingHorizontal: wp(4),

    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: vs(16),
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    backButton: {
        width: ms(44),
        height: ms(44),
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.sm,
    },
    profileButton: {
        width: ms(44),
        height: ms(44),
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.sm,
    },
    sectionHeader: {
        paddingHorizontal: wp(4),
        paddingTop: vs(20),
        paddingBottom: vs(8),
    },
    sectionTitle: {
        letterSpacing: 0.5,
    },
    menuGroup: {
        marginHorizontal: wp(4),
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.card,
        ...Shadow.sm,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    iconContainer: {
        width: ms(44),
        height: ms(44),
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    menuItemContent: {
        flex: 1,
    },
});

export default SettingsScreen;
