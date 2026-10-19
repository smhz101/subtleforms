<?php

/**
 * SubtleForms ISO-3166 Country List
 *
 * @package SubtleForms\Fields
 * @since   1.0.0
 */

namespace SubtleForms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Provides full ISO-3166 country list for Country field.
 */
final class CountryList {

	/**
	 * Get full list of countries with ISO-3166 codes.
	 *
	 * Same codes and names as resources/shared/countries.js, the list the
	 * browser shows (a Jest test keeps them in step).
	 *
	 * @return array Array of ['code' => 'name'] pairs
	 */
	public static function getAll(): array {
		return array(
			'AF' => __( 'Afghanistan', 'subtleforms' ),
			'AX' => __( 'Åland Islands', 'subtleforms' ),
			'AL' => __( 'Albania', 'subtleforms' ),
			'DZ' => __( 'Algeria', 'subtleforms' ),
			'AS' => __( 'American Samoa', 'subtleforms' ),
			'AD' => __( 'Andorra', 'subtleforms' ),
			'AO' => __( 'Angola', 'subtleforms' ),
			'AI' => __( 'Anguilla', 'subtleforms' ),
			'AQ' => __( 'Antarctica', 'subtleforms' ),
			'AG' => __( 'Antigua and Barbuda', 'subtleforms' ),
			'AR' => __( 'Argentina', 'subtleforms' ),
			'AM' => __( 'Armenia', 'subtleforms' ),
			'AW' => __( 'Aruba', 'subtleforms' ),
			'AU' => __( 'Australia', 'subtleforms' ),
			'AT' => __( 'Austria', 'subtleforms' ),
			'AZ' => __( 'Azerbaijan', 'subtleforms' ),
			'BS' => __( 'Bahamas', 'subtleforms' ),
			'BH' => __( 'Bahrain', 'subtleforms' ),
			'BD' => __( 'Bangladesh', 'subtleforms' ),
			'BB' => __( 'Barbados', 'subtleforms' ),
			'BY' => __( 'Belarus', 'subtleforms' ),
			'BE' => __( 'Belgium', 'subtleforms' ),
			'BZ' => __( 'Belize', 'subtleforms' ),
			'BJ' => __( 'Benin', 'subtleforms' ),
			'BM' => __( 'Bermuda', 'subtleforms' ),
			'BT' => __( 'Bhutan', 'subtleforms' ),
			'BO' => __( 'Bolivia', 'subtleforms' ),
			'BQ' => __( 'Bonaire, Sint Eustatius and Saba', 'subtleforms' ),
			'BA' => __( 'Bosnia and Herzegovina', 'subtleforms' ),
			'BW' => __( 'Botswana', 'subtleforms' ),
			'BV' => __( 'Bouvet Island', 'subtleforms' ),
			'BR' => __( 'Brazil', 'subtleforms' ),
			'IO' => __( 'British Indian Ocean Territory', 'subtleforms' ),
			'BN' => __( 'Brunei Darussalam', 'subtleforms' ),
			'BG' => __( 'Bulgaria', 'subtleforms' ),
			'BF' => __( 'Burkina Faso', 'subtleforms' ),
			'BI' => __( 'Burundi', 'subtleforms' ),
			'CV' => __( 'Cabo Verde', 'subtleforms' ),
			'KH' => __( 'Cambodia', 'subtleforms' ),
			'CM' => __( 'Cameroon', 'subtleforms' ),
			'CA' => __( 'Canada', 'subtleforms' ),
			'KY' => __( 'Cayman Islands', 'subtleforms' ),
			'CF' => __( 'Central African Republic', 'subtleforms' ),
			'TD' => __( 'Chad', 'subtleforms' ),
			'CL' => __( 'Chile', 'subtleforms' ),
			'CN' => __( 'China', 'subtleforms' ),
			'CX' => __( 'Christmas Island', 'subtleforms' ),
			'CC' => __( 'Cocos (Keeling) Islands', 'subtleforms' ),
			'CO' => __( 'Colombia', 'subtleforms' ),
			'KM' => __( 'Comoros', 'subtleforms' ),
			'CG' => __( 'Congo', 'subtleforms' ),
			'CD' => __( 'Congo, Democratic Republic of the', 'subtleforms' ),
			'CK' => __( 'Cook Islands', 'subtleforms' ),
			'CR' => __( 'Costa Rica', 'subtleforms' ),
			'CI' => __( 'Côte d\'Ivoire', 'subtleforms' ),
			'HR' => __( 'Croatia', 'subtleforms' ),
			'CU' => __( 'Cuba', 'subtleforms' ),
			'CW' => __( 'Curaçao', 'subtleforms' ),
			'CY' => __( 'Cyprus', 'subtleforms' ),
			'CZ' => __( 'Czechia', 'subtleforms' ),
			'DK' => __( 'Denmark', 'subtleforms' ),
			'DJ' => __( 'Djibouti', 'subtleforms' ),
			'DM' => __( 'Dominica', 'subtleforms' ),
			'DO' => __( 'Dominican Republic', 'subtleforms' ),
			'EC' => __( 'Ecuador', 'subtleforms' ),
			'EG' => __( 'Egypt', 'subtleforms' ),
			'SV' => __( 'El Salvador', 'subtleforms' ),
			'GQ' => __( 'Equatorial Guinea', 'subtleforms' ),
			'ER' => __( 'Eritrea', 'subtleforms' ),
			'EE' => __( 'Estonia', 'subtleforms' ),
			'SZ' => __( 'Eswatini', 'subtleforms' ),
			'ET' => __( 'Ethiopia', 'subtleforms' ),
			'FK' => __( 'Falkland Islands (Malvinas)', 'subtleforms' ),
			'FO' => __( 'Faroe Islands', 'subtleforms' ),
			'FJ' => __( 'Fiji', 'subtleforms' ),
			'FI' => __( 'Finland', 'subtleforms' ),
			'FR' => __( 'France', 'subtleforms' ),
			'GF' => __( 'French Guiana', 'subtleforms' ),
			'PF' => __( 'French Polynesia', 'subtleforms' ),
			'TF' => __( 'French Southern Territories', 'subtleforms' ),
			'GA' => __( 'Gabon', 'subtleforms' ),
			'GM' => __( 'Gambia', 'subtleforms' ),
			'GE' => __( 'Georgia', 'subtleforms' ),
			'DE' => __( 'Germany', 'subtleforms' ),
			'GH' => __( 'Ghana', 'subtleforms' ),
			'GI' => __( 'Gibraltar', 'subtleforms' ),
			'GR' => __( 'Greece', 'subtleforms' ),
			'GL' => __( 'Greenland', 'subtleforms' ),
			'GD' => __( 'Grenada', 'subtleforms' ),
			'GP' => __( 'Guadeloupe', 'subtleforms' ),
			'GU' => __( 'Guam', 'subtleforms' ),
			'GT' => __( 'Guatemala', 'subtleforms' ),
			'GG' => __( 'Guernsey', 'subtleforms' ),
			'GN' => __( 'Guinea', 'subtleforms' ),
			'GW' => __( 'Guinea-Bissau', 'subtleforms' ),
			'GY' => __( 'Guyana', 'subtleforms' ),
			'HT' => __( 'Haiti', 'subtleforms' ),
			'HM' => __( 'Heard Island and McDonald Islands', 'subtleforms' ),
			'VA' => __( 'Holy See', 'subtleforms' ),
			'HN' => __( 'Honduras', 'subtleforms' ),
			'HK' => __( 'Hong Kong', 'subtleforms' ),
			'HU' => __( 'Hungary', 'subtleforms' ),
			'IS' => __( 'Iceland', 'subtleforms' ),
			'IN' => __( 'India', 'subtleforms' ),
			'ID' => __( 'Indonesia', 'subtleforms' ),
			'IR' => __( 'Iran', 'subtleforms' ),
			'IQ' => __( 'Iraq', 'subtleforms' ),
			'IE' => __( 'Ireland', 'subtleforms' ),
			'IM' => __( 'Isle of Man', 'subtleforms' ),
			'IL' => __( 'Israel', 'subtleforms' ),
			'IT' => __( 'Italy', 'subtleforms' ),
			'JM' => __( 'Jamaica', 'subtleforms' ),
			'JP' => __( 'Japan', 'subtleforms' ),
			'JE' => __( 'Jersey', 'subtleforms' ),
			'JO' => __( 'Jordan', 'subtleforms' ),
			'KZ' => __( 'Kazakhstan', 'subtleforms' ),
			'KE' => __( 'Kenya', 'subtleforms' ),
			'KI' => __( 'Kiribati', 'subtleforms' ),
			'KP' => __( 'Korea, Democratic People\'s Republic of', 'subtleforms' ),
			'KR' => __( 'Korea, Republic of', 'subtleforms' ),
			'KW' => __( 'Kuwait', 'subtleforms' ),
			'KG' => __( 'Kyrgyzstan', 'subtleforms' ),
			'LA' => __( 'Lao People\'s Democratic Republic', 'subtleforms' ),
			'LV' => __( 'Latvia', 'subtleforms' ),
			'LB' => __( 'Lebanon', 'subtleforms' ),
			'LS' => __( 'Lesotho', 'subtleforms' ),
			'LR' => __( 'Liberia', 'subtleforms' ),
			'LY' => __( 'Libya', 'subtleforms' ),
			'LI' => __( 'Liechtenstein', 'subtleforms' ),
			'LT' => __( 'Lithuania', 'subtleforms' ),
			'LU' => __( 'Luxembourg', 'subtleforms' ),
			'MO' => __( 'Macao', 'subtleforms' ),
			'MG' => __( 'Madagascar', 'subtleforms' ),
			'MW' => __( 'Malawi', 'subtleforms' ),
			'MY' => __( 'Malaysia', 'subtleforms' ),
			'MV' => __( 'Maldives', 'subtleforms' ),
			'ML' => __( 'Mali', 'subtleforms' ),
			'MT' => __( 'Malta', 'subtleforms' ),
			'MH' => __( 'Marshall Islands', 'subtleforms' ),
			'MQ' => __( 'Martinique', 'subtleforms' ),
			'MR' => __( 'Mauritania', 'subtleforms' ),
			'MU' => __( 'Mauritius', 'subtleforms' ),
			'YT' => __( 'Mayotte', 'subtleforms' ),
			'MX' => __( 'Mexico', 'subtleforms' ),
			'FM' => __( 'Micronesia', 'subtleforms' ),
			'MD' => __( 'Moldova', 'subtleforms' ),
			'MC' => __( 'Monaco', 'subtleforms' ),
			'MN' => __( 'Mongolia', 'subtleforms' ),
			'ME' => __( 'Montenegro', 'subtleforms' ),
			'MS' => __( 'Montserrat', 'subtleforms' ),
			'MA' => __( 'Morocco', 'subtleforms' ),
			'MZ' => __( 'Mozambique', 'subtleforms' ),
			'MM' => __( 'Myanmar', 'subtleforms' ),
			'NA' => __( 'Namibia', 'subtleforms' ),
			'NR' => __( 'Nauru', 'subtleforms' ),
			'NP' => __( 'Nepal', 'subtleforms' ),
			'NL' => __( 'Netherlands', 'subtleforms' ),
			'NC' => __( 'New Caledonia', 'subtleforms' ),
			'NZ' => __( 'New Zealand', 'subtleforms' ),
			'NI' => __( 'Nicaragua', 'subtleforms' ),
			'NE' => __( 'Niger', 'subtleforms' ),
			'NG' => __( 'Nigeria', 'subtleforms' ),
			'NU' => __( 'Niue', 'subtleforms' ),
			'NF' => __( 'Norfolk Island', 'subtleforms' ),
			'MK' => __( 'North Macedonia', 'subtleforms' ),
			'MP' => __( 'Northern Mariana Islands', 'subtleforms' ),
			'NO' => __( 'Norway', 'subtleforms' ),
			'OM' => __( 'Oman', 'subtleforms' ),
			'PK' => __( 'Pakistan', 'subtleforms' ),
			'PW' => __( 'Palau', 'subtleforms' ),
			'PS' => __( 'Palestine, State of', 'subtleforms' ),
			'PA' => __( 'Panama', 'subtleforms' ),
			'PG' => __( 'Papua New Guinea', 'subtleforms' ),
			'PY' => __( 'Paraguay', 'subtleforms' ),
			'PE' => __( 'Peru', 'subtleforms' ),
			'PH' => __( 'Philippines', 'subtleforms' ),
			'PN' => __( 'Pitcairn', 'subtleforms' ),
			'PL' => __( 'Poland', 'subtleforms' ),
			'PT' => __( 'Portugal', 'subtleforms' ),
			'PR' => __( 'Puerto Rico', 'subtleforms' ),
			'QA' => __( 'Qatar', 'subtleforms' ),
			'RE' => __( 'Réunion', 'subtleforms' ),
			'RO' => __( 'Romania', 'subtleforms' ),
			'RU' => __( 'Russian Federation', 'subtleforms' ),
			'RW' => __( 'Rwanda', 'subtleforms' ),
			'BL' => __( 'Saint Barthélemy', 'subtleforms' ),
			'SH' => __( 'Saint Helena, Ascension and Tristan da Cunha', 'subtleforms' ),
			'KN' => __( 'Saint Kitts and Nevis', 'subtleforms' ),
			'LC' => __( 'Saint Lucia', 'subtleforms' ),
			'MF' => __( 'Saint Martin (French part)', 'subtleforms' ),
			'PM' => __( 'Saint Pierre and Miquelon', 'subtleforms' ),
			'VC' => __( 'Saint Vincent and the Grenadines', 'subtleforms' ),
			'WS' => __( 'Samoa', 'subtleforms' ),
			'SM' => __( 'San Marino', 'subtleforms' ),
			'ST' => __( 'Sao Tome and Principe', 'subtleforms' ),
			'SA' => __( 'Saudi Arabia', 'subtleforms' ),
			'SN' => __( 'Senegal', 'subtleforms' ),
			'RS' => __( 'Serbia', 'subtleforms' ),
			'SC' => __( 'Seychelles', 'subtleforms' ),
			'SL' => __( 'Sierra Leone', 'subtleforms' ),
			'SG' => __( 'Singapore', 'subtleforms' ),
			'SX' => __( 'Sint Maarten (Dutch part)', 'subtleforms' ),
			'SK' => __( 'Slovakia', 'subtleforms' ),
			'SI' => __( 'Slovenia', 'subtleforms' ),
			'SB' => __( 'Solomon Islands', 'subtleforms' ),
			'SO' => __( 'Somalia', 'subtleforms' ),
			'ZA' => __( 'South Africa', 'subtleforms' ),
			'GS' => __( 'South Georgia and the South Sandwich Islands', 'subtleforms' ),
			'SS' => __( 'South Sudan', 'subtleforms' ),
			'ES' => __( 'Spain', 'subtleforms' ),
			'LK' => __( 'Sri Lanka', 'subtleforms' ),
			'SD' => __( 'Sudan', 'subtleforms' ),
			'SR' => __( 'Suriname', 'subtleforms' ),
			'SJ' => __( 'Svalbard and Jan Mayen', 'subtleforms' ),
			'SE' => __( 'Sweden', 'subtleforms' ),
			'CH' => __( 'Switzerland', 'subtleforms' ),
			'SY' => __( 'Syrian Arab Republic', 'subtleforms' ),
			'TW' => __( 'Taiwan', 'subtleforms' ),
			'TJ' => __( 'Tajikistan', 'subtleforms' ),
			'TZ' => __( 'Tanzania, United Republic of', 'subtleforms' ),
			'TH' => __( 'Thailand', 'subtleforms' ),
			'TL' => __( 'Timor-Leste', 'subtleforms' ),
			'TG' => __( 'Togo', 'subtleforms' ),
			'TK' => __( 'Tokelau', 'subtleforms' ),
			'TO' => __( 'Tonga', 'subtleforms' ),
			'TT' => __( 'Trinidad and Tobago', 'subtleforms' ),
			'TN' => __( 'Tunisia', 'subtleforms' ),
			'TR' => __( 'Turkey', 'subtleforms' ),
			'TM' => __( 'Turkmenistan', 'subtleforms' ),
			'TC' => __( 'Turks and Caicos Islands', 'subtleforms' ),
			'TV' => __( 'Tuvalu', 'subtleforms' ),
			'UG' => __( 'Uganda', 'subtleforms' ),
			'UA' => __( 'Ukraine', 'subtleforms' ),
			'AE' => __( 'United Arab Emirates', 'subtleforms' ),
			'GB' => __( 'United Kingdom', 'subtleforms' ),
			'US' => __( 'United States', 'subtleforms' ),
			'UM' => __( 'United States Minor Outlying Islands', 'subtleforms' ),
			'UY' => __( 'Uruguay', 'subtleforms' ),
			'UZ' => __( 'Uzbekistan', 'subtleforms' ),
			'VU' => __( 'Vanuatu', 'subtleforms' ),
			'VE' => __( 'Venezuela', 'subtleforms' ),
			'VN' => __( 'Viet Nam', 'subtleforms' ),
			'VG' => __( 'Virgin Islands, British', 'subtleforms' ),
			'VI' => __( 'Virgin Islands, U.S.', 'subtleforms' ),
			'WF' => __( 'Wallis and Futuna', 'subtleforms' ),
			'EH' => __( 'Western Sahara', 'subtleforms' ),
			'YE' => __( 'Yemen', 'subtleforms' ),
			'ZM' => __( 'Zambia', 'subtleforms' ),
			'ZW' => __( 'Zimbabwe', 'subtleforms' ),
		);
	}

