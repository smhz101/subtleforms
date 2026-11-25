/**
 * Password strength bar and rules checklist. Downloaded only for forms that
 * have a Password field (see lazyFields.jsx); the input itself is in the
 * main bundle.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
  passwordStrength,
  hasPasswordRules,
  unmetRules,
  meetsStrength,
} from '../../../shared/passwordStrength';
import { passwordRules, isRuleMet, strengthName } from '../../../shared/passwordRules';

/** The first password rule a value breaks, as a message, or ''. */
export function passwordProblem(value, config) {
  const unmet = unmetRules(value, config);
  if (unmet.length > 0) {
    return sprintf(
      /* translators: %s: list of missing password parts, such as "a number, a symbol" */
      __('Your password needs: %s.', 'subtleforms'),
      unmet.map((rule) => rule.phrase).join(', ')
    );
  }
  return meetsStrength(value, config) ? '' : __('Choose a stronger password.', 'subtleforms');
}

export default function PasswordHints({ value, config }) {
  const level = passwordStrength(value);
  return (
    <>
      {config.strengthMeter !== false && (
        <div className={`subtleforms-password__meter is-${level}`}>
          <span className='subtleforms-password__bar' aria-hidden='true'>
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className='subtleforms-password__level' role='status'>
            {level !== 'none' && (
              <>
                <span className='subtleforms-sr-only'>
                  {sprintf(
                    /* translators: %s: strength level such as Good */
                    __('Password strength: %s', 'subtleforms'),
                    strengthName(level)
                  )}
                </span>
                <span aria-hidden='true'>{strengthName(level)}</span>
              </>
            )}
          </span>
        </div>
      )}
      {hasPasswordRules(config) && (
        <ul className='subtleforms-password__rules'>
          {passwordRules(config).map((rule) => {
            const met = isRuleMet(rule, value, config);
            return (
              <li key={rule.id} className={met ? 'is-met' : 'is-unmet'}>
                <span className='subtleforms-password__icon' aria-hidden='true' />
                {rule.label}
                <span className='subtleforms-sr-only'>
                  {met ? __(' (met)', 'subtleforms') : __(' (not met)', 'subtleforms')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
