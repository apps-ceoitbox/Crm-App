/**
 * Google Sign-In Service with Firebase Authentication
 * Handles Google authentication and Firebase sign-in
 */

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';

// Configure Google Sign-In
const WEB_CLIENT_ID =
  '1018992744135-j0325d9nktbuoojik1kcqsvbjpru3bdc.apps.googleusercontent.com';
const IOS_WEB_CLIENT_ID =
  '653515773356-1b9d920j7q819mrngdi0gspc508ltcfs.apps.googleusercontent.com';

/**
 * Initialize Google Sign-In configuration
 */
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_WEB_CLIENT_ID,
    offlineAccess: true,
  });
};

/**
 * Sign in with Google and Firebase
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const signInWithGoogle = async () => {
  try {
    // Check if Google Play Services are available
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Force sign out to ensure account selection popup appears every time
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore if not signed in or other non-critical errors
    }

    // 1. Get the users ID token from Google
    const signInResult = await GoogleSignin.signIn();
    console.log('Google Sign-In Result:', signInResult);

    // Extract idToken based on the response structure
    const idToken = signInResult.data?.idToken || signInResult.idToken;

    if (!idToken) {
      throw new Error('No ID Token found from Google Sign-In');
    }

    // 2. Create a Google credential with the token
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);

    // 3. Sign-in to Firebase with the credential
    const firebaseUserCredential = await auth().signInWithCredential(googleCredential);
    const firebaseUser = firebaseUserCredential.user;

    // console.log('Firebase Sign-In Success:', firebaseUser.uid);

    return {
      success: true,
      data: {
        user: {
          id: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          photo: firebaseUser.photoURL,
        },
        idToken: idToken,
        firebaseUser: firebaseUser, // Full firebase user object
      },
    };
  } catch (error) {
    console.error('Google/Firebase Sign-In Error:', error);

    let errorMessage = 'An error occurred during authentication';

    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      errorMessage = 'Sign-in was cancelled';
    } else if (error.code === statusCodes.IN_PROGRESS) {
      errorMessage = 'Sign-in is already in progress';
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      errorMessage = 'Google Play Services is not available';
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      errorMessage = 'Account already exists with a different credential';
    } else if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid credentials provided';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Sign out from Google and Firebase
 */
export const signOutFromGoogle = async () => {
  try {
    // 1. Sign out from Firebase if a session exists
    if (auth().currentUser) {
      await auth().signOut();
      console.log('Firebase Sign-Out Success');
    }

    // 2. Sign out from Google if configured/signed in
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
        console.log('Google Sign-Out Success');
      }
    } catch (googleError) {
      // Ignore errors from Google sign-out as it's secondary
      console.log('Google Sign-Out non-critical error:', googleError.message);
    }

    return true;
  } catch (error) {
    // Only log actual unexpected errors
    if (error.code !== 'auth/no-current-user') {
      console.error('Sign-Out Error:', error);
    }
    return false;
  }
};

/**
 * Check current auth state
 */
export const getCurrentAuthUser = () => {
  return auth().currentUser;
};

export default {
  configureGoogleSignIn,
  signInWithGoogle,
  signOutFromGoogle,
  getCurrentAuthUser,
};
