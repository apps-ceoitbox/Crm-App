/**
 * Google Sign-In Service
 * Handles Google authentication for Login and Registration
 */

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { Platform } from 'react-native';

// Configure Google Sign-In
// Use different Web Client IDs per platform (iOS vs others)
const WEB_CLIENT_ID =
  '653515773356-93ghkljsjhilqqra6op0864dokct678m.apps.googleusercontent.com';
const IOS_WEB_CLIENT_ID =
  '653515773356-1b9d920j7q819mrngdi0gspc508ltcfs.apps.googleusercontent.com';

/**
 * Initialize Google Sign-In configuration
 * Call this once when the app starts (e.g., in App.tsx or main entry)
 */
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_WEB_CLIENT_ID, // Optional, only for iOS
    offlineAccess: true, // If you want to access Google API on behalf of the user from your server
    forceCodeForRefreshToken: true, // [Android] related to `serverAuthCode`
    scopes: ['email', 'profile'], // Request email and profile scopes
  });
};

/**
 * Sign in with Google
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const signInWithGoogle = async () => {
  try {
    // Check if Google Play Services are available (Android only)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Perform the sign-in
    const response = await GoogleSignin.signIn();
    console.log('Google Sign-In Response:', response);

    if (response.type === 'success') {
      const { data } = response;
      const userInfo = data?.user;

      return {
        success: true,
        data: {
          user: {
            id: userInfo?.id,
            name: userInfo?.name,
            email: userInfo?.email,
            photo: userInfo?.photo,
            givenName: userInfo?.givenName,
            familyName: userInfo?.familyName,
          },
          idToken: data?.idToken,
          serverAuthCode: data?.serverAuthCode,
        },
      };
    } else {
      return {
        success: false,
        error: 'Google Sign-In was cancelled',
      };
    }
  } catch (error) {
    console.error('Google Sign-In Error:', error);

    let errorMessage = 'An error occurred during Google Sign-In';

    // Handle specific error codes
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      errorMessage = 'Sign-in was cancelled';
    } else if (error.code === statusCodes.IN_PROGRESS) {
      errorMessage = 'Sign-in is already in progress';
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      errorMessage = 'Google Play Services is not available';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Sign out from Google
 * @returns {Promise<boolean>}
 */
export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
    return true;
  } catch (error) {
    console.error('Google Sign-Out Error:', error);
    return false;
  }
};

/**
 * Check if user is currently signed in with Google
 * @returns {Promise<object|null>}
 */
export const getCurrentGoogleUser = async () => {
  try {
    const userInfo = await GoogleSignin.getCurrentUser();
    return userInfo;
  } catch (error) {
    console.error('Get Current Google User Error:', error);
    return null;
  }
};

/**
 * Revoke Google access (optional - for complete sign out)
 * @returns {Promise<boolean>}
 */
export const revokeGoogleAccess = async () => {
  try {
    await GoogleSignin.revokeAccess();
    return true;
  } catch (error) {
    console.error('Revoke Google Access Error:', error);
    return false;
  }
};

export default {
  configureGoogleSignIn,
  signInWithGoogle,
  signOutFromGoogle,
  getCurrentGoogleUser,
  revokeGoogleAccess,
};
