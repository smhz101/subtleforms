type: Fixed
Forms with AJAX off lost every entry: the classic post handler was only registered on REST requests (broken since 2.4.0). The block default is now AJAX on, so form blocks saved without an AJAX setting now submit with AJAX.
