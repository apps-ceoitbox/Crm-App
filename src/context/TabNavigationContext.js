/**
 * Tab Navigation Context
 * Manages drawer state, dynamic screen selection, and icon ordering
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ROUTES } from '../constants';

// All screens available in the bottom drawer
// Order: Follow Up, Leads, Pipeline, Tasks (first row), then others
export const ALL_DRAWER_SCREENS = [
    {
        id: 'followUp',
        title: 'Follow Up',
        subtitle: 'Automation',
        icon: 'time',
        iconColor: '#ec4899',
        route: ROUTES.FOLLOW_UP_ENGINE,
    },
    {
        id: 'leads',
        title: 'Leads',
        subtitle: 'Manage leads',
        icon: 'star',
        iconColor: '#3b82f6',
        route: ROUTES.LEADS,
    },
    {
        id: 'pipeline',
        title: 'Pipeline',
        subtitle: 'Sales pipeline',
        icon: 'trending-up',
        iconColor: '#10b981',
        route: ROUTES.PIPELINE,
    },
    {
        id: 'tasks',
        title: 'Tasks',
        subtitle: 'Manage tasks',
        icon: 'clipboard',
        iconColor: '#f59e0b',
        route: ROUTES.TASKS,
    },
    {
        id: 'companies',
        title: 'Companies',
        subtitle: 'Company profiles',
        icon: 'business',
        iconColor: '#8b5cf6',
        route: ROUTES.COMPANY,
    },
    {
        id: 'contacts',
        title: 'Contacts',
        subtitle: 'CRM contacts',
        icon: 'people',
        iconColor: '#ef4444',
        route: ROUTES.CONTACTS,
    },
    {
        id: 'reports',
        title: 'Reports',
        subtitle: 'Analytics',
        icon: 'bar-chart',
        iconColor: '#06b6d4',
        route: ROUTES.REPORTS,
    },
    // {
    //     id: 'profile',
    //     title: 'Profile',
    //     subtitle: 'Your profile',
    //     icon: 'account-circle',
    //     iconColor: '#64748b',
    //     route: ROUTES.PROFILE,
    // },
];

// Default first row screens (first 4): Follow Up, Leads, Pipeline, Tasks
const DEFAULT_FIRST_ROW_IDS = ['followUp', 'leads', 'pipeline', 'tasks'];

const TabNavigationContext = createContext(null);

export const TabNavigationProvider = ({ children }) => {
    // Drawer expansion state
    const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);

    // Currently active screen ID - default to Follow Up
    const [activeScreenId, setActiveScreenId] = useState('followUp');

    // Order of screens - active screen gets moved to first row
    const [screenOrder, setScreenOrder] = useState(
        ALL_DRAWER_SCREENS.map(s => s.id)
    );

    // Toggle drawer expansion
    const toggleDrawer = useCallback((expanded) => {
        if (typeof expanded === 'boolean') {
            setIsDrawerExpanded(expanded);
        } else {
            setIsDrawerExpanded(prev => !prev);
        }
    }, []);

    // Collapse drawer
    const collapseDrawer = useCallback(() => {
        setIsDrawerExpanded(false);
    }, []);

    // Expand drawer
    const expandDrawer = useCallback(() => {
        setIsDrawerExpanded(true);
    }, []);

    // Select a screen - move it to first row if not already there
    const selectScreen = useCallback((screen) => {
        setActiveScreenId(screen.id);

        // Reorder screens to put selected screen in first row
        setScreenOrder(prevOrder => {
            const currentIndex = prevOrder.indexOf(screen.id);

            // If already in first row (first 4), don't change order
            if (currentIndex < 4) {
                return prevOrder;
            }

            // Move selected screen to position 3 (4th position, last in first row)
            const newOrder = [...prevOrder];
            newOrder.splice(currentIndex, 1); // Remove from current position
            newOrder.splice(3, 0, screen.id); // Insert at position 3

            return newOrder;
        });

        // Collapse drawer after selection
        setIsDrawerExpanded(false);
    }, []);

    // Check if a screen is currently active
    const isScreenActive = useCallback((screenId) => {
        return activeScreenId === screenId;
    }, [activeScreenId]);

    // Get ordered screens based on current order
    const orderedScreens = useMemo(() => {
        return screenOrder.map(id =>
            ALL_DRAWER_SCREENS.find(s => s.id === id)
        ).filter(Boolean);
    }, [screenOrder]);

    // Get current active screen object
    const activeScreen = useMemo(() => {
        return ALL_DRAWER_SCREENS.find(s => s.id === activeScreenId) || ALL_DRAWER_SCREENS[0];
    }, [activeScreenId]);

    // Get screens in the first row (visible when collapsed)
    const firstRowScreens = useMemo(() => {
        return orderedScreens.slice(0, 4);
    }, [orderedScreens]);

    const value = {
        // Drawer state
        isDrawerExpanded,
        toggleDrawer,
        collapseDrawer,
        expandDrawer,

        // Screen selection
        activeScreenId,
        activeScreen,
        selectScreen,
        isScreenActive,

        // Ordered screens
        orderedScreens,
        firstRowScreens,

        // All available screens
        allScreens: ALL_DRAWER_SCREENS,
    };

    return (
        <TabNavigationContext.Provider value={value}>
            {children}
        </TabNavigationContext.Provider>
    );
};

export const useTabNavigation = () => {
    const context = useContext(TabNavigationContext);
    if (!context) {
        throw new Error('useTabNavigation must be used within a TabNavigationProvider');
    }
    return context;
};

export default TabNavigationContext;
