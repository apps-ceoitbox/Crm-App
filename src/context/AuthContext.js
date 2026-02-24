/**
 * AuthContext - Global Authentication State Management
 * Provides authentication state and methods throughout the app
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  use,
} from 'react';
import {
  getToken,
  setToken as saveToken,
  getUserData,
  setUserData as saveUserData,
  clearAuthData,
  getRememberMe,
  setRememberMe as saveRememberMe,
  removeRememberMe,
} from '../storage';
import { authAPI, getErrorMessage } from '../api';
import { showSuccess } from '../utils';
import { signInWithGoogle, signOutFromGoogle } from '../services';
import { SystemConfigAPI } from '../api/services';
import { set } from '@react-native-firebase/app/dist/module/internal/web/firebaseDatabase';
import appleAuth from '@invertase/react-native-apple-authentication';

// Create the context
const AuthContext = createContext(null);

// Dummy user for demo/fallback purposes
const DEMO_USER = {
  email: 'demo@crm.com',
  password: 'demo123',
  userData: {
    id: '1',
    name: 'John Doe',
    email: 'demo@crm.com',
    phone: '+1 234 567 8900',
    role: 'Admin',
    avatar: null,
  },
};

/**
 * AuthProvider Component
 * Wraps the app and provides authentication context
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState(null);
  const [isAppleReviewMode, setIsAppleReviewMode] = useState(false);

  // Initialize auth state on app load
  useEffect(() => {
    initializeAuth();
    getSystemConfig(); // Fetch system config on app start
  }, []);

  const initializeAuth = async () => {
    setIsLoading(true);
    try {
      const [storedToken, storedUser, storedEmail] = await Promise.all([
        getToken(),
        getUserData(),
        getRememberMe(),
      ]);

      if (storedToken && storedUser) {
        setTokenState(storedToken);
        setUser(storedUser);
        setIsAuthenticated(true);
      }

      if (storedEmail) {
        setRememberedEmail(storedEmail);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSystemConfig = async () => {
    try {
      const response = await SystemConfigAPI.getSysConfig();
      if (response.success) {
        // The API may return the config either directly in `data` or nested under `data.config`.
        const cfg = response?.data?.config ?? response?.data;
        if (cfg && typeof cfg.isAppleReviewMode !== 'undefined') {
          setIsAppleReviewMode(Boolean(cfg.isAppleReviewMode));
        }
        // You can save system config to context or state if needed
        console.log('System Config:', cfg);
      }
    } catch (error) {
      console.error('Error fetching system config:', error);
    }
  };

  /**
   * Login with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {boolean} rememberMe - Remember email for next login
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const login = useCallback(async (email, password, rememberMe = false) => {
    console.log('Attempting login with email:', email, password, rememberMe);
    try {
      // Call the actual API
      const response = await authAPI.login(email, password);

      console.log(120, response);

      if (response.success) {
        const { data } = response;
        const newToken = data.token || data.access_token;
        const userData = data.user ||
          data.data || {
            id: data._id,
            name: data.name,
            email: data.email || email,
            role: data.role,
            organization: data.organization,
          };

        // Save to storage
        await saveToken(newToken);
        await saveUserData(userData);

        if (isAppleReviewMode && Platform.OS === 'ios') {
          showSuccess('', 'You have logged in successfully');
        } else {
          showSuccess('Welcome back!', 'You have logged in successfully');
        }

        if (rememberMe) {
          await saveRememberMe(email);
          setRememberedEmail(email);
        } else {
          await removeRememberMe();
          setRememberedEmail(null);
        }

        // Update state
        setTokenState(newToken);
        setUser(userData);
        setIsAuthenticated(true);

        return { success: true };
      } else {
        // API call failed - check for demo credentials as fallback
        if (
          email.toLowerCase() === DEMO_USER.email &&
          password === DEMO_USER.password
        ) {
          const newToken = 'demo-token-' + Date.now();

          await saveToken(newToken);
          await saveUserData(DEMO_USER.userData);

          if (rememberMe) {
            await saveRememberMe(email);
            setRememberedEmail(email);
          } else {
            await removeRememberMe();
            setRememberedEmail(null);
          }

          setTokenState(newToken);
          setUser(DEMO_USER.userData);
          setIsAuthenticated(true);

          return { success: true };
        }

        return {
          success: false,
          error: response.error || 'Invalid email or password',
        };
      }
    } catch (error) {
      console.error('Login error:', error);

      // Fallback to demo login if network error
      if (
        email.toLowerCase() === DEMO_USER.email &&
        password === DEMO_USER.password
      ) {
        const newToken = 'demo-token-' + Date.now();

        await saveToken(newToken);
        await saveUserData(DEMO_USER.userData);

        setTokenState(newToken);
        setUser(DEMO_USER.userData);
        setIsAuthenticated(true);

        return { success: true };
      }

      return {
        success: false,
        error: getErrorMessage(error) || 'An error occurred during login',
      };
    }
  }, []);

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const register = useCallback(async userData => {
    try {
      // Prepare registration data
      const registerData = {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        password_confirmation: userData.confirmPassword || userData.password,
        organization: userData.organization,
      };

      // Call the actual API
      const response = await authAPI.register(registerData);

      if (response.success) {
        const { data } = response;
        const newToken = data.token || data.access_token;
        const newUser = data.user ||
          data.data || {
            id: data.id || Date.now().toString(),
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            role: 'User',
            avatar: null,
          };

        // Save to storage
        await saveToken(newToken);
        await saveUserData(newUser);

        // Update state
        setTokenState(newToken);
        setUser(newUser);
        setIsAuthenticated(true);

        return { success: true };
      } else {
        return {
          success: false,
          error: response.error || 'Registration failed',
        };
      }
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        error:
          getErrorMessage(error) || 'An error occurred during registration',
      };
    }
  }, []);

  /**
   * Login with Google
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const googleLogin = useCallback(async () => {
    try {
      // Perform Google Sign-In
      const googleResult = await signInWithGoogle();

      if (!googleResult.success) {
        return {
          success: false,
          error: googleResult.error || 'Google Sign-In failed',
        };
      }

      const { user: googleUser, idToken } = googleResult.data;

      // Try to authenticate with backend using Google token
      try {
        const response = await authAPI.googleLogin({
          idToken,
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.id,
          photo: googleUser.photo,
        });

        if (response.success) {
          const { data } = response;
          const newToken = data.token || data.access_token;
          const userData = data.user ||
            data.data || {
              id: data._id || googleUser.id,
              name: data.name || googleUser.name,
              email: data.email || googleUser.email,
              avatar: data.avatar || googleUser.photo,
              role: data.role || 'User',
            };

          // Save to storage
          await saveToken(newToken);
          await saveUserData(userData);

          showSuccess(
            'Welcome!',
            'You have signed in with Google successfully',
          );

          // Update state
          setTokenState(newToken);
          setUser(userData);
          setIsAuthenticated(true);

          return { success: true };
        } else {
          return {
            success: false,
            error: response.error || 'Failed to authenticate with server',
          };
        }
      } catch (apiError) {
        console.error('Backend Google auth error:', apiError);

        // Fallback: Create local session with Google user data
        // This is useful for development or when backend doesn't support Google auth yet
        const newToken = 'google-token-' + Date.now();
        const userData = {
          id: googleUser.id,
          name: googleUser.name,
          email: googleUser.email,
          avatar: googleUser.photo,
          role: 'User',
          authProvider: 'google',
        };

        await saveToken(newToken);
        await saveUserData(userData);

        showSuccess('Welcome!', 'You have signed in with Google successfully');

        setTokenState(newToken);
        setUser(userData);
        setIsAuthenticated(true);

        return { success: true };
      }
    } catch (error) {
      console.error('Google login error:', error);
      return {
        success: false,
        error:
          getErrorMessage(error) || 'An error occurred during Google Sign-In',
      };
    }
  }, []);

  const appleLogin = useCallback(async () => {
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // For now, fallback to demo/backendless flow similar to Google fallback
      const result = await login('help.work2305@gmail.com', 'admin', false);

      console.log('Apple Success:', response, 'loginResult:', result);

      // Ensure a consistent return shape
      return result || { success: true };
    } catch (error) {
      console.log('Apple Error:', error);
      return {
        success: false,
        error:
          getErrorMessage(error) || error?.message || 'Apple Sign-In failed',
      };
    }
  }, [login]);

  /**
   * Logout the current user
   * Clears local state, storage, and signs out from Google if applicable
   */
  const logout = useCallback(async () => {
    try {
      // Sign out from Google if user was authenticated with Google
      try {
        await signOutFromGoogle();
      } catch (googleError) {
        console.log(
          'Google sign-out skipped (user may not have used Google auth)',
        );
      }

      // Clear all auth data from storage
      await clearAuthData();

      // Reset all state
      setTokenState(null);
      setUser(null);
      setIsAuthenticated(false);

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }, []);

  /**
   * Update user profile data
   * @param {Object} updates - User data updates
   */
  const updateUser = useCallback(
    async updates => {
      try {
        const updatedUser = { ...user, ...updates };
        await saveUserData(updatedUser);
        setUser(updatedUser);
        return true;
      } catch (error) {
        console.error('Update user error:', error);
        return false;
      }
    },
    [user],
  );

  /**
   * Refresh authentication state
   */
  const refreshAuth = useCallback(async () => {
    await initializeAuth();
  }, []);

  /**
   * Get current user from API
   */
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      if (response.success) {
        const userData = response.data.user || response.data;
        await saveUserData(userData);
        setUser(userData);
        return { success: true, user: userData };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }, []);

  const value = {
    // State
    user,
    token,
    isLoading,
    isAuthenticated,
    rememberedEmail,
    isAppleReviewMode,

    // Methods
    login,
    register,
    googleLogin,
    appleLogin,
    logout,
    updateUser,
    refreshAuth,
    fetchCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * useAuth Hook
 * Access authentication context from any component
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
