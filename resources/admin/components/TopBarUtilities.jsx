import { __, sprintf } from '@wordpress/i18n';
import {
  Dropdown,
  Button,
  MenuGroup,
  MenuItem,
} from '@wordpress/components';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import { getBranding } from '../utils/branding';

/**
 * Right-hand side of the top bar: plan status and help.
 *
 * Kept deliberately small. Page actions (New form, Save, Export…) live in each
 * page's header where they belong; the top bar only carries what is true on
 * every screen.
 */
export default function TopBarUtilities() {
  const branding = getBranding();
  return (
    <div className='sf-topbar-utils'>
      {!branding.hideUpgrade && <PlanChip />}
      {!branding.hideHelp && <HelpDropdown />}
    </div>
  );
}

/**
 * Plan chip.
 *
 * - Licensed Pro   → a quiet "Pro" chip.
 * - Pro installed  → "Activate Pro", which opens the License settings tab.
 * - Free           → "Upgrade", linking to the Pro page.
 */
export function PlanChip() {
  const navigate = useNavigate();
  const admin = window.subtleformsAdmin || {};
  const license = admin.license || null;
  const isLicensed =
    !!license &&
    (license.connected === true ||
      ['valid', 'active', 'grace_period'].includes(license.status));

  if (isLicensed) {
    const plan = license.plan && license.plan !== 'free' ? license.plan : 'pro';
    return (
      <span
        className='sf-plan-chip sf-plan-chip--active'
        title={sprintf(
          /* translators: %s: plan name */
          __('SubtleForms %s is active', 'subtleforms'),
          plan.charAt(0).toUpperCase() + plan.slice(1)
        )}>
        <Icon.Crown size={14} aria-hidden='true' />
        <span>{plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
      </span>
    );
  }

  if (admin.hasProPlugin) {
    return (
      <a
        href='admin.php?page=subtleforms-settings#tab=license'
        className='sf-plan-chip sf-plan-chip--pending'
        onClick={(event) => {
          event.preventDefault();
          window.location.hash = 'tab=license';
          navigate('/settings');
        }}>
        <Icon.KeyRound size={14} aria-hidden='true' />
        <span>{__('Activate Pro', 'subtleforms')}</span>
      </a>
    );
  }

  return (
    <a
      href='https://subtleforms.com/pro'
      target='_blank'
      rel='noopener noreferrer'
      className='sf-plan-chip sf-plan-chip--upgrade'>
      <Icon.Sparkles size={14} aria-hidden='true' />
      <span>{__('Upgrade to Pro', 'subtleforms')}</span>
    </a>
  );
}

function HelpDropdown() {
  const version = window.subtleformsAdmin?.version;
  const { name, hideCredits } = getBranding();

  return (
    <Dropdown
      className='sf-help'
      contentClassName='sf-help__popover'
      popoverProps={{ placement: 'bottom-end', offset: 8 }}
      renderToggle={({ isOpen, onToggle }) => (
        <Button
          className='sf-topbar-icon-button'
          onClick={onToggle}
          aria-expanded={isOpen}
          icon={<Icon.HelpCircle size={20} />}
          label={__('Help', 'subtleforms')}
          showTooltip
        />
      )}
      renderContent={() => (
        <>
          <MenuGroup>
            <MenuItem
              icon={<Icon.Book size={18} />}
              iconPosition='left'
              href='https://subtleforms.com/docs'
              target='_blank'
              rel='noopener noreferrer'>
              {__('Documentation', 'subtleforms')}
            </MenuItem>
            <MenuItem
              icon={<Icon.MessageCircle size={18} />}
              iconPosition='left'
              href='https://subtleforms.com/support'
              target='_blank'
              rel='noopener noreferrer'>
              {__('Get support', 'subtleforms')}
            </MenuItem>
            <MenuItem
              icon={<Icon.Sparkles size={18} />}
              iconPosition='left'
              href='https://subtleforms.com/changelog'
              target='_blank'
              rel='noopener noreferrer'>
              {__("What's new", 'subtleforms')}
            </MenuItem>
          </MenuGroup>
          {version && !hideCredits && (
            <div className='sf-help__version'>
              {sprintf(
                /* translators: 1: plugin name, 2: version number */
                __('%1$s %2$s', 'subtleforms'),
                name,
                version
              )}
            </div>
          )}
        </>
      )}
    />
  );
}
