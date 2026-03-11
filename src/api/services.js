/**
 * API Service
 * Provides methods for making API calls
 */

import apiClient, {
    getErrorMessage,
    isNetworkError,
    isAuthError,
} from './interceptor';
import { API_BASE_URL, API_ENDPOINTS } from './config';
import { getToken } from '../storage';

/**
 * Generic API request handler
 * Wraps API calls with consistent error handling
 */
const handleRequest = async request => {
    try {
        const response = await request;
        return {
            success: true,
            data: response.data,
            status: response.status,
        };
    } catch (error) {
        return {
            success: false,
            error: getErrorMessage(error),
            status: error.response?.status,
            isNetworkError: isNetworkError(error),
            isAuthError: isAuthError(error),
        };
    }
};

// ============================================
// SystemConfig APIs
// ============================================

export const SystemConfigAPI = {
    /**
     * Get current system config
     */
    getSysConfig: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.SETTINGS.CONFIG));
    },
};

// ============================================
// AUTH APIs
// ============================================

export const authAPI = {
    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     */
    login: (email, password) => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.AUTH.LOGIN, { email, password }),
        );
    },

    /**
     * Register new user
     * @param {object} userData - User registration data
     */
    register: userData => {
        return handleRequest(apiClient.post(API_ENDPOINTS.AUTH.REGISTER, userData));
    },

    /**
     * Logout user
     */
    logout: () => {
        return handleRequest(apiClient.post(API_ENDPOINTS.AUTH.LOGOUT));
    },

    /**
     * Get current user info
     */
    getMe: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.AUTH.ME));
    },

    /**
     * Forgot password - Send OTP
     * @param {string} email - User email
     */
    forgotPasswordSendOtp: email => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD_SEND_OTP, { email }),
        );
    },

    /**
     * Forgot password - Verify OTP
     * @param {string} email - User email
     * @param {string} otp - OTP code
     */
    verifyForgotPasswordOtp: (email, otp) => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD_VERIFY_OTP, { email, otp }),
        );
    },

    /**
     * Forgot password - Reset password
     * @param {object} data - Reset password data (email, otp, newPassword)
     */
    forgotPasswordReset: data => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD_RESET_PASSWORD, data),
        );
    },

    /**
     * Reset password (Original)
     * @param {object} data - Reset password data (token, password, confirmPassword)
     */
    resetPassword: data => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data),
        );
    },

    /**
     * Google Login/Register
     * @param {object} data - Google auth data (idToken, email, name, googleId, photo)
     */
    googleLogin: data => {
        return handleRequest(apiClient.post(API_ENDPOINTS.AUTH.GOOGLE_LOGIN, data));
    },

    /**
     * Two Factor Login/Register
     * @param {object} data - Two factor auth data (token, email, etc.)
     */
    twoFactorAuth: data => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.AUTH.TWO_FACTOR_AUTH, data),
        );
    },
};

// ============================================
// USER APIs
// ============================================

export const userAPI = {
    /**
     * Get user profile
     */
    getProfile: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.USERS.PROFILE));
    },

    /**
     * Update user profile
     * @param {object} data - Profile data to update
     */
    updateProfile: data => {
        return handleRequest(
            apiClient.put(API_ENDPOINTS.USERS.UPDATE_PROFILE, data),
        );
    },

    /**
     * Update my profile
     * @param {object} data - Profile data to update
     */
    updateMyProfile: data => {
        return handleRequest(
            apiClient.put(API_ENDPOINTS.USERS.UPDATE_PROFILE, data),
        );
    },

    /**
     * Change password
     * @param {object} data - { currentPassword, newPassword, confirmPassword }
     */
    changePassword: data => {
        // console.log('data : ', data)
        // console.log('API_ENDPOINTS.USERS.CHANGE_PASSWORD : ', API_ENDPOINTS.USERS.CHANGE_PASSWORD)
        return handleRequest(
            apiClient.put(API_ENDPOINTS.USERS.CHANGE_PASSWORD, data),
        );
    },

    /**
     * Upload avatar
     * @param {FormData} formData - Form data with image file
     */
    uploadAvatar: formData => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.USERS.UPLOAD_AVATAR, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }),
        );
    },

    /**
     * Upload my profile photo
     * @param {FormData} formData - Form data with image file
     */
    uploadProfilePhoto: formData => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.USERS.MY_PHOTO_UPLOAD, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }),
        );
    },
};

