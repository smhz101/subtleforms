import { Dropdown, Button, MenuGroup, MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { FiHelpCircle, FiPlay, FiBook, FiZap } from 'react-icons/fi';

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
          variant='secondary'
          icon={<FiHelpCircle className='w-5 h-5' />}
          className='px-3 h-9'
          title={__('Help & Documentation', 'subtleforms')}
        />
      )}
      renderContent={() => (
        <MenuGroup>
          {onStartTour && (
            <MenuItem
              icon={<FiPlay className='w-4 h-4' />}
              onClick={onStartTour}>
              {__('Start Tour', 'subtleforms')}
            </MenuItem>
          )}
          {showWizard && onOpenWizard && (
            <MenuItem
              icon={<FiZap className='w-4 h-4' />}
              onClick={onOpenWizard}>
              {__('Quick Start Wizard', 'subtleforms')}
            </MenuItem>
          )}
          <MenuItem
            icon={<FiBook className='w-4 h-4' />}
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
