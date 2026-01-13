import { Dropdown, Button, MenuGroup, MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from './ui/Icon';
import './HelpMenu.scss';

export default function HelpMenu({
  onStartTour,
  onOpenWizard,
  showWizard = false,
}) {
  return (
    <Dropdown
      className='subtleforms-help-menu'
      contentClassName='subtleforms-help-menu__content'
      popoverProps={{ placement: 'bottom-end' }}
      renderToggle={({ isOpen, onToggle }) => (
        <Button
          onClick={onToggle}
          aria-expanded={isOpen}
          variant='primary'
          icon={<Icon.HelpCircle className='sf-help-menu__icon' />}
          className='sf-help-menu__button'
          title={__('Help & Documentation', 'subtleforms')}
        />
      )}
      renderContent={() => (
        <MenuGroup>
          {onStartTour && (
            <MenuItem
              icon={<Icon.Play className='sf-help-menu__menu-icon' />}
              onClick={onStartTour}>
              {__('Start Tour', 'subtleforms')}
            </MenuItem>
          )}
          {showWizard && onOpenWizard && (
            <MenuItem
              icon={<Icon.Zap className='sf-help-menu__menu-icon' />}
              onClick={onOpenWizard}>
              {__('Quick Start Wizard', 'subtleforms')}
            </MenuItem>
          )}
          <MenuItem
            icon={<Icon.Book className='sf-help-menu__menu-icon' />}
            onClick={() => {
              // Placeholder for documentation
              window.open('https://subtleforms.com/docs', '_blank');
            }}>
            {__('View Documentation', 'subtleforms')}
          </MenuItem>
        </MenuGroup>
      )}
    />
  );
}