// ============================================
// LEADS APIs
// ============================================

export const leadsAPI = {
    /**
     * Get all leads
     * @param {object} params - Query params (page, limit, status, search, etc.)
     */
    getAll: (params = {}) => {
        return handleRequest(apiClient.get(API_ENDPOINTS.LEADS.LIST, { params }));
    },

    /**
     * Get lead by ID
     * @param {string|number} id - Lead ID
     */
    getById: id => {
        return handleRequest(apiClient.get(API_ENDPOINTS.LEADS.DETAIL(id)));
    },

    /**
     * Create new lead
     * @param {object} data - Lead data
     */
    create: data => {
        return handleRequest(apiClient.post(API_ENDPOINTS.LEADS.CREATE, data));
    },

    /**
     * Update lead
     * @param {string|number} id - Lead ID
     * @param {object} data - Lead data to update
     */
    update: (id, data) => {
        return handleRequest(apiClient.put(API_ENDPOINTS.LEADS.UPDATE(id), data));
    },

    /**
     * Delete lead
     * @param {string|number} id - Lead ID
     */
    delete: id => {
        return handleRequest(apiClient.delete(API_ENDPOINTS.LEADS.DELETE(id)));
    },

    /**
     * Search leads
     * @param {string} query - Search query
     * @param {object} params - Additional params
     */
    search: (query, params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.LEADS.SEARCH, {
                params: { q: query, ...params },
            }),
        );
    },

    /**
     * Get leads statistics
     */
    getStats: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.LEADS.STATS));
    },

    /**
     * Get activities for a lead
     * @param {string|number} id - Lead ID
     * @param {object} params - Query params (page, limit)
     */
    getActivities: (id, params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.LEADS.ACTIVITIES(id), { params }),
        );
    },

    /**
     * Upload document for a lead
     */
    uploadDocument: (id, formData) => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.LEADS.DOCUMENTS(id), formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }),
        );
    },

    /**
     * Get documents for a lead
     */
    getDocuments: id => {
        return handleRequest(apiClient.get(API_ENDPOINTS.LEADS.DOCUMENTS(id)));
    },

    /**
     * Delete a lead document
     */
    deleteDocument: (id, docId) => {
        return handleRequest(
            apiClient.delete(API_ENDPOINTS.LEADS.DELETE_DOCUMENT(id, docId)),
        );
    },
};

// ============================================
// TASKS APIs
// ============================================

export const tasksAPI = {
    /**
     * Get all tasks
     * @param {object} params - Query params (page, limit, status, priority, etc.)
     */
    getAll: (params = {}) => {
        return handleRequest(apiClient.get(API_ENDPOINTS.TASKS.LIST, { params }));
    },

    /**
     * Get task by ID
     * @param {string|number} id - Task ID
     */
    getById: id => {
        return handleRequest(apiClient.get(API_ENDPOINTS.TASKS.DETAIL(id)));
    },

    /**
     * Create new task
     * @param {object} data - Task data
     */
    create: data => {
        return handleRequest(apiClient.post(API_ENDPOINTS.TASKS.CREATE, data));
    },

    /**
     * Update task
     * @param {string|number} id - Task ID
     * @param {object} data - Task data to update
     */
    update: (id, data) => {
        return handleRequest(apiClient.patch(API_ENDPOINTS.TASKS.UPDATE(id), data));
    },

    /**
     * Delete task
     * @param {string|number} id - Task ID
     */
    delete: id => {
        return handleRequest(apiClient.delete(API_ENDPOINTS.TASKS.DELETE(id)));
    },

    /**
     * Toggle task status (complete/incomplete)
     * @param {string|number} id - Task ID
     */
    toggleStatus: id => {
        return handleRequest(
            apiClient.patch(API_ENDPOINTS.TASKS.TOGGLE_STATUS(id)),
        );
    },

    /**
     * Get today's tasks
     */
    getToday: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.TASKS.TODAY));
    },

    /**
     * Get overdue tasks
     */
    getOverdue: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.TASKS.OVERDUE));
    },

    /**
     * Get tasks statistics
     */
    getStats: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.TASKS.STATS));
    },
};

