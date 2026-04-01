/**
 * NotificationContext - Push Notification State Management
 * Provides FCM token management and notification handling throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import {
    initializeFCM,
    getFCMToken,
    getDeviceId,
    deleteFCMToken,
    parseNotificationData,
} from '../services/fcm';
import { deviceTokensAPI, notificationsAPI } from '../api';
import { useAuth } from './AuthContext';

// Create the context
const NotificationContext = createContext(null);

/**
 * NotificationProvider Component
 * Wraps the app and provides notification context
 */
export const NotificationProvider = ({ children }) => {
    const { isAuthenticated, token: authToken, user } = useAuth();

    // State
    const [fcmToken, setFcmToken] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(true);
    const [lastNotification, setLastNotification] = useState(null);
    const [notificationCount, setNotificationCount] = useState(0);
    /** Live list of notifications (from API + FCM foreground). Used for in-app list and badge. */
    const [notifications, setNotifications] = useState([]);
    const [notificationsLoading, setNotificationsLoading] = useState(false);

    // Refs
    const unsubscribeRef = useRef(null);
    const appStateRef = useRef(AppState.currentState);
    const registrationAttemptedRef = useRef(false);

    /**
     * Register device token with backend
     */
    const registerDeviceToken = useCallback(async (token, devId) => {
        if (!authToken || !token || !devId) {
            return false;
        }

        try {
            const response = await deviceTokensAPI.register({
                token,
                deviceId: devId,
                platform: Platform.OS,
                deviceName: `${Platform.OS} ${Platform.Version}`,
            });

            if (response.success) {
                console.log('[Notification] Device token registered successfully');
                return true;
            } else {
                console.error('[Notification] Failed to register device token:', response.error);
                return false;
            }
        } catch (error) {
            console.error('[Notification] Error registering device token:', error);
            return false;
        }
    }, [authToken]);

    /**
     * Remove device token from backend
     */
    const removeDeviceToken = useCallback(async () => {
        if (!authToken || !deviceId) {
            return false;
        }

        try {
            const response = await deviceTokensAPI.remove(deviceId);
            if (response.success) {
                console.log('[Notification] Device token removed successfully');
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Notification] Error removing device token:', error);
            return false;
        }
    }, [authToken, deviceId]);

    /**
     * Handle foreground notification
     */
    const handleForegroundNotification = useCallback((remoteMessage) => {
        const notification = parseNotificationData(remoteMessage);

        if (notification) {
            setLastNotification(notification);
            setNotificationCount(prev => prev + 1);

            // Add to live list for in-app dropdown (avoid duplicate by notificationId)
            const id = notification.notificationId || `fcm_${Date.now()}`;
            setNotifications(prev => {
                if (prev.some(n => n._id === id)) return prev;
                return [{
                    _id: id,
                    title: notification.title,
                    description: notification.body,
                    type: notification.type || 'announcement',
                    createdAt: new Date().toISOString(),
                    read: false,
                    entityId: notification.entityId,
                    priority: notification.priority,
                    imageUrl: notification.imageUrl,
                }, ...prev];
            });

            // Show toast notification
            Toast.show({
                type: notification.priority === 'urgent' ? 'error' :
                    notification.priority === 'high' ? 'info' : 'success',
                text1: notification.title,
                text2: notification.body,
                visibilityTime: 5000,
                onPress: () => {
                    handleNotificationPress(notification);
                },
            });
        }
    }, []);

    /**
     * Handle notification opened (from background/quit state)
     */
    const handleNotificationOpened = useCallback((remoteMessage) => {
        const notification = parseNotificationData(remoteMessage);

        if (notification) {
            setLastNotification(notification);
            handleNotificationPress(notification);
        }
    }, []);

    /**
     * Handle notification press/tap
     */
    const handleNotificationPress = useCallback((notification) => {
        // console.log('[Notification] Pressed:', notification);

        // You can add navigation logic here based on notification type
        // For example:
        // if (notification.type === 'lead' && notification.entityId) {
        //     navigation.navigate('LeadDetails', { id: notification.entityId });
        // }
    }, []);

    /**
     * Handle token refresh
     */
    const handleTokenRefresh = useCallback(async (newToken) => {
        console.log('[Notification] Token refreshed');
        setFcmToken(newToken);

        // Re-register with new token
        if (deviceId && authToken) {
            await registerDeviceToken(newToken, deviceId);
        }
    }, [deviceId, authToken, registerDeviceToken]);

    /**
     * Initialize FCM
     */
    const initializeNotifications = useCallback(async () => {
        if (isInitialized || !isAuthenticated) {
            return;
        }

        try {
            const result = await initializeFCM({
                onForegroundNotification: handleForegroundNotification,
                onNotificationOpened: handleNotificationOpened,
                onTokenRefresh: handleTokenRefresh,
            });

            if (result.success) {
                setFcmToken(result.token);
                setDeviceId(result.deviceId);
                setIsInitialized(true);

                // Store unsubscribe function
                unsubscribeRef.current = result.unsubscribe;

                // Register with backend
                if (result.token && result.deviceId && authToken && !registrationAttemptedRef.current) {
                    registrationAttemptedRef.current = true;
                    await registerDeviceToken(result.token, result.deviceId);
                }

                console.log('[Notification] FCM initialized successfully');
            } else {
                console.warn('[Notification] FCM initialization failed:', result.error);
            }
        } catch (error) {
            console.error('[Notification] Error initializing notifications:', error);
        }
    }, [
        isInitialized,
        isAuthenticated,
        authToken,
        handleForegroundNotification,
        handleNotificationOpened,
        handleTokenRefresh,
        registerDeviceToken,
    ]);

    /**
     * Toggle push notifications
     */
    const togglePushNotifications = useCallback(async (enabled) => {
        if (!authToken) {
            return false;
        }

        try {
            const response = await deviceTokensAPI.toggleNotifications(enabled);
            if (response.success) {
                setPushEnabled(enabled);
                console.log(`[Notification] Push notifications ${enabled ? 'enabled' : 'disabled'}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Notification] Error toggling push notifications:', error);
            return false;
        }
    }, [authToken]);

    /**
     * Cleanup on logout
     */
    const cleanupNotifications = useCallback(async () => {
        try {
            // Remove device token from backend
            await removeDeviceToken();

            // Delete FCM token
            await deleteFCMToken();

            // Cleanup handlers
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }

            // Reset state
            setFcmToken(null);
            setIsInitialized(false);
            setNotifications([]);
            setNotificationCount(0);
            registrationAttemptedRef.current = false;

            console.log('[Notification] Cleanup completed');
        } catch (error) {
            console.error('[Notification] Error during cleanup:', error);
        }
    }, [removeDeviceToken]);

    /**
     * Clear notification count
     */
    const clearNotificationCount = useCallback(() => {
        setNotificationCount(0);
    }, []);

    /**
     * Fetch notifications from API (for in-app list and badge)
     */
    const fetchNotifications = useCallback(async () => {
        if (!authToken) return;
        setNotificationsLoading(true);
        try {
            const response = await notificationsAPI.getMy({ limit: 50 });
            // console.log('response : ', response);
            if (response.success && response.data) {
                const list = response.data.notifications || [];
                const unread = response.data.unreadCount ?? list.filter(n => !n.read).length;
                setNotifications(list);
                setNotificationCount(unread);
            }
        } catch (e) {
            console.error('[Notification] fetchNotifications error:', e);
        } finally {
            setNotificationsLoading(false);
        }
    }, [authToken]);

    /**
     * Mark one notification as read
     */
    const markNotificationAsRead = useCallback(async (id) => {
        try {
            const res = await notificationsAPI.markAsRead(id);
            if (res.success) {
                setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
                setNotificationCount(prev => Math.max(0, prev - 1));
            }
        } catch (e) {
            console.error('[Notification] markAsRead error:', e);
        }
    }, []);

    /**
     * Mark all notifications as read
     */
    const markAllNotificationsAsRead = useCallback(async () => {
        try {
            // console.log('mark called');
            const res = await notificationsAPI.markAllAsRead();
            // console.log('res : ', res);
            if (res.success) {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                setNotificationCount(0);
            }
        } catch (e) {
            console.error('[Notification] markAllAsRead error:', e);
        }
    }, []);

    /**
     * Refresh FCM token manually
     */
    const refreshToken = useCallback(async () => {
        try {
            const token = await getFCMToken();
            if (token && token !== fcmToken) {
                setFcmToken(token);
                await registerDeviceToken(token, deviceId);
            }
            return token;
        } catch (error) {
            console.error('[Notification] Error refreshing token:', error);
            return null;
        }
    }, [fcmToken, deviceId, registerDeviceToken]);

    // Initialize notifications when authenticated
    useEffect(() => {
        if (isAuthenticated && authToken) {
            initializeNotifications();
            fetchNotifications();
        }
    }, [isAuthenticated, authToken, initializeNotifications, fetchNotifications]);

    // Handle app state changes
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                refreshToken();
                fetchNotifications();
            }
            appStateRef.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [refreshToken, fetchNotifications]);

    // Cleanup on unmount or logout
    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    const value = {
        // State
        fcmToken,
        deviceId,
        isInitialized,
        pushEnabled,
        lastNotification,
        notificationCount,
        notifications,
        notificationsLoading,
        unreadCount: notificationCount,
        // Methods
        initializeNotifications,
        registerDeviceToken,
        removeDeviceToken,
        togglePushNotifications,
        cleanupNotifications,
        clearNotificationCount,
        refreshToken,
        handleNotificationPress,
        fetchNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

/**
 * useNotification Hook
 * Access notification context from any component
 */
export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export default NotificationContext;
