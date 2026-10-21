import { __ } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import { getUpgradeUrl } from '../../ui/UpgradePrompt';
import { getBranding } from '../../utils/branding';
import { getPlanState } from '../../data/proCatalog';

/**
 * Settings, MCP tab without SubtleForms Pro: what it is and how to get it.
 * Pro replaces this with its own screen (SubtleFormsExtend.registerSettingsTab).
 */
export default function McpPlaceholder() {
  const { hasProPlugin } = getPlanState();
  const showUpgrade = !getBranding().hideUpgrade;

  return (
    <div className='sf-mcp-placeholder sf-panel'>
      <span className='sf-mcp-placeholder__icon' aria-hidden='true'>
        <Icon.Bot size={20} />
      </span>
      <div className='sf-mcp-placeholder__body'>
        <h3 className='sf-mcp-placeholder__title'>{__('Connect an AI assistant', 'subtleforms')}</h3>
        <p>
          {__(
            'MCP lets an AI assistant read your forms and entries, draft new forms and tidy your inbox, with switches for what it may do and a log of every call.',
            'subtleforms'
          )}
        </p>
        <p>
          {hasProPlugin
            ? __('MCP is part of SubtleForms Pro. Activate a current license on the License tab to turn it on.', 'subtleforms')
            : __('MCP is part of SubtleForms Pro.', 'subtleforms')}
        </p>
        {showUpgrade && !hasProPlugin && (
          <p>
            <a
              className='components-button is-primary'
              href={getUpgradeUrl('mcp')}
              target='_blank'
              rel='noopener noreferrer'>
              {__('Upgrade to Pro', 'subtleforms')}
              <span className='screen-reader-text'> {__('(opens in a new tab)', 'subtleforms')}</span>
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