// ============================================
// DASHBOARD APIs
// ============================================

export const dashboardAPI = {
    /**
     * Get dashboard stats
     */
    getStats: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.DASHBOARD.STATS));
    },

    /**
     * Get recent leads
     * @param {number} limit - Number of leads to fetch
     */
    getRecentLeads: (limit = 5) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.DASHBOARD.RECENT_LEADS, {
                params: { limit },
            }),
        );
    },

    /**
     * Get recent tasks
     * @param {number} limit - Number of tasks to fetch
     */
    getRecentTasks: (limit = 5) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.DASHBOARD.RECENT_TASKS, {
                params: { limit },
            }),
        );
    },
};

// ============================================
// NOTIFICATIONS APIs
// ============================================

export const notificationsAPI = {
    /**
     * Get my notifications (current user)
     * @param {object} params - Query params (page, limit, unreadOnly, type)
     */
    getMy: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.NOTIFICATIONS.MY, { params }),
        );
    },

    /**
     * Get all notifications (alias for list)
     * @param {object} params - Query params (page, limit, unread, etc.)
     */
    getAll: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.NOTIFICATIONS.MY, { params }),
        );
    },

    /**
     * Mark notification as read
     * @param {string|number} id - Notification ID
     */
    markAsRead: id => {
        return handleRequest(
            apiClient.patch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id)),
        );
    },

    /**
     * Mark all notifications as read
     */
    markAllAsRead: () => {
        return handleRequest(
            apiClient.patch(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ),
        );
    },

    /**
     * Delete notification
     * @param {string|number} id - Notification ID
     */
    delete: id => {
        return handleRequest(
            apiClient.delete(API_ENDPOINTS.NOTIFICATIONS.DELETE(id)),
        );
    },
};

// ============================================
// COMPANIES APIs
// ============================================

export const companiesAPI = {
    /**
     * Get all companies
     * @param {object} params - Query params (page, limit, etc.)
     */
    getAll: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.COMPANIES.LIST, { params }),
        );
    },

    /**
     * Get company by ID
     * @param {string|number} id - Company ID
     */
    getById: id => {
        return handleRequest(apiClient.get(API_ENDPOINTS.COMPANIES.DETAIL(id)));
    },

    /**
     * Create new company
     * @param {object} data - Company data
     */
    create: data => {
        return handleRequest(apiClient.post(API_ENDPOINTS.COMPANIES.CREATE, data));
    },

    /**
     * Update company
     * @param {string|number} id - Company ID
     * @param {object} data - Company data to update
     */
    update: (id, data) => {
        return handleRequest(
            apiClient.put(API_ENDPOINTS.COMPANIES.UPDATE(id), data),
        );
    },

    /**
     * Delete company
     * @param {string|number} id - Company ID
     */
    delete: id => {
        return handleRequest(apiClient.delete(API_ENDPOINTS.COMPANIES.DELETE(id)));
    },

    /**
     * Upload documents for a company
     * @param {string|number} id - Company ID
     * @param {FormData} formData - Form data with files
     */
    uploadDocument: (id, formData) => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.COMPANIES.DOCUMENTS(id), formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }),
        );
    },

    /**
     * Get documents for a company
     * @param {string|number} id - Company ID
     */
    getDocuments: id => {
        return handleRequest(apiClient.get(API_ENDPOINTS.COMPANIES.DOCUMENTS(id)));
    },

    /**
     * Delete a document from a company
     * @param {string|number} id - Company ID
     * @param {string} documentId - Document ID
     */
    deleteDocument: (id, documentId) => {
        return handleRequest(
            apiClient.delete(API_ENDPOINTS.COMPANIES.DELETE_DOCUMENT(id, documentId)),
        );
    },
};

// ============================================
// CONTACTS APIs
// ============================================

