import React from 'react';
import { useState, useMemo } from '@wordpress/element';
import { TextControl } from '@wordpress/components';
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

  const filteredTemplates = useMemo(() => {
    return searchTemplates(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  const handleTemplateClick = (template) => {
    if (template.is_pro) {
      // Show upgrade notice (non-blocking)
      return;
    }
    onSelectTemplate(template.id);
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
            </div>
          ) : (
            <div className='sf-template-selector__grid'>
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type='button'
                  onClick={() => handleTemplateClick(template)}
                  disabled={template.is_pro}
                  className={clsx(
                    'sf-template-card',
                    selectedTemplate === template.id &&
                      'sf-template-card--selected',
                    template.is_pro && 'sf-template-card--locked'
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

                  {/* Pro Lock Icon */}
                  {template.is_pro && (
                    <div className='sf-template-card__lock'>
                      <Icon.Lock className='sf-template-card__lock-icon' />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
