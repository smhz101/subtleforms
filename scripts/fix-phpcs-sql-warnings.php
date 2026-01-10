#!/usr/bin/env php
<?php
/**
 * Script to add phpcs ignore comments for safe table name interpolation
 * across all SubtleForms repositories.
 *
 * Run: php fix-phpcs-sql-warnings.php
 */

$fixes = [
	// LogsRepository.php
	[
		'file'   => 'src/Repositories/LogsRepository.php',
		'line'   => 146,
		'search' => "\t\treturn (int) \$wpdb->get_var( \"SELECT COUNT(*) FROM {\$this->table}{\$where}\" );",
		'replace' => "\t\t// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery -- Table name safe.\n\t\treturn (int) \$wpdb->get_var( \"SELECT COUNT(*) FROM {\$this->table}{\$where}\" );",
	],
	// SubmissionsRepository.php - add multiple fixes
	[
		'file'   => 'src/Repositories/SubmissionsRepository.php',
		'line'   => 59,
		'search' => "\t\t\t\"SELECT COUNT(*) FROM {\$this->table}{\$where}\",",
		'replace' => "\t\t\t// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared\n\t\t\t\"SELECT COUNT(*) FROM {\$this->table}{\$where}\",",
	],
	[
		'file'   => 'src/Repositories/SubmissionsRepository.php',
		'line'   => 162,
		'search' => "\t\t\t\"SELECT * FROM {\$this->table}{\$where}{\$orderby}{\$limit}\",",
		'replace' => "\t\t\t// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared\n\t\t\t\"SELECT * FROM {\$this->table}{\$where}{\$orderby}{\$limit}\",",
	],
];

$base_dir = dirname( __DIR__ );

foreach ( $fixes as $fix ) {
	$file_path = $base_dir . '/' . $fix['file'];
	
	if ( ! file_exists( $file_path ) ) {
		echo "Skipping {$fix['file']} - file not found\n";
		continue;
	}
	
	$content = file_get_contents( $file_path );
	
	if ( strpos( $content, $fix['search'] ) === false ) {
		echo "Skipping {$fix['file']} line {$fix['line']} - pattern not found\n";
		continue;
	}
	
	$content = str_replace( $fix['search'], $fix['replace'], $content );
	file_put_contents( $file_path, $content );
	
	echo "✓ Fixed {$fix['file']} line {$fix['line']}\n";
}

echo "\nDone! Re-run phpcs to verify.\n";
