type: Fixed
A logged-in visitor whose page was open for a long time can send a form with the time trap again (the form retries once with a fresh token instead of repeating "Please send it again"), and a form with AJAX off no longer creates a second entry when Submit is clicked twice while the page is posting.
