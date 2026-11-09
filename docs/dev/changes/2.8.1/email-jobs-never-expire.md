type: Fixed
Notification emails are no longer lost when WP-Cron runs late: the queued email waits in the options table until it is sent instead of a transient that expired after 6 hours, and an email whose stored copy is gone is built again from the saved entry.
