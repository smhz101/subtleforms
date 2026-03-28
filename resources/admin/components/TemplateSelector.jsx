import { useState, useEffect } from '@wordpress/element';
import { Button, Modal, Card, CardBody } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { getUIIcon } from '../utils/iconRegistry';
import './TemplateSelector.scss';

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
      className='subtleforms-sf-template-selector-modal'
      size='large'>
      <div className='subtleforms-sf-template-selector'>
        {loading ? (
          <div className='sf-template-selector__loading'>
            <p>{__('Loading templates...', 'subtleforms')}</p>
          </div>
        ) : (
          <>
            <p className='sf-template-selector__description'>
              {__(
                'Start with a pre-built template or create a blank form from scratch.',
                'subtleforms'
              )}
            </p>

            <div className='sf-template-grid'>
              {/* Blank Template */}
              <Card
                className='sf-template-card sf-template-blank'
                onClick={handleStartBlank}>
                <CardBody>
                  <div className='sf-template-icon'>
                    {(() => { const BlankIcon = getUIIcon('blank-form'); return <BlankIcon size={20} />; })()}
                  </div>
                  <h3 className='sf-template-name'>
                    {__('Blank Form', 'subtleforms')}
                  </h3>
                  <p className='sf-template-description'>
                    {__('Start from scratch with a blank form', 'subtleforms')}
                  </p>
                  <Button variant='secondary' className='sf-template-button'>
                    {__('Start Blank', 'subtleforms')}
                  </Button>
                </CardBody>
              </Card>

              {/* Template Cards */}
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className='sf-template-card'
                  onClick={() => handleTemplateSelect(template)}>
                  <CardBody>
                    <div className='sf-template-icon'>
                      {(() => { const TplIcon = getUIIcon('template'); return <TplIcon size={20} />; })()}
                    </div>
                    <h3 className='sf-template-name'>{template.name}</h3>
                    <p className='sf-template-description'>
                      {template.description}
                    </p>
                    <Button variant='primary' className='sf-template-button'>
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
