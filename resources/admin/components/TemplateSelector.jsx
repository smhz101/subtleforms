import { useState, useEffect } from '@wordpress/element';
import { Button, Modal, Card, CardBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import './TemplateSelector.css';

/**
 * Template Selector Component
 *
 * Displays available form templates for quick form creation.
 */
export default function TemplateSelector({ onSelect, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await apiFetch({
        path: '/subtleforms/v1/templates',
      });

      if (response.success && response.templates) {
        setTemplates(Object.values(response.templates));
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template) => {
    if (onSelect) {
      onSelect(template);
    }
  };

  const handleStartBlank = () => {
    if (onSelect) {
      onSelect(null); // null = blank form
    }
  };

  return (
    <Modal
      title={__('Choose a Template', 'subtleforms')}
      onRequestClose={onClose}
      className='subtleforms-template-selector-modal'
      size='large'>
      <div className='subtleforms-template-selector'>
        {loading ? (
          <div className='sf-py-8 sf-text-center'>
            <p>{__('Loading templates...', 'subtleforms')}</p>
          </div>
        ) : (
          <>
            <p className='sf-mb-6 sf-text-gray-600'>
              {__(
                'Start with a pre-built template or create a blank form from scratch.',
                'subtleforms'
              )}
            </p>

            <div className='template-grid'>
              {/* Blank Template */}
              <Card
                className='template-card template-blank'
                onClick={handleStartBlank}>
                <CardBody>
                  <div className='template-icon'>
                    <span className='dashicons dashicons-plus-alt2'></span>
                  </div>
                  <h3 className='template-name'>
                    {__('Blank Form', 'subtleforms')}
                  </h3>
                  <p className='template-description'>
                    {__('Start from scratch with a blank form', 'subtleforms')}
                  </p>
                  <Button variant='secondary' className='template-button'>
                    {__('Start Blank', 'subtleforms')}
                  </Button>
                </CardBody>
              </Card>

              {/* Template Cards */}
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className='template-card'
                  onClick={() => handleTemplateSelect(template)}>
                  <CardBody>
                    <div className='template-icon'>
                      <span
                        className={`dashicons dashicons-${
                          template.icon || 'feedback'
                        }`}></span>
                    </div>
                    <h3 className='template-name'>{template.name}</h3>
                    <p className='template-description'>
                      {template.description}
                    </p>
                    <Button variant='primary' className='template-button'>
                      {__('Use Template', 'subtleforms')}
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
