import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { ROUTES } from '../constants';
import SalesModule from './SalesModule';
import MarketingModule from './MarketingModule';
import CustomDrawerContent from '../components/navigation/CustomDrawerContent';
import { Colors } from '../constants/Colors';
import { ms } from '../utils/Responsive';

const Drawer = createDrawerNavigator();

const DrawerNavigator = () => {
    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerType: 'slide',
                drawerStyle: {
                    width: '80%',
                    backgroundColor: Colors.surface,
                },
                swipeEdgeWidth: 100,
            }}
            initialRouteName={ROUTES.SALES_MODULE}
        >
            <Drawer.Screen
                name={ROUTES.SALES_MODULE}
                component={SalesModule}
                options={{ title: 'Sales' }}
            />
            <Drawer.Screen
                name={ROUTES.MARKETING_MODULE}
                component={MarketingModule}
                options={{ title: 'Marketing' }}
            />
        </Drawer.Navigator>
    );
};

export default DrawerNavigator;
