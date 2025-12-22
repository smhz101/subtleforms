import {
  paragraph,
  shortcode,
  image,
  media,
  calendar,
  mapMarker,
  check,
  arrowDown,
  envelope,
  mobile,
  globe,
  code,
  plus,
  trash,
  arrowUp,
  arrowDown as arrowDownIcon,
  copy,
  close,
  pencil,
  moreVertical,
  dragHandle,
  timeToRead,
  navigation,
} from '@wordpress/icons';

export const getIcon = (iconNameOrType) => {
  const map = {
    // Field Types
    text: paragraph,
    email: envelope,
    phone: mobile,
    url: globe,
    number: shortcode,
    textarea: paragraph,
    checkbox: check,
    radio: check, // Fallback as radio icon is missing
    multiple_choice: check,
    dropdown: arrowDown,
    date: calendar,
    time: timeToRead,
    datetime: calendar,
    country: globe,
    hidden: code,
    html: code,
    image_upload: image,
    file_upload: media,
    address: mapMarker,
    step: navigation,

    // Dashicons mapping (legacy support)
    'dashicons-text': paragraph,
    'dashicons-email': envelope,
    'dashicons-phone': mobile,
    'dashicons-admin-site': globe,
    'dashicons-editor-paragraph': paragraph,
    'dashicons-yes': check,
    'dashicons-marker': mapMarker,
    'dashicons-calendar': calendar,
    'dashicons-clock': timeToRead,
    'dashicons-format-image': image,
    'dashicons-media-default': media,
    'dashicons-arrow-down-alt2': arrowDown,
    'dashicons-editor-code': code,
    'dashicons-hidden': code,

    // Actions
    add: plus,
    delete: trash,
    moveUp: arrowUp,
    moveDown: arrowDownIcon,
    duplicate: copy,
    close: close,
    edit: pencil,
    more: moreVertical,
    drag: dragHandle,

    // Fallback
    default: paragraph,
  };

  return map[iconNameOrType] || map.default;
};