	/**
	 * Get countries formatted for select options.
	 *
	 * @return array Array of ['value' => 'code', 'label' => 'name']
	 */
	public static function getOptions(): array {
		$countries = self::getAll();
		$options   = array();

		foreach ( $countries as $code => $name ) {
			$options[] = array(
				'value' => $code,
				'label' => $name,
			);
		}

		return $options;
	}

	/**
	 * Calling codes by country, the same list as DIAL_CODES in
	 * resources/shared/phone.js (phone.test.js keeps them in step).
	 * Territories without a public calling code are left out.
	 *
	 * @return array<string,string> ISO code => dial code without "+".
	 */
	public static function dialCodes(): array {
		return array(
			'AF' => '93', 'AX' => '358', 'AL' => '355', 'DZ' => '213', 'AS' => '1', 'AD' => '376',
			'AO' => '244', 'AI' => '1', 'AG' => '1', 'AR' => '54', 'AM' => '374', 'AW' => '297',
			'AU' => '61', 'AT' => '43', 'AZ' => '994', 'BS' => '1', 'BH' => '973', 'BD' => '880',
			'BB' => '1', 'BY' => '375', 'BE' => '32', 'BZ' => '501', 'BJ' => '229', 'BM' => '1',
			'BT' => '975', 'BO' => '591', 'BQ' => '599', 'BA' => '387', 'BW' => '267', 'BR' => '55',
			'IO' => '246', 'BN' => '673', 'BG' => '359', 'BF' => '226', 'BI' => '257', 'CV' => '238',
			'KH' => '855', 'CM' => '237', 'CA' => '1', 'KY' => '1', 'CF' => '236', 'TD' => '235',
			'CL' => '56', 'CN' => '86', 'CX' => '61', 'CC' => '61', 'CO' => '57', 'KM' => '269',
			'CG' => '242', 'CD' => '243', 'CK' => '682', 'CR' => '506', 'CI' => '225', 'HR' => '385',
			'CU' => '53', 'CW' => '599', 'CY' => '357', 'CZ' => '420', 'DK' => '45', 'DJ' => '253',
			'DM' => '1', 'DO' => '1', 'EC' => '593', 'EG' => '20', 'SV' => '503', 'GQ' => '240',
			'ER' => '291', 'EE' => '372', 'SZ' => '268', 'ET' => '251', 'FK' => '500', 'FO' => '298',
			'FJ' => '679', 'FI' => '358', 'FR' => '33', 'GF' => '594', 'PF' => '689', 'GA' => '241',
			'GM' => '220', 'GE' => '995', 'DE' => '49', 'GH' => '233', 'GI' => '350', 'GR' => '30',
			'GL' => '299', 'GD' => '1', 'GP' => '590', 'GU' => '1', 'GT' => '502', 'GG' => '44',
			'GN' => '224', 'GW' => '245', 'GY' => '592', 'HT' => '509', 'VA' => '39', 'HN' => '504',
			'HK' => '852', 'HU' => '36', 'IS' => '354', 'IN' => '91', 'ID' => '62', 'IR' => '98',
			'IQ' => '964', 'IE' => '353', 'IM' => '44', 'IL' => '972', 'IT' => '39', 'JM' => '1',
			'JP' => '81', 'JE' => '44', 'JO' => '962', 'KZ' => '7', 'KE' => '254', 'KI' => '686',
			'KP' => '850', 'KR' => '82', 'KW' => '965', 'KG' => '996', 'LA' => '856', 'LV' => '371',
			'LB' => '961', 'LS' => '266', 'LR' => '231', 'LY' => '218', 'LI' => '423', 'LT' => '370',
			'LU' => '352', 'MO' => '853', 'MG' => '261', 'MW' => '265', 'MY' => '60', 'MV' => '960',
			'ML' => '223', 'MT' => '356', 'MH' => '692', 'MQ' => '596', 'MR' => '222', 'MU' => '230',
			'YT' => '262', 'MX' => '52', 'FM' => '691', 'MD' => '373', 'MC' => '377', 'MN' => '976',
			'ME' => '382', 'MS' => '1', 'MA' => '212', 'MZ' => '258', 'MM' => '95', 'NA' => '264',
			'NR' => '674', 'NP' => '977', 'NL' => '31', 'NC' => '687', 'NZ' => '64', 'NI' => '505',
			'NE' => '227', 'NG' => '234', 'NU' => '683', 'NF' => '672', 'MK' => '389', 'MP' => '1',
			'NO' => '47', 'OM' => '968', 'PK' => '92', 'PW' => '680', 'PS' => '970', 'PA' => '507',
			'PG' => '675', 'PY' => '595', 'PE' => '51', 'PH' => '63', 'PN' => '64', 'PL' => '48',
			'PT' => '351', 'PR' => '1', 'QA' => '974', 'RE' => '262', 'RO' => '40', 'RU' => '7',
			'RW' => '250', 'BL' => '590', 'SH' => '290', 'KN' => '1', 'LC' => '1', 'MF' => '590',
			'PM' => '508', 'VC' => '1', 'WS' => '685', 'SM' => '378', 'ST' => '239', 'SA' => '966',
			'SN' => '221', 'RS' => '381', 'SC' => '248', 'SL' => '232', 'SG' => '65', 'SX' => '1',
			'SK' => '421', 'SI' => '386', 'SB' => '677', 'SO' => '252', 'ZA' => '27', 'GS' => '500',
			'SS' => '211', 'ES' => '34', 'LK' => '94', 'SD' => '249', 'SR' => '597', 'SJ' => '47',
			'SE' => '46', 'CH' => '41', 'SY' => '963', 'TW' => '886', 'TJ' => '992', 'TZ' => '255',
			'TH' => '66', 'TL' => '670', 'TG' => '228', 'TK' => '690', 'TO' => '676', 'TT' => '1',
			'TN' => '216', 'TR' => '90', 'TM' => '993', 'TC' => '1', 'TV' => '688', 'UG' => '256',
			'UA' => '380', 'AE' => '971', 'GB' => '44', 'US' => '1', 'UY' => '598', 'UZ' => '998',
			'VU' => '678', 'VE' => '58', 'VN' => '84', 'VG' => '1', 'VI' => '1', 'WF' => '681',
			'EH' => '212', 'YE' => '967', 'ZM' => '260', 'ZW' => '263',
		);
	}

	/**
	 * Country names in English, the names the browser stores when a Country
	 * field is set to save the name.
	 *
	 * @return array<string,string> ISO code => English name.
	 */
	public static function englishNames(): array {
		if ( ! function_exists( 'add_filter' ) ) {
			return self::getAll();
		}
		$untranslated = static function ( $translation, $text ) {
			return $text;
		};
		add_filter( 'gettext_subtleforms', $untranslated, PHP_INT_MAX, 2 );
		$names = self::getAll();
		remove_filter( 'gettext_subtleforms', $untranslated, PHP_INT_MAX );
		return $names;
	}
}
