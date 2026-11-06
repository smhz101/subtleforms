import { Button, DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../ui/Icon';
import './RowActions.scss';

/**
 * The actions at the end of a DataTable row.
 *
 * Draws the same `.subtleforms-row-actions` strip as All Forms, so the table
 * shows it on hover and keyboard focus and always on touch screens. An action
 * with an `icon` is an icon button with a tooltip; one without is a short text
 * button; one with `inMenu` goes in the More menu. An action with `href` is a
 * link, with `external` it opens in a new tab.
 *
 * Public: add-ons reach it as `window.SubtleFormsExtend.RowActions`.
 *
 * @param {Object} props
 * @param {Array}  props.actions [{ key, label, icon, onClick, href, external, isDestructive, inMenu, hidden, disabled }]
 * @param {string} props.menuLabel Label of the More button.
 */
export default function RowActions({ actions = [], menuLabel }) {
  const shown = actions.filter((action) => action && !action.hidden);
  const inline = shown.filter((action) => !action.inMenu);
  const menu = shown.filter((action) => action.inMenu);
  const stop = (event) => event.stopPropagation();

  if (!shown.length) {
    return null;
  }

  return (
    <div className='subtleforms-row-actions' onClick={stop} onKeyDown={stop} role='group'>
      {inline.map((action) => {
        const key = action.key || action.label;
        const common = {
          href: action.href,
          target: action.external ? '_blank' : undefined,
          rel: action.external ? 'noopener noreferrer' : undefined,
          onClick: action.onClick,
          disabled: action.disabled,
          accessibleWhenDisabled: true,
        };
        if (action.icon) {
          return (
            <Button
              key={key}
              {...common}
              className={clsx('sf-row-action-btn', { 'is-destructive': action.isDestructive })}
              label={action.label}
              showTooltip
              icon={action.icon}
            />
          );
        }
        return (
          <Button
            key={key}
            {...common}
            className='sf-row-action-link'
            variant='link'
            size='compact'
            isDestructive={action.isDestructive}>
            {action.label}
          </Button>
        );
      })}
      {menu.length > 0 && (
        <DropdownMenu
          icon={<Icon.MoreVertical size={16} />}
          label={menuLabel || __('More actions', 'subtleforms')}
          className='sf-row-action-menu'
          toggleProps={{ size: 'compact' }}
          popoverProps={{ placement: 'bottom-end' }}>
          {({ onClose }) => (
            <MenuGroup>
              {menu.map((action) => (
                <MenuItem
                  key={action.key || action.label}
                  icon={action.icon}
                  isDestructive={action.isDestructive}
                  disabled={action.disabled}
                  href={action.href}
                  target={action.external ? '_blank' : undefined}
                  rel={action.external ? 'noopener noreferrer' : undefined}
                  onClick={() => {
                    onClose();
                    if (action.onClick) {
                      action.onClick();
                    }
                  }}>
                  {action.label}
                </MenuItem>
              ))}
            </MenuGroup>
          )}
        </DropdownMenu>
      )}
    </div>
  );
}
