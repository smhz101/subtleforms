import { Dropdown, Button, MenuGroup, MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from './ui/Icon';

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
          icon={<Icon.HelpCircle className='sf-fill-none sf-w-5 sf-h-5' />}
          className='sf-px-3 sf-h-9'
          title={__('Help & Documentation', 'subtleforms')}
        />
      )}
      renderContent={() => (
        <MenuGroup>
          {onStartTour && (
            <MenuItem
              icon={<Icon.Play className='sf-fill-none sf-w-4 sf-h-4' />}
              onClick={onStartTour}>
              {__('Start Tour', 'subtleforms')}
            </MenuItem>
          )}
          {showWizard && onOpenWizard && (
            <MenuItem
              icon={<Icon.Zap className='sf-fill-none sf-w-4 sf-h-4' />}
              onClick={onOpenWizard}>
              {__('Quick Start Wizard', 'subtleforms')}
            </MenuItem>
          )}
          <MenuItem
            icon={<Icon.Book className='sf-fill-none sf-w-4 sf-h-4' />}
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