export const contactsAPI = {
    /**
     * Get all contacts
     * @param {object} params - Query params (page, limit, etc.)
     */
    getAll: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.CONTACTS.LIST, { params }),
        );
    },

    /**
     * Get contact by ID
     * @param {string|number} id - Contact ID
     */
    getById: id => {
        return handleRequest(apiClient.get(API_ENDPOINTS.CONTACTS.DETAIL(id)));
    },

    /**
     * Create new contact
     * @param {object} data - Contact data
     */
    create: data => {
        return handleRequest(apiClient.post(API_ENDPOINTS.CONTACTS.CREATE, data));
    },

    /**
     * Update contact
     * @param {string|number} id - Contact ID
     * @param {object} data - Contact data to update
     */
    update: (id, data) => {
        return handleRequest(
            apiClient.put(API_ENDPOINTS.CONTACTS.UPDATE(id), data),
        );
    },

    /**
     * Delete contact
     * @param {string|number} id - Contact ID
     */
    delete: id => {
        return handleRequest(apiClient.delete(API_ENDPOINTS.CONTACTS.DELETE(id)));
    },

    /**
     * Upload documents for a contact
     * @param {string|number} id - Contact ID
     * @param {FormData} formData - Form data with files
     */
    uploadDocument: (id, formData) => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.CONTACTS.DOCUMENTS(id), formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }),
        );
    },

    /**
     * Get documents for a contact
     * @param {string|number} id - Contact ID
     */
    getDocuments: (id) => {
        // Since there's no specific documents-only endpoint, we fetch the contact and extract documents
        return handleRequest(apiClient.get(API_ENDPOINTS.CONTACTS.DETAIL(id)));
    },

    /**
     * Delete a document from a contact
     * @param {string|number} id - Contact ID
     * @param {string} documentId - Document ID
     */
    deleteDocument: (id, documentId) => {
        return handleRequest(
            apiClient.delete(API_ENDPOINTS.CONTACTS.DELETE_DOCUMENT(id, documentId)),
        );
    },
};

// ============================================
// DEVICE TOKENS APIs (FCM Push Notifications)
// ============================================

export const deviceTokensAPI = {
    /**
     * Register a device token for push notifications
     * @param {object} data - { token, deviceId, platform, deviceName }
     */
    register: data => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.DEVICE_TOKENS.REGISTER, data),
        );
    },

    /**
     * Get all registered devices
     */
    getDevices: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.DEVICE_TOKENS.LIST));
    },

    /**
     * Remove a device token
     * @param {string} deviceId - Device ID to remove
     */
    remove: deviceId => {
        return handleRequest(
            apiClient.delete(API_ENDPOINTS.DEVICE_TOKENS.REMOVE(deviceId)),
        );
    },

    /**
     * Remove all device tokens (logout from all devices)
     */
    removeAll: () => {
        return handleRequest(
            apiClient.delete(API_ENDPOINTS.DEVICE_TOKENS.REMOVE_ALL),
        );
    },

    /**
     * Toggle push notifications
     * @param {boolean} enabled - Whether to enable push notifications
     */
    toggleNotifications: enabled => {
        return handleRequest(
            apiClient.patch(API_ENDPOINTS.DEVICE_TOKENS.TOGGLE, { enabled }),
        );
    },

    /**
     * Send test notification to current device
     * @param {object} data - { title, body, imageUrl }
     */
    testNotification: (data = {}) => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.DEVICE_TOKENS.TEST, data),
        );
    },
};

// ============================================
// FOLLOW UP APIs
// ============================================

export const followUpAPI = {
    /**
     * Get tasks due today
     * @param {object} params - Query params (page, limit)
     */
    getDueToday: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.FOLLOW_UP.DUE_TODAY, { params }),
        );
    },

    /**
     * Get overdue tasks
     * @param {object} params - Query params (page, limit)
     */
    getOverdue: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.FOLLOW_UP.OVERDUE, { params }),
        );
    },

    /**
     * Get rule generated tasks
     * @param {object} params - Query params (page, limit, status)
     */
    getRuleGenerated: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.FOLLOW_UP.RULE_GENERATED, { params }),
        );
    },
};

// ============================================
// SETTINGS APIs
// ============================================

