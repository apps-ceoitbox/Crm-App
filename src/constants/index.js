/**
 * Constants Index - Export all constants from a single file
 */

export { Colors, default as ColorsDefault } from './Colors';
export {
    FontFamily,
    FontSize,
    FontWeight,
    LineHeight,
    LetterSpacing,
    TextStyles,
} from './Fonts';
export { Spacing, BorderRadius, Shadow, ZIndex } from './Spacing';

// App-wide constants
export const APP_NAME = 'CRM Pro';
export const APP_VERSION = '1.0.0';

// API Constants (for future use)
export const API_BASE_URL = 'https://api.example.com';
export const API_TIMEOUT = 30000;

// Storage Keys
export const STORAGE_KEYS = {
    AUTH_TOKEN: '@auth_token',
    USER_DATA: '@user_data',
    THEME: '@theme',
    ONBOARDING_COMPLETED: '@onboarding_completed',
    REMEMBER_ME: '@remember_me',
};

// Navigation Routes
export const ROUTES = {
    // Auth Stack
    SPLASH: 'Splash',
    ONBOARDING: 'Onboarding',
    LOGIN: 'Login',
    REGISTER: 'Register',
    FORGOT_PASSWORD: 'ForgotPassword',

    // Main Stack
    MAIN_TABS: 'MainTabs',

    // Company Screens
    EDIT_COMPANY: 'EditCompany',
    ADD_COMPANY: 'AddCompany',
    COMPANY_DETAILS: 'CompanyDetails',
    CONTACT_DETAILS: 'ContactDetails',

    // Tab Screens
    COMPANY: 'Company',
    CONTACTS: 'Contacts',
    LEADS: 'Leads',
    PIPELINE: 'Pipeline',
    TASKS: 'Tasks',
    PROFILE: 'Profile',

    // Detail Screens
    LEAD_DETAILS: 'LeadDetails',
    TASK_DETAILS: 'TaskDetails',
    ADD_LEAD: 'AddLead',
    ADD_TASK: 'AddTask',
    EDIT_LEAD: 'EditLead',
    EDIT_CONTACT: 'EditContact',
    ADD_CONTACT: 'AddContact',
    EDIT_PROFILE: 'EditProfile',
    SETTINGS: 'Settings',
    EDIT_TASK: 'EditTask',
    REPORTS: 'Reports',
    COMPANY_DETAILS: 'CompanyDetails',
    TEAM_PERFORMANCE: 'TeamPerformance',
    FORECAST: 'Forecast',
    SMART_CALL_DASHBOARD: 'SmartCallDashboard',
    FOLLOW_UP_ENGINE: 'FollowUpEngine',
    NOTIFICATIONS: 'Notifications',
    AI_ASSISTANT: 'AIAssistant',
    OVERDUE_DETAIL: 'OverdueDetail',
};



// Lead Status
export const LEAD_STATUS = {
    NEW: 'new',
    CONTACTED: 'contacted',
    QUALIFIED: 'qualified',
    PROPOSAL: 'proposal',
    NEGOTIATION: 'negotiation',
    CLOSED_WON: 'closed_won',
    CLOSED_LOST: 'closed_lost',
};

// Task Priority
export const TASK_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent',
};

// Task Status
export const TASK_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};
