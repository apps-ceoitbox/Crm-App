import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    LayoutAnimation,
    UIManager,
    Platform,
    StatusBar,
    Image,
} from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius } from '../../constants/Spacing';
import { ms } from '../../utils/Responsive';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context';
import LogoutConfirmationModal from '../LogoutConfirmationModal';

if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const getInitials = (name = '') => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─── Data ────────────────────────────────────────────────────────────────────

const TOP_MODULES = [
    {
        key: 'sales',
        label: 'Sales',
        subtitle: 'Leads, Pipelines & Deals',
        icon: 'stats-chart-outline',
        activeIcon: 'stats-chart',
        route: ROUTES.SALES_MODULE,
        children: null,
    },
    {
        key: 'marketing',
        label: 'Marketing',
        subtitle: 'Campaigns & Contacts',
        icon: 'megaphone-outline',
        activeIcon: 'megaphone',
        route: ROUTES.MARKETING_MODULE,
        children: [
            {
                key: 'scan',
                label: 'Scan',
                icon: 'scan-outline',
                route: ROUTES.MARKETING_MODULE,
                screen: ROUTES.SCAN_ADD_CONTACT,
            },
            // {
            //     key: 'addSingle',
            //     label: 'Add Single',
            //     icon: 'person-add-outline',
            //     route: ROUTES.MARKETING_MODULE,
            //     screen: ROUTES.ADD_SINGLE_CONTACT,
            // },
        ],
    },
];

const PREF_ITEMS = [
    { label: 'Account Settings', icon: 'settings-outline', route: ROUTES.PROFILE },
    { label: 'Notifications', icon: 'notifications-outline', route: ROUTES.NOTIFICATIONS },
    // { label: 'Help & Support', icon: 'help-circle-outline', route: null },
];

// ─── Component ───────────────────────────────────────────────────────────────

