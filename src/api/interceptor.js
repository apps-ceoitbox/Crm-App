/**
 * Axios Interceptor
 * Configures Axios instance with request/response interceptors
 */

import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT, STATUS_CODES } from './config';
import { getToken, clearAuthData } from '../storage';

// Create axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Store the navigation reference for redirecting on auth errors
let navigationRef = null;

/**
 * Set the navigation reference for auth redirects
 * @param {object} ref - Navigation reference
 */
export const setNavigationRef = (ref) => {
    navigationRef = ref;
};

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

/**
 * Request Interceptor
 * Adds authorization token to every request
 */
apiClient.interceptors.request.use(
    async (config) => {
        try {
            // Get token from storage
            const token = await getToken();

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            // Log request in development
            // if (__DEV__) {
            //     console.log('🚀 API Request:', {
            //         method: config.method?.toUpperCase(),
            //         url: config.baseURL + config.url,
            //         headers: config.headers,
            //         data: config.data,
            //         params: config.params,
            //     });
            // }

            return config;
        } catch (error) {
            console.error('Request interceptor error:', error);
            return config;
        }
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

/**
 * Response Interceptor
 * Handles successful responses and errors
 */
apiClient.interceptors.response.use(
    (response) => {
        // Log response in development
        // if (__DEV__) {
        //     console.log('✅ API Response:', {
        //         status: response.status,
        //         url: response.config.url,
        //         data: response.data,
        //     });
        // }

        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Log error in development
        if (__DEV__) {
            console.log('❌ API Error:', {
                status: error.response?.status,
                url: originalRequest?.url,
                message: error.response?.data?.message || error.message,
                data: error.response?.data,
            });
        }

        // Handle specific error codes
        if (error.response) {
            const { status, data } = error.response;

            switch (status) {
                case STATUS_CODES.UNAUTHORIZED:
                    // Token expired or invalid
                    if (!originalRequest._retry) {
                        originalRequest._retry = true;

                        // Clear auth data and redirect to login
                        await clearAuthData();

                        if (navigationRef) {
                            navigationRef.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        }
                    }
                    break;

                case STATUS_CODES.FORBIDDEN:
                    // User doesn't have permission
                    console.warn('Access forbidden:', data?.message);
                    break;

                case STATUS_CODES.NOT_FOUND:
                    // Resource not found
                    console.warn('Resource not found:', originalRequest.url);
                    break;

                case STATUS_CODES.VALIDATION_ERROR:
                    // Validation errors
                    console.warn('Validation error:', data?.errors);
                    break;

                case STATUS_CODES.SERVER_ERROR:
                    // Server error
                    console.error('Server error:', data?.message);
                    break;

                default:
                    console.error('Unhandled error:', status, data);
            }
        } else if (error.request) {
            // Network error - no response received
            console.error('Network error - no response received');
            error.message = 'Network error. Please check your internet connection.';
        } else {
            // Request setup error
            console.error('Request setup error:', error.message);
        }

        return Promise.reject(error);
    }
);

/**
 * Helper function to extract error message from API response
 * @param {Error} error - Axios error object
 * @returns {string} - Error message
 */
export const getErrorMessage = (error) => {
    if (error.response?.data?.message) {
        return error.response.data.message;
    }
    if (error.response?.data?.error) {
        return error.response.data.error;
    }
    if (error.response?.data?.errors) {
        // Handle validation errors
        const errors = error.response.data.errors;
        if (Array.isArray(errors)) {
            return errors.map(e => e.message || e).join(', ');
        }
        if (typeof errors === 'object') {
            return Object.values(errors).flat().join(', ');
        }
    }
    if (error.message) {
        return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
};

/**
 * Helper function to check if error is a network error
 * @param {Error} error - Axios error object
 * @returns {boolean}
 */
export const isNetworkError = (error) => {
    return !error.response && error.request;
};

/**
 * Helper function to check if error is an auth error
 * @param {Error} error - Axios error object
 * @returns {boolean}
 */
export const isAuthError = (error) => {
    return error.response?.status === STATUS_CODES.UNAUTHORIZED;
};

export default apiClient;
