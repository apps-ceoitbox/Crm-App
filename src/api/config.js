/**
 * API Configuration
 * Contains base URLs and API endpoints
 */

// Base URL for the API
export const API_BASE_URL = 'https://crm.ceoitbox.com/api';
// export const API_BASE_URL = 'https://gsvmdl68-3001.inc1.devtunnels.ms/api';
// export const API_BASE_URL = 'https://dmdk3dwt-3001.inc1.devtunnels.ms/api'; // Param for local development: http://localhost:3000/api

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    GOOGLE_LOGIN: '/auth/google',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh',
    FORGOT_PASSWORD_SEND_OTP: '/auth/forgot-password/send-otp',
    FORGOT_PASSWORD_VERIFY_OTP: '/auth/forgot-password/verify-otp',
    FORGOT_PASSWORD_RESET_PASSWORD: '/auth/forgot-password/reset-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    ME: '/auth/me',
    TWO_FACTOR_AUTH: '/auth/verify-login-2fa',
  },

  // Users
  USERS: {
    PROFILE: '/users/me/profile',
    UPDATE_PROFILE: '/users/me/profile',
    CHANGE_PASSWORD: '/users/me/password',
    UPLOAD_AVATAR: '/users/avatar',
    MY_PROFILE: '/users/me/profile',
    MY_PHOTO_UPLOAD: '/users/me/photo/upload',
    MY_PHOTO: '/users/me/photo',
    LIST: '/users',
    DETAIL: id => `/users/${id}`,
  },

  // Leads
  LEADS: {
    LIST: '/leads',
    CREATE: '/leads',
    DETAIL: id => `/leads/${id}`,
    UPDATE: id => `/leads/${id}`,
    DELETE: id => `/leads/${id}`,
    SEARCH: '/leads/search',
    STATS: '/leads/stats',
    EXPORT: '/leads/export',
    IMPORT: '/leads/import',
    ACTIVITIES: id => `/leads/${id}/activities`,
    DOCUMENTS: id => `/leads/${id}/documents`,
    DELETE_DOCUMENT: (id, docId) => `/leads/${id}/documents/${docId}`,
  },

  // Follow ups
  FOLLOW_UP: {
    OVERDUE: '/leads/followups/overdue',
    RULE_GENERATED: '/followup/rule-generated',
    DUE_TODAY: '/leads/followups/due-today',
  },

  // Tasks
  TASKS: {
    LIST: '/tasks',
    CREATE: '/tasks',
    DETAIL: id => `/tasks/${id}`,
    UPDATE: id => `/tasks/${id}`,
    DELETE: id => `/tasks/${id}`,
    TOGGLE_STATUS: id => `/tasks/${id}/toggle`,
    STATS: '/tasks/stats',
    TODAY: '/tasks/today',
    OVERDUE: '/tasks/overdue',
  },

  // Dashboard
  DASHBOARD: {
    STATS: '/dashboard/stats',
    RECENT_LEADS: '/dashboard/recent-leads',
    RECENT_TASKS: '/dashboard/recent-tasks',
    CHARTS: '/dashboard/charts',
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/notifications',
    MY: '/notifications/my',
    MARK_READ: id => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/read-all',
    DELETE: id => `/notifications/${id}`,
  },

  // Settings
  SETTINGS: {
    GET: '/settings/getSettings',
    UPDATE: '/settings',
    CONFIG: '/system-config',
    CALL_HISTORY: '/settings/calling-integration/call-history',
  },

  // Companies
  COMPANIES: {
    LIST: '/companies',
    CREATE: '/companies',
    DETAIL: id => `/companies/${id}`,
    UPDATE: id => `/companies/${id}`,
    DELETE: id => `/companies/${id}`,
    DOCUMENTS: id => `/companies/${id}/documents`,
    DELETE_DOCUMENT: (id, docId) => `/companies/${id}/documents/${docId}`,
  },

  // Contacts
  CONTACTS: {
    LIST: '/crm-contacts',
    CREATE: '/crm-contacts',
    DETAIL: id => `/crm-contacts/${id}`,
    UPDATE: id => `/crm-contacts/${id}`,
    DELETE: id => `/crm-contacts/${id}`,
    DOCUMENTS: id => `/crm-contacts/${id}/documents`,
    DELETE_DOCUMENT: (id, docId) => `/crm-contacts/${id}/documents/${docId}`,
  },

  // Device Tokens (FCM)
  DEVICE_TOKENS: {
    REGISTER: '/device-tokens/register',
    LIST: '/device-tokens',
    REMOVE: deviceId => `/device-tokens/${deviceId}`,
    REMOVE_ALL: '/device-tokens/all',
    TOGGLE: '/device-tokens/toggle-notifications',
    TEST: '/device-tokens/test',
  },

  // Pipelines
  PIPELINES: {
    LIST: '/pipelines',
    LEADS_BY_PIPELINE: pipelineId => `/leads?pipelineId=${pipelineId}`,
  },

  // Products
  PRODUCTS: {
    LIST: '/products',
    DETAIL: id => `/products/${id}`,
  },

  // Deal Stages
  DEAL_STAGES: {
    LIST: '/deal-stages',
  },

  // Lead Tags
  LEAD_TAGS: {
    LIST: '/lead-tags',
  },

  // Lead Sources
  LEAD_SOURCES: {
    LIST: '/lead-sources',
  },



  // Reports
  REPORTS: {
    CRM_OVERVIEW: '/reports/crm-overview',
    TEAM_PERFORMANCE: '/reports/team-performance',
    FORECAST: '/reports/forecast',
    SMART_CALL_DASHBOARD:
      '/settings/calling-integration/webhook-delivery-dashboard',
  },

  // AI Assistant
  AI: {
    SESSIONS: '/ai/chat/sessions',
    SESSION_HISTORY: sessionId => `/ai/chat/history/${sessionId}`,
    HISTORY: '/ai/chat/history',
    MESSAGE: '/ai/chat/message',
    PLAN_STATUS: '/ai/plan-status',
    DELETE_SESSION: sessionId => `/ai/chat/sessions/${sessionId}`,
  },

  // Notes
  NOTES: {
    CREATE: '/notes',
    LIST: '/notes',
    DETAIL: id => `/notes/${id}`,
    UPDATE: id => `/notes/${id}`,
    DELETE: id => `/notes/${id}`,
    ADD_COMMENT: id => `/notes/${id}/comments`,
  },
};

// Request timeout (in milliseconds)
export const API_TIMEOUT = 30000;

// Response status codes
export const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500,
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  API_TIMEOUT,
  STATUS_CODES,
};