const CustomDrawerContent = (props) => {
    const { user, systemConfig } = useAuth();
    const { navigation, state } = props;

    const currentRouteName = state.routeNames[state.index];
    const [expandedKey, setExpandedKey] = useState(null); // Start with all collapsed
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const { logout } = useAuth();

    const initials = getInitials(user?.name);
    const joinDate = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : null;

    const toggleExpand = (key) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedKey(prev => (prev === key ? null : key));
    };

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            const success = await logout();
            if (success) {
                setShowLogoutModal(false);
                // Manually reset navigation to Login to ensure proper redirection
                navigation.reset({
                    index: 0,
                    routes: [{ name: ROUTES.LOGIN }],
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <SafeAreaView style={styles.root}>

            {/* ── Profile Card ─────────────────────────────────── */}
            <View style={styles.profileCard}>
                <View style={styles.initialsCircle}>
                    {user?.photo || user?.profilePhoto || user?.avatar ? (
                        <Image
                            source={{ uri: user.photo || user.profilePhoto || user.avatar }}
                            style={styles.avatarImage}
                        />
                    ) : (
                        <Text style={styles.initialsText}>{initials}</Text>
                    )}
                </View>

                <View style={styles.profileMeta}>
                    <Text style={styles.profileName} numberOfLines={1}>
                        {user?.name || 'Ishan Yadav'}
                    </Text>
                    <Text style={styles.profileEmail} numberOfLines={1}>
                        {user?.email || 'ishanyadav13290@gmail.com'}
                    </Text>

                    <View style={styles.statusRow}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>Online</Text>
                    </View>
                </View>
            </View>

            {/* ── Navigation ───────────────────────────────────── */}
            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Modules Card */}
                <Text style={styles.sectionLabel}>MODULES</Text>
                <View style={styles.cardContainer}>
                    {TOP_MODULES.map((mod, index) => {
                        // Check if the module should be visible based on system configuration
                        if (mod.key === 'marketing' && systemConfig?.modules?.cardScan !== true) {
                            return null;
                        }
                        const isActive = currentRouteName === mod.route;
                        const isExpanded = expandedKey === mod.key;
                        const hasChildren = !!mod.children?.length;

                        return (
                            <View key={mod.key}>
                                {/* Parent row */}
                                <TouchableOpacity
                                    style={[
                                        styles.navRow,
                                        isActive && styles.navRowActive,
                                        index < TOP_MODULES.length - 1 && !isExpanded && styles.borderBottom
                                    ]}
                                    onPress={() => {
                                        if (hasChildren) {
                                            toggleExpand(mod.key);
                                        } else {
                                            navigation.navigate(mod.route);
                                        }
                                    }}
                                    activeOpacity={0.75}
                                >
                                    {/* Icon */}
                                    <View style={[
                                        styles.navIcon,
                                        isActive && styles.navIconActive,
                                    ]}>
                                        <IonIcon
                                            name={isActive ? mod.activeIcon : mod.icon}
                                            size={ms(20)}
                                            color={isActive ? Colors.primary : Colors.textSecondary}
                                        />
                                    </View>

                                    {/* Text */}
                                    <View style={styles.navText}>
                                        <Text style={[
                                            styles.navLabel,
                                            isActive && styles.navLabelActive,
                                        ]}>
                                            {mod.label}
                                        </Text>
                                        <Text style={styles.navSub}>{mod.subtitle}</Text>
                                    </View>

                                    {/* Chevron for expandable */}
                                    {hasChildren ? (
                                        <IonIcon
                                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={ms(16)}
                                            color={Colors.textTertiary}
                                            style={styles.chevron}
                                        />
                                    ) : (
                                        <IonIcon
                                            name="chevron-forward"
                                            size={ms(16)}
                                            color={Colors.textTertiary}
                                            style={styles.chevron}
                                        />
                                    )}
                                </TouchableOpacity>

                                {/* Children (collapsible) */}
                                {hasChildren && isExpanded && (
                                    <View style={styles.childrenWrap}>
                                        {mod.children.map((child, cIdx) => {
                                            const isChildActive = currentRouteName === child.route && state.index > 0;
                                            return (
                                                <TouchableOpacity
                                                    key={child.key}
                                                    style={[
                                                        styles.childRow,
                                                        cIdx < mod.children.length - 1 && styles.childBorder
                                                    ]}
                                                    onPress={() => {
                                                        if (child.screen) {
                                                            // If nested screen (like Scan), navigate to Main Module then screen
                                                            navigation.navigate(child.route, { screen: child.screen });
                                                        } else if (child.route) {
                                                            navigation.navigate(child.route);
                                                        }
                                                    }}
                                                    activeOpacity={0.75}
                                                >
                                                    <View style={styles.childIconWrap}>
                                                        <IonIcon
                                                            name={child.icon}
                                                            size={ms(18)}
                                                            color={Colors.textSecondary}
                                                        />
                                                    </View>
                                                    <Text style={styles.childLabel}>
                                                        {child.label}
                                                    </Text>
                                                    <IonIcon
                                                        name="chevron-forward"
                                                        size={ms(14)}
                                                        color={Colors.textTertiary}
                                                    />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Preferences */}
                <View style={styles.sectionDivider} />
                {/* Preferences Card */}
                <Text style={styles.sectionLabel}>PREFERENCES</Text>
                <View style={styles.cardContainer}>
                    {PREF_ITEMS.map((item, index) => (
                        <TouchableOpacity
                            key={item.label}
                            style={[
                                styles.prefRow,
                                index < PREF_ITEMS.length - 1 && styles.borderBottom
                            ]}
                            onPress={() => item.route && navigation.navigate(item.route)}
                            activeOpacity={0.75}
                        >
                            <View style={styles.prefIcon}>
                                <IonIcon name={item.icon} size={ms(19)} color={Colors.textSecondary} />
                            </View>
                            <Text style={styles.prefLabel}>{item.label}</Text>
                            <IonIcon name="chevron-forward" size={ms(15)} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* ── Footer ───────────────────────────────────────── */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.logoutRow}
                    activeOpacity={0.8}
                    onPress={() => setShowLogoutModal(true)}
                >
                    <View style={styles.logoutIcon}>
                        <IonIcon name="log-out-outline" size={ms(18)} color={Colors.error} />
                    </View>
                    <Text style={styles.logoutLabel}>Log Out</Text>
                </TouchableOpacity>
                <Text style={styles.versionLabel}>v1.2.4</Text>
            </View>

            <LogoutConfirmationModal
                visible={showLogoutModal}
                onCancel={() => setShowLogoutModal(false)}
                onConfirm={handleLogout}
                loading={isLoggingOut}
            />

        </SafeAreaView>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

    root: {
        flex: 1,
        backgroundColor: '#FCFCFC', // Very light gray for that clean look
    },

    /* Profile Card */
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(20),
        paddingTop: Platform.OS === 'ios' ? ms(10) : (StatusBar.currentHeight || ms(20)) + ms(10),
        paddingBottom: ms(25),
        gap: ms(16),
    },
    initialsCircle: {
        width: ms(60),
        height: ms(60),
        borderRadius: ms(30),
        backgroundColor: Colors.primaryBackground,
        borderWidth: 2,
        borderColor: Colors.primaryBorder,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    initialsText: {
        fontSize: ms(22),
        fontWeight: '700',
        color: Colors.primary,
    },
    profileMeta: {
        flex: 1,
    },
    profileName: {
        fontSize: ms(19),
        fontWeight: 'bold',
        color: '#111827',
        letterSpacing: -0.5,
    },
    profileEmail: {
        fontSize: ms(13),
        color: '#6B7280',
        marginTop: ms(1),
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: ms(6),
    },
    statusDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
        backgroundColor: '#10B981', // Solid online green
        marginRight: ms(6),
    },
    statusText: {
        fontSize: ms(12),
        fontWeight: '600',
        color: '#10B981',
    },

    /* Scroll */
    scrollArea: { flex: 1 },
    scrollContent: {
        paddingBottom: ms(30),
    },

    /* Section label */
    sectionLabel: {
        fontSize: ms(11),
        fontWeight: '700',
        color: '#9CA3AF',
        letterSpacing: 1.2,
        marginLeft: ms(20),
        marginBottom: ms(10),
        textTransform: 'uppercase',
    },

    /* Card Container */
    cardContainer: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: ms(12),
        borderRadius: ms(20),
        borderWidth: 1,
        borderColor: '#F3F4F6',
        overflow: 'hidden',
        marginBottom: ms(24),
        // Subtle shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },

    /* Nav Row */
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(14),
        paddingHorizontal: ms(16),
    },
    navRowActive: {
        backgroundColor: '#F0F9EE', // Light green background for active module
    },
    borderBottom: {
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },

    /* Icon box */
    navIcon: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(12),
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: ms(14),
    },
    navIconActive: {
        backgroundColor: 'transparent',
    },

    /* Text */
    navText: { flex: 1 },
    navLabel: {
        fontSize: ms(16),
        fontWeight: '700',
        color: '#1F2937',
    },
    navLabelActive: {
        color: '#4D8733',
    },
    navSub: {
        fontSize: ms(12),
        color: '#6B7280',
        marginTop: ms(1),
    },

    /* Chevron */
    chevron: {
        marginLeft: ms(8),
    },

    /* Children */
    childrenWrap: {
        backgroundColor: '#F9FAFB', // Background for the nested child items
        // marginRight: ms(12),
        marginLeft: ms(20),
        marginBottom: ms(12),
        // borderRadius: ms(16),
        // borderTopLeftRadius: ms(16),
        borderBottomLeftRadius: ms(16),
        borderWidth: 1,
        borderColor: '#F3F4F6',
        paddingHorizontal: ms(4),
    },
    childRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(12),
        paddingHorizontal: ms(12),
        gap: ms(12),
    },
    childBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    childIconWrap: {
        width: ms(32),
        height: ms(32),
        borderRadius: ms(8),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    childLabel: {
        fontSize: ms(15),
        fontWeight: '600',
        color: '#374151',
        flex: 1,
    },

    /* Preferences */
    prefRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(14),
        paddingHorizontal: ms(16),
        gap: ms(14),
    },
    prefIcon: {
        width: ms(36),
        height: ms(36),
        borderRadius: ms(10),
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    prefLabel: {
        flex: 1,
        fontSize: ms(15),
        fontWeight: '600',
        color: '#374151',
    },

    /* Footer */
    footer: {
        paddingHorizontal: ms(20),
        paddingBottom: Platform.OS === 'ios' ? ms(30) : ms(20),
        paddingTop: ms(15),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    logoutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(10),
    },
    logoutIcon: {
        width: ms(34),
        height: ms(34),
        borderRadius: ms(10),
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoutLabel: {
        fontSize: ms(15),
        fontWeight: '700',
        color: '#EF4444',
    },
    versionLabel: {
        fontSize: ms(12),
        color: '#9CA3AF',
        fontWeight: '500',
    },
});

export default CustomDrawerContent;
