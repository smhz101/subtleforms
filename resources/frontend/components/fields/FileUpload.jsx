/**
 * File and Image Upload fields (2.1).
 *
 * Each picked file is uploaded straight away to POST /uploads, which checks
 * its type and size against the field and stores it privately. The answer
 * holds the returned records ({ id, name, size, type }); on submit the server
 * swaps the IDs for the stored files.
 *
 * A field takes one file. Several files per field is an add-on feature (the
 * `multi_file_uploads` extension point): an add-on registers a field override
 * for fields that ask for it. Without one, a field saved with "allow multiple
 * files" still works and takes a single file, matching the server.
 */
import { useContext, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

import { FormContext } from './contexts';

export { FormContext };

const DEFAULT_EXT = {
  image_upload: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  file_upload: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'zip'],
};
const BLOCKED = ['php', 'phtml', 'phar', 'html', 'htm', 'svg', 'js', 'exe', 'sh', 'bat'];

function allowedExtensions(type, config) {
  let list = config.allowedExtensions;
  if (typeof list === 'string') list = list.split(',');
  list = Array.isArray(list)
    ? list.map((e) => String(e).trim().replace(/^\./, '').toLowerCase()).filter(Boolean)
    : [];
  if (!list.length) list = DEFAULT_EXT[type] || DEFAULT_EXT.file_upload;
  if (type === 'image_upload') list = list.filter((e) => DEFAULT_EXT.image_upload.includes(e));
  return list.filter((e) => !BLOCKED.includes(e));
}

function maxBytes(type, config) {
  const set = Number(config.maxSize) || 0;
  if (set > 0) return set;
  return type === 'image_upload' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const asList = (value) =>
  Array.isArray(value) ? value.filter((v) => v && typeof v === 'object' && v.id) : [];

function uploadFile({ file, formId, fieldKey, onProgress }) {
  const restUrl = (window.subtleformsFrontend?.restUrl || '/wp-json/subtleforms/v1').replace(/\/$/, '');
  return new Promise((resolve, reject) => {
    const data = new window.FormData();
    data.append('file', file);
    data.append('form_id', String(formId));
    data.append('field', fieldKey);

    const xhr = new window.XMLHttpRequest();
    xhr.open('POST', `${restUrl}/uploads`);
    xhr.withCredentials = true;
    const nonce = window.subtleformsFrontend?.nonce;
    if (nonce) xhr.setRequestHeader('X-WP-Nonce', nonce);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let json = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch (e) {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && json?.data?.id) {
        resolve(json.data);
      } else {
        reject(new Error(json?.error?.message || json?.message || __('The file could not be uploaded.', 'subtleforms')));
      }
    };
    xhr.onerror = () => reject(new Error(__('The file could not be uploaded. Check your connection.', 'subtleforms')));
    xhr.send(data);
  });
}

export default function FileUpload({ field, config, value, onChange, inputId, error, required }) {
  const { formId, preview } = useContext(FormContext);
  const [pending, setPending] = useState([]);
  const [localError, setLocalError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const type = field.type;
  const fieldKey = config.key || field.key;
  const exts = allowedExtensions(type, config);
  const max = maxBytes(type, config);
  const files = asList(value);

  const accept = exts.map((e) => `.${e}`).join(',');

  const addFiles = (list) => {
    setLocalError('');
    const picked = Array.from(list || []);
    if (!picked.length) return;

    if (files.length + pending.length > 0) {
      return;
    }

    picked.slice(0, 1).forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!exts.includes(ext)) {
        setLocalError(
          sprintf(
            /* translators: %s: list of allowed file extensions */
            __('This type of file is not allowed. Allowed: %s.', 'subtleforms'),
            exts.join(', ')
          )
        );
        return;
      }
      if (file.size > max) {
        setLocalError(
          sprintf(
            /* translators: %s: maximum size, e.g. 5 MB */
            __('This file is too large. The limit is %s.', 'subtleforms'),
            formatBytes(max)
          )
        );
        return;
      }

      if (preview || !formId) {
        // The builder preview never stores files.
        const record = { id: `preview-${Date.now()}`, name: file.name, size: file.size, type: file.type };
        onChange([record]);
        return;
      }

      const temp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setPending((p) => [...p, { temp, name: file.name, progress: 0 }]);
      uploadFile({
        file,
        formId,
        fieldKey,
        onProgress: (progress) =>
          setPending((p) => p.map((x) => (x.temp === temp ? { ...x, progress } : x))),
      })
        .then((record) => {
          onChange([record]);
        })
        .catch((err) => setLocalError(err.message))
        .finally(() => setPending((p) => p.filter((x) => x.temp !== temp)));
    });
  };

  const remove = (id) => {
    onChange(files.filter((f) => f.id !== id));
  };

  const describedBy = [error ? `${inputId}-error` : null, `${inputId}-hint`].filter(Boolean).join(' ');
  const canAdd = files.length + pending.length === 0;

  const hint = sprintf(
    /* translators: 1: allowed extensions, 2: maximum size */
    __('%1$s up to %2$s', 'subtleforms'),
    exts.map((e) => e.toUpperCase()).join(', '),
    formatBytes(max)
  );

  const openPicker = () => {
    if (canAdd && inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className='subtleforms-upload'>
      <input
        ref={inputRef}
        id={inputId}
        name={fieldKey || undefined}
        type='file'
        className='subtleforms-input subtleforms-file-input'
        accept={accept}
        disabled={!canAdd}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
        aria-required={required}
        aria-invalid={!!(error || localError)}
        aria-describedby={describedBy}
      />

      {canAdd && (
        <div
          className={['subtleforms-upload__zone', dragOver ? 'is-dragover' : ''].filter(Boolean).join(' ')}
          onClick={openPicker}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            addFiles(e.dataTransfer?.files);
          }}>
          <span>{__('Drop files here or', 'subtleforms')}</span>
          <button
            type='button'
            className='subtleforms-upload__select'
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}>
            {__('Select file', 'subtleforms')}
          </button>
        </div>
      )}

      <p id={`${inputId}-hint`} className='subtleforms-upload__hint'>
        {hint}
      </p>

      {(files.length > 0 || pending.length > 0) && (
        <ul className='subtleforms-upload__list' aria-live='polite'>
          {files.map((f) => (
            <li key={f.id} className='subtleforms-upload__item'>
              <span className='subtleforms-upload__name'>{f.name}</span>
              <span className='subtleforms-upload__size'>{formatBytes(f.size)}</span>
              <button
                type='button'
                className='subtleforms-upload__remove'
                onClick={() => remove(f.id)}
                aria-label={sprintf(
                  /* translators: %s: file name */
                  __('Remove %s', 'subtleforms'),
                  f.name
                )}>
                ×
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.temp} className='subtleforms-upload__item is-uploading'>
              <span className='subtleforms-upload__name'>{p.name}</span>
              <span
                className='subtleforms-upload__progress'
                role='progressbar'
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p.progress}
                aria-label={sprintf(
                  /* translators: %s: file name */
                  __('Uploading %s', 'subtleforms'),
                  p.name
                )}>
                <span style={{ width: `${p.progress}%` }} />
              </span>
              <span className='subtleforms-upload__size'>{p.progress}%</span>
            </li>
          ))}
        </ul>
      )}

      {localError && (
        <p className='subtleforms-upload__error' role='alert'>
          {localError}
        </p>
      )}
    </div>
  );
}
