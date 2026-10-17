import { Modal, Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { GLOBAL_MERGE_TAGS } from './mergeTags';
import './MergeTags.scss';

/** The merge tag reference, as a table. */
export function MergeTagsReference() {
  return (
    <div className='sf-merge-tags-help'>
      <p>
        {__('Use these tags in the recipient, subject and message of an email notification. They are replaced with the entry’s details when the email is sent.', 'subtleforms')}
      </p>
      <table className='sf-merge-tags-help__table'>
        <thead>
          <tr>
            <th scope='col'>{__('Tag', 'subtleforms')}</th>
            <th scope='col'>{__('Becomes', 'subtleforms')}</th>
          </tr>
        </thead>
        <tbody>
          {GLOBAL_MERGE_TAGS.map((t) => (
            <tr key={t.tag}>
              <td><code>{t.tag}</code></td>
              <td>{t.help}</td>
            </tr>
          ))}
          <tr>
            <td><code>{'{field:key}'}</code></td>
            <td>{__('The answer to one field. Replace "key" with the field key shown under the field name in the builder, for example {field:email}.', 'subtleforms')}</td>
          </tr>
        </tbody>
      </table>
      <p className='sf-merge-tags-help__note'>
        {__('Double braces work too: {{all_fields}} and {{email}} are the same as {all_fields} and {field:email}. Forms made before version 2.3 keep working. Passwords are never sent by email. Leave the message empty to send {all_fields}.', 'subtleforms')}
      </p>
    </div>
  );
}

/** A modal with the reference. */
export function MergeTagsModal({ onClose }) {
  return (
    <Modal title={__('Email merge tags', 'subtleforms')} onRequestClose={onClose} size='medium'>
      <MergeTagsReference />
    </Modal>
  );
}

/** A small link that opens the reference. */
export default function MergeTagsHelpLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant='link' size='small' onClick={() => setOpen(true)} className='sf-merge-tags-help__link'>
        {__('About merge tags', 'subtleforms')}
      </Button>
      {open && <MergeTagsModal onClose={() => setOpen(false)} />}
    </>
  );
}