export const settingsAPI = {
    /**
     * Get settings
     */
    get: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.SETTINGS.GET));
    },

    /**
     * Update settings
     * @param {object} data
     */
    update: data => {
        return handleRequest(apiClient.put(API_ENDPOINTS.SETTINGS.UPDATE, data));
    },

    /**
     * Get call history
     * @param {object} params (client_numbers, lead_id, page_size)
     */
    getCallHistory: params => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.SETTINGS.CALL_HISTORY, { params }),
        );
    },
};

// ============================================
// AI ASSISTANT APIs
// ============================================

export const aiAPI = {
    /**
     * Get all chat sessions
     */
    getSessions: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.AI.SESSIONS));
    },

    /**
     * Create new chat session
     */
    createSession: () => {
        return handleRequest(apiClient.post(API_ENDPOINTS.AI.SESSIONS));
    },

    /**
     * Delete chat session
     * @param {string} sessionId
     */
    deleteSession: sessionId => {
        return handleRequest(
            apiClient.delete(API_ENDPOINTS.AI.DELETE_SESSION(sessionId)),
        );
    },

    /**
     * Get chat history
     * @param {string} sessionId
     * @param {number} limit
     * @param {number} skip
     */
    getHistory: (sessionId, limit = 100, skip = 0) => {
        const url = sessionId
            ? API_ENDPOINTS.AI.SESSION_HISTORY(sessionId)
            : API_ENDPOINTS.AI.HISTORY;
        return handleRequest(apiClient.get(url, { params: { limit, skip } }));
    },

    /**
     * Send message (Standard - non-streaming fallback)
     * @param {string} content
     * @param {string} sessionId
     */
    sendMessage: (content, sessionId) => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.AI.MESSAGE, { content, sessionId }),
        );
    },

    /**
     * Send message and stream SSE via XMLHttpRequest (works in React Native where fetch.body is undefined).
     * Calls onChunk(fullText), onInit(sessionId), onError(message), onDone() as events arrive.
     * @param {string} content
     * @param {string|null} sessionId
     * @param {{ onChunk: (fullText: string) => void, onInit?: (sessionId: string) => void, onError?: (message: string) => void, onDone?: () => void }} callbacks
     * @returns {Promise<{ ok: boolean, status: number }>}
     */
    sendMessageStreamXHR: (content, sessionId, callbacks) => {
        return new Promise(async (resolve, reject) => {
            const token = await getToken();
            const url = `${API_BASE_URL}${API_ENDPOINTS.AI.MESSAGE}`;
            const xhr = new XMLHttpRequest();
            let processedUpTo = 0;
            let fullText = '';

            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.onprogress = () => {
                const text = xhr.responseText || '';
                const rest = text.slice(processedUpTo);
                const parts = rest.split('\n\n');
                const incompleteLen =
                    (parts[parts.length - 1] || '').length + (parts.length > 1 ? 2 : 0);
                const toProcess =
                    parts.length > 1
                        ? parts.slice(0, -1)
                        : rest.endsWith('\n\n')
                            ? parts
                            : [];

                for (const part of toProcess) {
                    if (!part.trim()) continue;
                    const eventMatch = part.match(/^event: (.*)$/m);
                    const dataMatch = part.match(/^data: (.*)$/m);
                    const event = eventMatch ? eventMatch[1].trim() : 'message';
                    const dataStr = dataMatch ? dataMatch[1].trim() : '';
                    if (!dataStr) continue;
                    try {
                        const data = JSON.parse(dataStr);
                        if (event === 'error') {
                            callbacks.onError?.(data.message || 'An error occurred.');
                            return;
                        }
                        if (event === 'init' && data.sessionId)
                            callbacks.onInit?.(data.sessionId);
                        if (event === 'done') {
                            if (
                                data.assistantMessage?.content &&
                                data.assistantMessage.content.length > fullText.length
                            ) {
                                fullText = data.assistantMessage.content;
                            }
                        } else if (!event || event === 'message') {
                            if (data.content) fullText += data.content;
                        }
                    } catch (e) {
                        /* ignore */
                    }
                }
                processedUpTo = text.length - incompleteLen;
                if (fullText && callbacks.onChunk) callbacks.onChunk(fullText);
            };

            xhr.onload = () => {
                const text = xhr.responseText || '';
                const parts = text.split('\n\n');
                for (const part of parts) {
                    if (!part.trim()) continue;
                    const eventMatch = part.match(/^event: (.*)$/m);
                    const dataMatch = part.match(/^data: (.*)$/m);
                    const event = eventMatch ? eventMatch[1].trim() : 'message';
                    const dataStr = dataMatch ? dataMatch[1].trim() : '';
                    if (!dataStr) continue;
                    try {
                        const data = JSON.parse(dataStr);
                        if (event === 'error')
                            callbacks.onError?.(data.message || 'An error occurred.');
                        if (event === 'init' && data.sessionId)
                            callbacks.onInit?.(data.sessionId);
                        if (event === 'done' && data.assistantMessage?.content) {
                            if (data.assistantMessage.content.length > fullText.length)
                                fullText = data.assistantMessage.content;
                        } else if ((!event || event === 'message') && data.content)
                            fullText += data.content;
                    } catch (e) {
                        /* ignore */
                    }
                }
                if (fullText && callbacks.onChunk) callbacks.onChunk(fullText);
                callbacks.onDone?.();
                resolve({
                    ok: xhr.status >= 200 && xhr.status < 300,
                    status: xhr.status,
                });
            };

            xhr.onerror = () => {
                callbacks.onError?.('Network error. Please check your connection.');
                resolve({ ok: false, status: 0 });
            };

            xhr.ontimeout = () => {
                callbacks.onError?.('Request timed out.');
                resolve({ ok: false, status: 0 });
            };

            try {
                xhr.send(
                    JSON.stringify({ content, sessionId: sessionId || undefined }),
                );
            } catch (e) {
                callbacks.onError?.(e.message || 'Request failed.');
                resolve({ ok: false, status: 0 });
            }
        });
    },

    /**
     * Clear all history
     */
    clearHistory: () => {
        return handleRequest(apiClient.delete(API_ENDPOINTS.AI.HISTORY));
    },

    /**
     * Get plan status
     */
    getPlanStatus: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.AI.PLAN_STATUS));
    },
};

