import { useCallback, useEffect, useMemo, useState } from "@wordpress/element";
import { Spinner } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import SectionHeader from "../../sectionPanel/SectionHeader";
import ServiceTileGrid from "../serviceTiles/ServiceTileGrid";
import ServiceDetailHeader from "../serviceTiles/ServiceDetailHeader";
import ExtensionSlot from "../../ExtensionSlot";
import CrmProBanner from "./CrmProBanner";
import { announceService, isConnected, pageData } from "./api";
import {
  useServiceState,
  useSetServiceEnabled,
  useStoreServiceState,
} from "./queries";
import { getCrmServices } from "../../../../shared/extend";
import "./registerBuiltins";
import "../emailMarketing/emailMarketing.scss";

/**
 * The slug in the address (`#tab=extensions&ext=crm&service=hubspot`).
 *
 * @return {string} Slug, or '' for the grid.
 */
export function serviceFromHash() {
  const match = window.location.hash.match(/[#&]service=([\w-]+)/);
  return match ? match[1] : "";
}

/**
 * Put the service in the address. A new entry is added to the history, so the
 * browser's Back button returns to the grid; a refresh stays on the service.
 *
 * @param {string} slug Slug, or '' for the grid.
 */
export function writeServiceToHash(slug) {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (slug) {
    params.set("service", slug);
  } else {
    params.delete("service");
  }
  window.history.pushState(null, "", `#${params.toString()}`);
}

/**
 * One CRM's screen, drawn in place of the grid: a header (back arrow, logo,
 * name, switch), the service's settings, whatever an add-on draws in the
 * `crm.service.settings` slot, and the note about Pro.
 *
 * @param {Object}   props
 * @param {Object}   props.service  Registered service.
 * @param {Function} props.onBack   Return to the grid.
 * @param {Function} props.onToggle Called with (slug, enabled) after the switch changed on the server.
 * @param {boolean}  props.enabled  The switch, as the grid last knew it.
 */
function CrmServiceDetail({ service, onBack, onToggle, enabled }) {
  const { data: connection, error: queryError } = useServiceState(service.slug);
  const storeState = useStoreServiceState();
  const setEnabled = useSetServiceEnabled();
  const [error, setError] = useState("");
  const loadError =
    queryError && !connection
      ? queryError.message ||
        __("Could not load the connection.", "subtleforms")
      : "";
  const Settings = service.settingsComponent;

  const toggle = async (next) => {
    setError("");
    try {
      await setEnabled.mutateAsync({ service: service.slug, enabled: next });
      announceService(service.slug, { enabled: next });
      onToggle(service.slug, next);
      if (!next) onBack();
    } catch (e) {
      setError(e?.message || __("Could not change the switch.", "subtleforms"));
    }
  };

  return (
    <div className="sf-em-detail sf-crm-detail" data-service={service.slug}>
      <ServiceDetailHeader
        id={`sf-crm-toggle-${service.slug}`}
        label={service.label}
        logo={service.icon}
        brandColor={service.brandColor}
        enabled={!!enabled}
        busy={setEnabled.isPending}
        backLabel={__("Back to CRM", "subtleforms")}
        onBack={onBack}
        onToggle={toggle}
      />

      {error && (
        <p role="alert" className="sf-em-detail__error">
          {error}
        </p>
      )}

      <div className="sf-em-detail__body">
        {loadError && <p className="sf-em-card__error">{loadError}</p>}
        {!loadError && !connection && (
          <p role="status" className="sf-em-card__loading">
            <Spinner /> {__("Loading…", "subtleforms")}
          </p>
        )}
        {connection && Settings && (
          <Settings
            service={service.slug}
            connection={connection}
            onConnection={(next) => storeState(service.slug, next)}
          />
        )}
        {connection && (
          <ExtensionSlot
            name="crm.service.settings"
            service={service.slug}
            connected={isConnected(connection)}
          />
        )}
      </div>
      <CrmProBanner />
    </div>
  );
}

/**
 * Settings > Integrations > CRM: a grid of the CRMs, and the screen of one in
 * its place. Services come from the registry (`registerCrmService`) and the
 * server's list; a tile shows only when both know the slug.
 */
export default function CrmSettings() {
  const [active, setActive] = useState(serviceFromHash);
  const [enabled, setEnabled] = useState(() => {
    const map = {};
    Object.entries(pageData().services).forEach(([slug, entry]) => {
      map[slug] = !!entry?.enabled;
    });
    return map;
  });
  const [busy, setBusy] = useState({});
  const [error, setError] = useState("");
  const setServiceEnabled = useSetServiceEnabled();

  const services = useMemo(() => {
    const server = pageData().services;
    return getCrmServices().filter(
      (s) => server[s.slug] && server[s.slug].available !== false,
    );
    // The registry can grow while the page loads; the list is read again on every address change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The browser's Back and Forward buttons, and a hash edited by hand.
  useEffect(() => {
    const sync = () => setActive(serviceFromHash());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const open = useCallback((slug) => {
    writeServiceToHash(slug);
    setActive(slug);
  }, []);

  const setSwitch = useCallback((slug, value) => {
    setEnabled((current) => ({ ...current, [slug]: value }));
  }, []);

  // Off from the grid just switches the service off. On switches it on and
  // opens its screen, where the token goes.
  const toggleFromGrid = useCallback(
    async (slug, value) => {
      setError("");
      setBusy((current) => ({ ...current, [slug]: true }));
      setSwitch(slug, value);
      try {
        await setServiceEnabled.mutateAsync({ service: slug, enabled: value });
        announceService(slug, { enabled: value });
        if (value) open(slug);
      } catch (e) {
        setSwitch(slug, !value);
        setError(
          e?.message || __("Could not change the switch.", "subtleforms"),
        );
      }
      setBusy((current) => ({ ...current, [slug]: false }));
    },
    [open, setSwitch, setServiceEnabled],
  );

  const current = active ? services.find((s) => s.slug === active) : null;

  if (current) {
    return (
      <div className="sf-ext-panel sf-em sf-crm">
        <CrmServiceDetail
          key={current.slug}
          service={current}
          enabled={!!enabled[current.slug]}
          onToggle={setSwitch}
          onBack={() => open("")}
        />
      </div>
    );
  }

  const items = services.map((service) => ({
    slug: service.slug,
    label: service.label,
    logo: service.icon,
    brandColor: service.brandColor,
    enabled: !!enabled[service.slug],
    statusLabel: "",
  }));

  return (
    <div className="sf-ext-panel sf-em sf-crm">
      <SectionHeader
        title={__("CRM", "subtleforms")}
        description={
          services.length > 1
            ? __(
                "Send contacts to your CRM from the forms you choose.",
                "subtleforms",
              )
            : __(
                "Send contacts to HubSpot from the forms you choose.",
                "subtleforms",
              )
        }
      />
      {error && (
        <p role="alert" className="sf-em-detail__error">
          {error}
        </p>
      )}
      <ServiceTileGrid
        services={items}
        busy={busy}
        onOpen={open}
        onToggle={toggleFromGrid}
      />
      <CrmProBanner />
    </div>
  );
}
