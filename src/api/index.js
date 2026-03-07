/**
 * API Module
 * Exports all API-related modules
 */

// Axios client with interceptors
export { default as apiClient } from './interceptor';
export {
  setNavigationRef,
  getErrorMessage,
  isNetworkError,
  isAuthError,
} from './interceptor';

// API Configuration
export {
  API_BASE_URL,
  API_ENDPOINTS,
  API_TIMEOUT,
  STATUS_CODES,
} from './config';

// API Services
export {
  authAPI,
  SystemConfigAPI,
  userAPI,
  leadsAPI,
  tasksAPI,
  dashboardAPI,
  notificationsAPI,
  companiesAPI,
  contactsAPI,
  deviceTokensAPI,
  settingsAPI,
  followUpAPI,
  pipelineAPI,
  reportsAPI,
  aiAPI,
  productsAPI,
  dealStagesAPI,
  leadTagsAPI,
  leadSourcesAPI,
  usersAPI,
} from './services';
export { default as API } from './services';
