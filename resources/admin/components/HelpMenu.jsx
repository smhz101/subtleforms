import { Dropdown, Button, MenuGroup, MenuItem } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { MergeTagsModal } from './merge-tags/MergeTagsHelp';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import { getBranding } from '../utils/branding';
import './HelpMenu.scss';

export default function HelpMenu({
  onStartTour,
  onOpenWizard,
  showWizard = false,
}) {
  const [showTags, setShowTags] = useState(false);
  return (
    <>
    <Dropdown
      className='subtleforms-help-menu'
      contentClassName='subtleforms-help-menu__content'
      popoverProps={{ placement: 'bottom-end' }}
      renderToggle={({ isOpen, onToggle }) => (
        <Button
          onClick={onToggle}
          aria-expanded={isOpen}
          variant='tertiary'
          icon={<Icon.HelpCircle size={18} className='sf-help-menu__icon' />}
          className='sf-help-menu__button'
          label={__('Help & tour', 'subtleforms')}
          showTooltip
        />
      )}
      renderContent={({ onClose }) => (
        <MenuGroup>
          {onStartTour && (
            <MenuItem
              icon={<Icon.Play size={16} />}
              onClick={onStartTour}>
              {__('Start Tour', 'subtleforms')}
            </MenuItem>
          )}
          {showWizard && onOpenWizard && (
            <MenuItem
              icon={<Icon.Zap size={16} />}
              onClick={() => {
                onClose();
                onOpenWizard();
              }}>
              {__('Quick Start Wizard', 'subtleforms')}
            </MenuItem>
          )}
          <MenuItem
            icon={<Icon.Mail size={16} />}
            onClick={() => {
              onClose();
              setShowTags(true);
            }}>
            {__('Email merge tags', 'subtleforms')}
          </MenuItem>
          {/* White label hides SubtleForms documentation links (2.3.0). */}
          {!getBranding().hideCredits && (
            <MenuItem
              icon={<Icon.Book size={16} />}
              onClick={() => {
                window.open('https://subtleforms.com/docs', '_blank');
              }}>
              {__('View Documentation', 'subtleforms')}
            </MenuItem>
          )}
        </MenuGroup>
      )}
    />
    {showTags && <MergeTagsModal onClose={() => setShowTags(false)} />}
    </>
  );
}
