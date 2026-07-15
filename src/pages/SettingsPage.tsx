import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonRange,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { AIRCRAFT_CATEGORIES } from '../types/aircraft';
import { aircraftUrl, MARKER_ATTRIBUTES, MARKER_LINE_COUNT } from '../services/settings';
import { MAP_LAYERS, type MapLayerKey } from '../services/mapLayers';
import { useApp } from '../state/AppContext';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  const { settings, updateSettings, error, lastUpdate } = useApp();
  // Entwurfswerte während des Tippens: Das 2-s-Polling rendert die Seite
  // laufend neu; ohne per-Tastendruck synchronisierten Wert würde IonInput
  // das Feld dabei auf den alten gespeicherten Wert zurücksetzen.
  const [ipDraft, setIpDraft] = useState<string | null>(null);
  const [portDraft, setPortDraft] = useState<string | null>(null);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Einstellungen</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="grouped-content">
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Einstellungen</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonList inset>
          <IonListHeader>
            <IonLabel>Aircraft Service (Raspberry Pi)</IonLabel>
          </IonListHeader>
            <IonItem>
              <IonInput
                label="IP-Adresse"
                labelPlacement="fixed"
                inputmode="decimal"
                placeholder="192.168.1.174"
                value={ipDraft ?? settings.ip}
                onIonInput={(e) => setIpDraft(e.detail.value ?? '')}
                onIonChange={(e) => {
                  updateSettings({ ip: (e.detail.value ?? '').trim() });
                  setIpDraft(null);
                }}
              />
            </IonItem>
            <IonItem>
              <IonInput
                label="Port"
                labelPlacement="fixed"
                type="number"
                placeholder="8080"
                value={portDraft ?? settings.port}
                onIonInput={(e) => setPortDraft(e.detail.value ?? '')}
                onIonChange={(e) => {
                  const port = parseInt(e.detail.value ?? '', 10);
                  if (!Number.isNaN(port) && port > 0 && port <= 65535) {
                    updateSettings({ port });
                  }
                  setPortDraft(null);
                }}
              />
            </IonItem>
        </IonList>
        <div className="settings-note">
          <IonNote>
            Quelle: {aircraftUrl(settings)}
            <br />
            Status:{' '}
            {error
            ? `Fehler – ${error}`
            : lastUpdate
            ? `Verbunden (${new Date(lastUpdate).toLocaleTimeString('de-CH')})`
            : 'Verbinde…'}
          </IonNote>
        </div>

        <IonList inset>
          <IonListHeader>
            <IonLabel>Aktualisierung</IonLabel>
          </IonListHeader>
            <IonItem>
              <IonRange
                label={`Intervall: ${settings.refreshInterval} s`}
                labelPlacement="stacked"
                min={1}
                max={30}
                step={1}
                snaps
                pin
                value={settings.refreshInterval}
                onIonChange={(e) =>
                  updateSettings({ refreshInterval: e.detail.value as number })
                }
              />
            </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader>
            <IonLabel>Karte</IonLabel>
          </IonListHeader>
            <IonItem>
              <IonSelect
                label="Karten-Hintergrund"
                labelPlacement="stacked"
                okText="OK"
                cancelText="Abbrechen"
                value={settings.mapLayer}
                onIonChange={(e) =>
                  updateSettings({ mapLayer: e.detail.value as MapLayerKey })
                }
              >
                {Object.entries(MAP_LAYERS).map(([key, label]) => (
                  <IonSelectOption key={key} value={key}>
                    {label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
        </IonList>
        <div className="settings-note">
          <IonNote>
            «Automatisch» folgt dem Hell-/Dunkel-Modus des Geräts (Carto hell bzw.
            dunkel). Die Auswahl wird wie alle Einstellungen lokal auf dem Gerät
            gespeichert.
          </IonNote>
        </div>

        <IonList inset>
          <IonListHeader>
            <IonLabel>Flugzeug-Beschriftung auf der Karte</IonLabel>
          </IonListHeader>
            {Array.from({ length: MARKER_LINE_COUNT }, (_, line) => (
              <IonItem key={line}>
                <IonSelect
                  label={`Zeile ${line + 1}`}
                  labelPlacement="fixed"
                  multiple
                  placeholder="Keine"
                  okText="OK"
                  cancelText="Abbrechen"
                  value={settings.markerLineTags[line] ?? []}
                  onIonChange={(e) => {
                    const tags = Array.from(
                      { length: MARKER_LINE_COUNT },
                      (_, i) => settings.markerLineTags[i] ?? []
                    );
                    tags[line] = (e.detail.value as string[]) ?? [];
                    updateSettings({ markerLineTags: tags });
                  }}
                >
                  {Object.entries(MARKER_ATTRIBUTES).map(([key, label]) => (
                    <IonSelectOption key={key} value={key}>
                      {label}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            ))}
        </IonList>
        <div className="settings-note">
          <IonNote>
            Pro Zeile können mehrere Attribute gewählt werden; sie werden mit
            «&nbsp;·&nbsp;» getrennt unter dem Flugzeug-Icon angezeigt. Keine Auswahl
            blendet die Zeile aus; fehlende Werte (z.&nbsp;B. ohne Routendaten) werden
            übersprungen.
          </IonNote>
        </div>

        <IonList inset>
          <IonListHeader>
            <IonLabel>Filter</IonLabel>
          </IonListHeader>
            <IonItem>
              <IonSelect
                label="Flugzeug-Kategorien"
                labelPlacement="stacked"
                multiple
                placeholder="Alle Kategorien"
                okText="OK"
                cancelText="Abbrechen"
                value={settings.categories}
                onIonChange={(e) =>
                  updateSettings({ categories: (e.detail.value as string[]) ?? [] })
                }
              >
                {Object.entries(AIRCRAFT_CATEGORIES).map(([key, label]) => (
                  <IonSelectOption key={key} value={key}>
                    {label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
        </IonList>
        <div className="settings-note">
          <IonNote>
            Keine Auswahl = alle Flugzeuge anzeigen. «Ohne Kategorie» zeigt Flugzeuge,
            die keine ADS-B Kategorie senden.
          </IonNote>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
