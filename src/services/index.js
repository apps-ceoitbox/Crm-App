/**
 * Services Index
 * Export all service modules
 */

export {
    configureGoogleSignIn,
    signInWithGoogle,
    signOutFromGoogle,
    getCurrentAuthUser,
} from './googleSignIn';

// FCM Service
export {
    requestNotificationPermission,
    hasNotificationPermission,
    getFCMToken,
    getStoredFCMToken,
    deleteFCMToken,
    getDeviceId,
    subscribeToTopic,
    unsubscribeFromTopic,
    setupForegroundHandler,
    setupNotificationOpenedHandler,
    getInitialNotification,
    setBackgroundMessageHandler,
    setupTokenRefreshHandler,
    parseNotificationData,
    initializeFCM,
} from './fcm';

export { default as fcmService } from './fcm';
