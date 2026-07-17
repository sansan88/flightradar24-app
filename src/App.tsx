import React, { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  mapOutline,
  appsOutline,
  listOutline,
  settingsOutline,
  informationCircleOutline,
} from 'ionicons/icons';

import MapPage from './pages/MapPage';
import RetroPage from './pages/RetroPage';
import ListPage from './pages/ListPage';
import SettingsPage from './pages/SettingsPage';
import InfoPage from './pages/InfoPage';
import WelcomeScreen from './components/WelcomeScreen';
import ConnectionToast from './components/ConnectionToast';
import { AppProvider } from './state/AppContext';

/* Ionic Core CSS */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Dark Mode automatisch nach Geräteeinstellung (prefers-color-scheme) */
import '@ionic/react/css/palettes/dark.system.css';

import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Statusbar-Textfarbe folgt dem System-Theme; Splash erst ausblenden,
    // wenn die App gerendert ist (launchAutoHide: false in capacitor.config.ts).
    StatusBar.setStyle({ style: Style.Default }).catch(() => undefined);
    SplashScreen.hide().catch(() => undefined);
  }, []);

  return (
  <IonApp>
    <AppProvider>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/map" component={MapPage} />
            <Route exact path="/retro" component={RetroPage} />
            <Route exact path="/list" component={ListPage} />
            <Route exact path="/settings" component={SettingsPage} />
            <Route exact path="/info" component={InfoPage} />
            <Route exact path="/">
              <Redirect to="/map" />
            </Route>
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="map" href="/map">
              <IonIcon icon={mapOutline} />
              <IonLabel>Karte</IonLabel>
            </IonTabButton>
            <IonTabButton tab="retro" href="/retro">
              <IonIcon icon={appsOutline} />
              <IonLabel>Retro</IonLabel>
            </IonTabButton>
            <IonTabButton tab="list" href="/list">
              <IonIcon icon={listOutline} />
              <IonLabel>Flugzeuge</IonLabel>
            </IonTabButton>
            <IonTabButton tab="settings" href="/settings">
              <IonIcon icon={settingsOutline} />
              <IonLabel>Einstellungen</IonLabel>
            </IonTabButton>
            <IonTabButton tab="info" href="/info">
              <IonIcon icon={informationCircleOutline} />
              <IonLabel>Info</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
      <WelcomeScreen />
      <ConnectionToast />
    </AppProvider>
  </IonApp>
  );
};

export default App;
