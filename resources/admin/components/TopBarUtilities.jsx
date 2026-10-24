import { __, sprintf } from '@wordpress/i18n';
import {
  Dropdown,
  Button,
  MenuGroup,
  MenuItem,
} from '@wordpress/components';
import Icon from '../ui/Icon';
import { getBranding, supportUrl } from '../utils/branding';

/**
 * Right-hand side of the top bar: help.
 *
 * Kept deliberately small. Page actions (New form, Save, Export…) live in each
 * page's header where they belong; the top bar only carries what is true on
 * every screen.
 */
export default function TopBarUtilities() {
  const branding = getBranding();
  if (branding.hideHelp && !branding.supportUrl) {
    return null;
  }
  return (
    <div className='sf-topbar-utils'>
      <HelpDropdown />
    </div>
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
            {!hideCredits && (
              <MenuItem
                icon={<Icon.Book size={18} />}
                iconPosition='left'
                href='https://subtleforms.com/docs'
                target='_blank'
                rel='noopener noreferrer'>
                {__('Documentation', 'subtleforms')}
              </MenuItem>
            )}
            <MenuItem
              icon={<Icon.MessageCircle size={18} />}
              iconPosition='left'
              href={supportUrl()}
              target='_blank'
              rel='noopener noreferrer'>
              {__('Get support', 'subtleforms')}
            </MenuItem>
            {!hideCredits && (
              <MenuItem
                icon={<Icon.Sparkles size={18} />}
                iconPosition='left'
                href='https://subtleforms.com/changelog'
                target='_blank'
                rel='noopener noreferrer'>
                {__("What's new", 'subtleforms')}
              </MenuItem>
            )}
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
