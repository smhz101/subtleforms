import React from 'react';
import { useState, useMemo } from '@wordpress/element';
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useTemplates } from '../data';
import clsx from 'clsx';
import Icon from '../ui/Icon';
import { formTypeLabel } from '../utils/formTypeChoices';
import { TEMPLATE_CATEGORIES } from './index';

export default function TemplateSelector({
  onSelectTemplate,
  selectedTemplate,
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: templatesResponse, isLoading } = useTemplates();
  
  const templates = templatesResponse?.success && templatesResponse?.templates 
    ? Object.values(templatesResponse.templates) 
    : [];

  // Filter templates by search and category
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [templates, searchQuery, selectedCategory]);

  const handleTemplateClick = (template) => {
    onSelectTemplate(template);
  };

  const getFormTypeLabel = (type) => {
    if (type === 'payment') {
      return __('Payment', 'subtleforms');
    }
    return formTypeLabel(type);
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
          {isLoading ? (
            <div className='sf-template-selector__loading'>
              <p>{__('Loading templates...', 'subtleforms')}</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className='sf-template-selector__empty'>
              <Icon.Search className='sf-template-selector__empty-icon' />
              <p className='sf-template-selector__empty-text'>
                {__('No templates found', 'subtleforms')}
              </p>
            </div>
          ) : (
            <div className='sf-template-selector__grid'>
              {filteredTemplates.map((template) => {
                // Check if this template is selected (handle both ID string and full object)
                const isSelected = selectedTemplate?.id ? 
                  selectedTemplate.id === template.id : 
                  selectedTemplate === template.id;
                
                return (
                  <button
                    key={template.id}
                    type='button'
                    onClick={() => handleTemplateClick(template)}
                    className={clsx(
                      'sf-template-card',
                      isSelected && 'sf-template-card--selected'
                    )}>
                  {/* Badge */}
                  <div className='sf-template-card__badge-wrapper'>
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
                  {isSelected && (
                    <Icon.CheckCircle className='sf-template-card__check-icon' />
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
