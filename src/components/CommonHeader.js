import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native'
import React from 'react'
import { Colors } from '../constants/Colors'
import { ms, vs, wp } from '../utils/Responsive'
import IonIcon from 'react-native-vector-icons/Ionicons'
import { ROUTES } from '../constants'
import { Spacing, Shadow } from '../constants/Spacing'
import { useAuth, useNotification } from '../context';

const CommonHeader = ({ navigation, title }) => {
    const { user } = useAuth();
    const { unreadCount } = useNotification();

    return (
        <View style={styles.header}>
            <View style={styles.userInfo}>
                {navigation?.openDrawer && (
                    <TouchableOpacity
                        onPress={() => navigation.openDrawer()}
                        style={styles.menuBtn}
                    >
                        <IonIcon name="menu-outline" size={ms(28)} color={Colors.textPrimary} />
                    </TouchableOpacity>
                )}
                <View>
                    {title ? (
                        <Text style={styles.userName}>{title}</Text>
                    ) : (
                        <>
                            <Text style={styles.welcomeText}>Welcome back,</Text>
                            <Text style={styles.userName}>{user?.name || 'User'}</Text>
                        </>
                    )}
                </View>
            </View>
            <View style={styles.headerActions}>
                <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: Colors.primaryBackground }]}
                    onPress={() => navigation.navigate(ROUTES.AI_ASSISTANT)}
                >
                    <IonIcon name="sparkles" size={ms(20)} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
                >
                    <IonIcon name="notifications-outline" size={ms(22)} color={Colors.textPrimary} />
                    {unreadCount && unreadCount > 0 ? (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.profileBtn}
                    onPress={() => navigation.navigate('Profile')}
                >
                    {user?.photo || user?.profilePhoto || user?.avatar ? (
                        <Image
                            source={{ uri: user.photo || user.profilePhoto || user.avatar }}
                            style={styles.profileImage}
                        />
                    ) : (
                        <IonIcon name="person-outline" size={ms(22)} color={Colors.textPrimary} />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default CommonHeader

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    menuBtn: {
        marginRight: Spacing.xs,
        padding: Spacing.xs,
    },
    welcomeText: {
        fontSize: ms(13),
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    userName: {
        fontSize: ms(20), // Slightly smaller to accommodate the menu icon
        fontWeight: '800',
        color: Colors.textPrimary,
        letterSpacing: -0.5,
    },
    headerActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    iconBtn: {
        width: ms(44),
        height: ms(44),
        borderRadius: ms(22),
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.sm,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: Colors.danger,
        borderRadius: 10,
        minWidth: ms(18),
        height: ms(18),
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: ms(10),
        fontWeight: '700',
    },
    profileBtn: {
        width: ms(44),
        height: ms(44),
        borderRadius: ms(22),
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.sm,
        overflow: 'hidden',
    },
    profileImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
})