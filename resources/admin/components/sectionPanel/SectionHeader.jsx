import './sectionPanel.scss';

/**
 * The top of a section: its title and one line saying what it is for. No icon.
 * `actions` is an optional node on the right, for example a Save button or a
 * Connected badge.
 *
 * Public: add-ons reach it as `window.SubtleFormsExtend.SectionHeader`
 * (available since 2.7.5; check `typeof SectionHeader === 'function'`).
 *
 * @param {Object}  props
 * @param {string}  props.title       Section title.
 * @param {string}  props.description One line under the title.
 * @param {*}       props.actions     Node shown on the right.
 * @param {string}  props.headingId   Id of the title, so a region can be labelled by it.
 */
export default function SectionHeader({ title, description, actions = null, headingId }) {
  return (
    <header className='sf-section-header'>
      <div className='sf-section-header__text'>
        <h2 className='sf-section-header__title' id={headingId}>
          {title}
        </h2>
        {description ? <p className='sf-section-header__description'>{description}</p> : null}
      </div>
      {actions ? <div className='sf-section-header__actions'>{actions}</div> : null}
    </header>
  );
}