// ============================================
// PRODUCTS APIs
// ============================================

export const productsAPI = {
    /**
     * Get all products
     * @param {object} params - Query params (page, limit, search, etc.)
     */
    getAll: (params = {}) => {
        return handleRequest(apiClient.get(API_ENDPOINTS.PRODUCTS.LIST, { params }));
    },

    /**
     * Get product by ID
     * @param {string} id - Product ID
     */
    getById: id => {
        return handleRequest(apiClient.get(API_ENDPOINTS.PRODUCTS.DETAIL(id)));
    },
};

// ============================================
// DEAL STAGES APIs
// ============================================

export const dealStagesAPI = {
    /**
     * Get all deal stages
     * @param {object} params - Query params (pipelineId, etc.)
     */
    getAll: (params = {}) => {
        return handleRequest(apiClient.get(API_ENDPOINTS.DEAL_STAGES.LIST, { params }));
    },
};

// ============================================
// LEAD TAGS APIs
// ============================================

export const leadTagsAPI = {
    /**
     * Get all lead tags
     */
    getAll: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.LEAD_TAGS.LIST));
    },
};

// ============================================
// LEAD SOURCES APIs
// ============================================

export const leadSourcesAPI = {
    /**
     * Get all lead sources
     */
    getAll: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.LEAD_SOURCES.LIST));
    },
};

// ============================================
// USERS APIs (for salesperson / telesales)
// ============================================

export const usersAPI = {
    /**
     * Get all users
     * @param {object} params - Query params (role, status, etc.)
     */
    getAll: (params = {}) => {
        return handleRequest(apiClient.get(API_ENDPOINTS.USERS.LIST, { params }));
    },

    /**
     * Get all users (alias)
     */
    getAllUsers: (params = {}) => {
        return handleRequest(apiClient.get(API_ENDPOINTS.USERS.LIST, { params }));
    },
};

// ============================================
// PIPELINE APIs
// ============================================

