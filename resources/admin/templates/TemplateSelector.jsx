import React from 'react';
import { useState, useMemo } from '@wordpress/element';
import { TextControl, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../components/ui/Icon';
import { TEMPLATE_CATEGORIES, searchTemplates } from './index';

export default function TemplateSelector({
  onSelectTemplate,
  selectedTemplate,
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Check Pro template capability from window.subtleformsAdmin.capabilities
  const capabilities = window.subtleformsAdmin?.capabilities || {};
  const hasProTemplates = capabilities['templates.pro'] === true;
  const hasProFeature = capabilities['pro_features'] === true;
  
  // Determine license state (grace period shows pro_features but limited capabilities)
  const isInGracePeriod = hasProFeature && !hasProTemplates;
  const canUseProTemplates = hasProTemplates || isInGracePeriod;

  const filteredTemplates = useMemo(() => {
    return searchTemplates(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  const handleTemplateClick = (template) => {
    // If it's a Pro template, check license state
    if (template.is_pro) {
      if (canUseProTemplates) {
        // License active or in grace period - allow selection
        onSelectTemplate(template.id);
      } else {
        // License expired/inactive - show notice (TODO: implement modal/notice)
        console.warn('Pro template requires active license');
        // In production, this would trigger an upgrade modal
        return;
      }
    } else {
      // Free template - always allow
      onSelectTemplate(template.id);
    }
  };

  const getFormTypeLabel = (type) => {
    switch (type) {
      case 'multistep':
        return __('Multi-Step', 'subtleforms');
      case 'conversational':
        return __('Conversational', 'subtleforms');
      case 'sectioned':
        return __('Sectioned', 'subtleforms');
      case 'payment':
        return __('Payment', 'subtleforms');
      case 'regular':
      default:
        return __('Regular', 'subtleforms');
    }
  };

  return (
    <div className='sf-template-selector'>
      {/* Search Bar */}
      <div className='sf-template-selector__search'>
        <TextControl
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={__('Search templates...', 'subtleforms')}
          className='sf-template-selector__search-input'
        />
      </div>

      {/* Grace Period Notice */}
      {isInGracePeriod && (
        <Notice status='warning' isDismissible={false}>
          {__('License in grace period - Pro features available with limited access', 'subtleforms')}
        </Notice>
      )}

      {/* Main Content */}
      <div className='sf-template-selector__content'>
        {/* Left: Categories */}
        <div className='sf-template-selector__categories'>
          {TEMPLATE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type='button'
              onClick={() => setSelectedCategory(category.id)}
              className={clsx(
                'sf-template-selector__category',
                selectedCategory === category.id &&
                  'sf-template-selector__category--active'
              )}>
              {category.label}
            </button>
          ))}
        </div>

        {/* Right: Template Cards */}
        <div className='sf-template-selector__templates'>
          {filteredTemplates.length === 0 ? (
            <div className='sf-template-selector__empty'>
              <Icon.Search className='sf-template-selector__empty-icon' />
              <p className='sf-template-selector__empty-text'>
                {__('No templates found', 'subtleforms')}
              </p>
              {!hasProTemplates && (
                <p className='sf-template-selector__empty-subtext'>
                  {__('Unlock premium templates by activating your Pro license', 'subtleforms')}
                </p>
              )}
            </div>
          ) : (
            <div className='sf-template-selector__grid'>
              {filteredTemplates.map((template) => {
                // Pro template is locked only if license is expired/inactive
                const isLocked = template.is_pro && !canUseProTemplates;
                
                return (
                  <button
                    key={template.id}
                    type='button'
                    onClick={() => handleTemplateClick(template)}
                    disabled={isLocked}
                    className={clsx(
                      'sf-template-card',
                      selectedTemplate === template.id &&
                        'sf-template-card--selected',
                      isLocked && 'sf-template-card--locked'
                    )}>
                  {/* Badge */}
                  <div className='sf-template-card__badge-wrapper'>
                    {template.is_pro ? (
                      <span className='sf-template-card__badge sf-template-card__badge--pro'>
                        {__('Pro', 'subtleforms')}
                      </span>
                    ) : (
                      <span className='sf-template-card__badge sf-template-card__badge--free'>
                        {__('Free', 'subtleforms')}
                      </span>
                    )}
                    <span className='sf-template-card__badge sf-template-card__badge--type'>
                      {getFormTypeLabel(template.schema?.metadata?.type)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className='sf-template-card__content'>
                    <h3 className='sf-template-card__name'>{template.name}</h3>
                    <p className='sf-template-card__description'>
                      {template.description}
                    </p>
                  </div>

                  {/* Selected Check */}
                  {selectedTemplate === template.id && (
                    <Icon.CheckCircle className='sf-template-card__check-icon' />
                  )}

                  {/* Pro Lock Icon - only show if locked */}
                  {isLocked && (
                    <div className='sf-template-card__lock'>
                      <Icon.Lock className='sf-template-card__lock-icon' />
                    </div>
                  )}
                </button>
              );
            })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
