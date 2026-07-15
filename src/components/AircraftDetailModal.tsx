import React from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { mapOutline } from 'ionicons/icons';
import type { Aircraft } from '../types/aircraft';
import {
  callsignOf,
  formatAltitude,
  formatSpeed,
  formatVerticalRate,
} from '../types/aircraft';
import { AIRCRAFT_CATEGORIES } from '../types/aircraft';
import {
  flagEmoji,
  formatAircraftDetails,
  formatRoute,
  type Enrichment,
  type RouteAirport,
} from '../services/adsbdbService';
import './AircraftDetailModal.css';

interface Props {
  aircraft: Aircraft | null;
  enrichment?: Enrichment;
  presentingElement?: HTMLElement | null;
  /**
   * Als Sheet-Modal darstellen (Karte): startet bei Breakpoint 0.25 mit
   * kompakter Zusammenfassung, die Karte bleibt dahinter bedienbar.
   */
  sheet?: boolean;
  /** Wenn gesetzt: «Karte»-Button in der Toolbar, der das Flugzeug auf der Karte zeigt */
  onShowOnMap?: () => void;
  onDismiss: () => void;
}

function formatAirport(airport?: RouteAirport): string | null {
  if (!airport) return null;
  const code = [airport.iata_code, airport.icao_code].filter(Boolean).join(' / ');
  const place = [airport.name, airport.municipality, airport.country_name]
    .filter(Boolean)
    .join(', ');
  return [code, place].filter(Boolean).join(' — ') || null;
}

const Row: React.FC<{ label: string; value?: string | null }> = ({ label, value }) =>
  value ? (
    <IonItem>
      <IonLabel color="medium">{label}</IonLabel>
      <IonNote slot="end" className="detail-value">
        {value}
      </IonNote>
    </IonItem>
  ) : null;

const AircraftDetailModal: React.FC<Props> = ({
  aircraft,
  enrichment,
  presentingElement,
  sheet = false,
  onShowOnMap,
  onDismiss,
}) => {
  const route = enrichment?.route;
  const details = enrichment?.details;
  const ac = aircraft;
  const flag = flagEmoji(details?.registered_owner_country_iso_name);
  const aircraftInfo = formatAircraftDetails(details);
  const routeInfo = formatRoute(route);

  return (
    <IonModal
      isOpen={ac !== null}
      onDidDismiss={onDismiss}
      {...(sheet
        ? {
            breakpoints: [0, 0.25, 0.5, 0.9],
            initialBreakpoint: 0.25,
            // Unterhalb dieses Breakpoints kein Backdrop – Karte bleibt bedienbar
            backdropBreakpoint: 0.5,
          }
        : { presentingElement: presentingElement ?? undefined })}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{ac ? callsignOf(ac) : ''}</IonTitle>
          <IonButtons slot="secondary">
            <IonButton onClick={onDismiss}>Schliessen</IonButton>
          </IonButtons>
          {onShowOnMap && (
            <IonButtons slot="primary">
              <IonButton onClick={onShowOnMap}>
                <IonIcon slot="start" icon={mapOutline} />
                Karte
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="grouped-content">
        {ac && (
          <>
            {sheet ? (
              // Kompakte Zusammenfassung, sichtbar beim 0.25-Breakpoint
              <div className="sheet-summary">
                {aircraftInfo && <div className="sheet-aircraft">{aircraftInfo}</div>}
                {routeInfo && <div className="sheet-route">{routeInfo}</div>}
                <div className="sheet-stats">
                  {formatAltitude(ac.alt_baro)}
                  {ac.gs != null && ` · ${formatSpeed(ac.gs)}`}
                  {ac.track != null && ` · ${Math.round(ac.track)}°`}
                </div>
              </div>
            ) : (
              <IonHeader collapse="condense">
                <IonToolbar>
                  <IonTitle size="large">
                    {flag ? `${flag} ` : ''}
                    {callsignOf(ac)}
                  </IonTitle>
                </IonToolbar>
                {aircraftInfo && <div className="modal-subtitle">{aircraftInfo}</div>}
              </IonHeader>
            )}

            <IonList inset>
              <IonListHeader>
                <IonLabel>Route</IonLabel>
              </IonListHeader>
              <Row label="Airline" value={route?.airline?.name} />
              <Row label="Abflughafen" value={formatAirport(route?.origin)} />
              <Row label="Zielflughafen" value={formatAirport(route?.destination)} />
              {!route?.origin && !route?.destination && (
                <IonItem lines="none">
                  <IonNote>
                    Keine Routendaten verfügbar (z.&nbsp;B. Militär-, Regierungs- oder
                    Privatflug).
                  </IonNote>
                </IonItem>
              )}
            </IonList>

            <IonList inset>
              <IonListHeader>
                <IonLabel>Flugzeug</IonLabel>
              </IonListHeader>
              <Row label="Hersteller" value={details?.manufacturer} />
              <Row label="Typ" value={details?.type} />
              <Row label="ICAO-Typ" value={details?.icao_type} />
              <Row label="Registration" value={details?.registration} />
              <Row label="Betreiber" value={details?.registered_owner} />
              <Row
                label="Land"
                value={
                  details?.registered_owner_country_name
                    ? `${flag ? `${flag} ` : ''}${details.registered_owner_country_name}`
                    : null
                }
              />
              <Row
                label="Kategorie"
                value={ac.category ? AIRCRAFT_CATEGORIES[ac.category] ?? ac.category : null}
              />
              {!details?.type && !details?.registration && (
                <IonItem lines="none">
                  <IonNote>Keine Flugzeugdaten in adsbdb.com gefunden.</IonNote>
                </IonItem>
              )}
            </IonList>

            <IonList inset>
              <IonListHeader>
                <IonLabel>Live-Daten</IonLabel>
              </IonListHeader>
              <Row label="ICAO Hex" value={ac.hex.toUpperCase()} />
              <Row label="Höhe (barometrisch)" value={formatAltitude(ac.alt_baro)} />
              <Row
                label="Höhe (GPS)"
                value={ac.alt_geom != null ? formatAltitude(ac.alt_geom) : null}
              />
              <Row
                label="Geschwindigkeit"
                value={ac.gs != null ? formatSpeed(ac.gs) : null}
              />
              <Row label="Kurs" value={ac.track != null ? `${Math.round(ac.track)}°` : null} />
              <Row
                label="Steig-/Sinkrate"
                value={ac.baro_rate != null ? formatVerticalRate(ac.baro_rate) : null}
              />
              <Row label="Squawk" value={ac.squawk} />
              <Row
                label="Notfall"
                value={ac.emergency && ac.emergency !== 'none' ? ac.emergency : null}
              />
              <Row label="Signal" value={ac.rssi != null ? `${ac.rssi} dBFS` : null} />
              <Row
                label="Messages"
                value={ac.messages != null ? ac.messages.toLocaleString('de-CH') : null}
              />
              <Row
                label="Zuletzt empfangen"
                value={ac.seen != null ? `vor ${Math.round(ac.seen)} s` : null}
              />
            </IonList>
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default AircraftDetailModal;