export const pipelineAPI = {
    /**
     * Get all pipelines for the organisation
     */
    getAll: () => {
        return handleRequest(apiClient.get(API_ENDPOINTS.PIPELINES.LIST));
    },

    /**
     * Get leads for a specific pipeline with pagination
     * @param {string} pipelineId - Pipeline _id
     * @param {object} params - { page, limit, search, ... }
     */
    getLeadsByPipeline: (pipelineId, params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.LEADS.LIST, {
                params: { pipelineId, ...params },
            })
        );
    },
};

// ============================================
// REPORTS APIs
// ============================================

export const reportsAPI = {
    /**
     * Get CRM overview report
     * @param {object} params - { dateFrom, dateTo } (format: DD/MM/YYYY)
     */
    getCrmOverview: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.REPORTS.CRM_OVERVIEW, { params }),
        );
    },

    /**
     * Get Team Performance report
     * @param {object} params - { dateRange: 'this_month' | 'last_month' | 'this_quarter' | etc, teamFilter }
     */
    getTeamPerformance: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.REPORTS.TEAM_PERFORMANCE, { params }),
        );
    },

    /**
     * Get Forecast report
     * @param {object} params - { from: ISO string, to: ISO string, ownerFilter: 'team' | userId }
     */
    getForecast: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.REPORTS.FORECAST, { params }),
        );
    },

    /**
     * Get Smart Call Dashboard
     * @param {object} params - { fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD', limit: number, callType }
     */
    getSmartCallDashboard: (params = {}) => {
        return handleRequest(
            apiClient.get(API_ENDPOINTS.REPORTS.SMART_CALL_DASHBOARD, { params }),
        );
    },
};

// ============================================
// NOTES APIs
// ============================================

export const notesAPI = {
    /**
     * Create a new note
     * @param {object} data - { entityType, entityId, content, mentions }
     */
    create: data => {
        return handleRequest(apiClient.post(API_ENDPOINTS.NOTES.CREATE, data));
    },

    /**
     * Get notes for an entity
     * @param {object} params - { entityType, entityId }
     */
    getAll: (params = {}) => {
        return handleRequest(apiClient.get(API_ENDPOINTS.NOTES.LIST, { params }));
    },

    /**
     * Get note by ID
     */
    getById: id => {
        return handleRequest(apiClient.get(API_ENDPOINTS.NOTES.DETAIL(id)));
    },

    /**
     * Update a note
     */
    update: (id, data) => {
        return handleRequest(apiClient.put(API_ENDPOINTS.NOTES.UPDATE(id), data));
    },

    /**
     * Delete a note
     */
    delete: id => {
        return handleRequest(apiClient.delete(API_ENDPOINTS.NOTES.DELETE(id)));
    },

    /**
     * Add a comment to a note
     */
    addComment: (id, data) => {
        return handleRequest(
            apiClient.post(API_ENDPOINTS.NOTES.ADD_COMMENT(id), data),
        );
    },
};

// ============================================
// UPLOAD API (generic file upload to Cloudinary)
// ============================================
export const uploadAPI = {
    /**
     * Upload a single file
     * @param {FormData} formData - FormData with field name 'file'
     * @returns {{ fileUrl, publicId, fileName, fileType, fileSize }}
     */
    uploadFile: formData => {
        return handleRequest(
            apiClient.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }),
        );
    },
};

// Export all APIs
export default {
    auth: authAPI,
    systemConfig: SystemConfigAPI,
    user: userAPI,
    leads: leadsAPI,
    tasks: tasksAPI,
    dashboard: dashboardAPI,
    notifications: notificationsAPI,
    companies: companiesAPI,
    contacts: contactsAPI,
    deviceTokens: deviceTokensAPI,
    settings: settingsAPI,
    followUp: followUpAPI,
    reports: reportsAPI,
    ai: aiAPI,
    pipeline: pipelineAPI,
    products: productsAPI,
    dealStages: dealStagesAPI,
    leadTags: leadTagsAPI,
    leadSources: leadSourcesAPI,
    users: usersAPI,
    notes: notesAPI,
    upload: uploadAPI,
};
