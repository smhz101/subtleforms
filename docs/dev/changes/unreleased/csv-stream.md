type: Fixed
The CSV export, Export selected included, is now sent as a file while it is written instead of being built in memory, so a very large form no longer runs out of memory, and a download that cannot start says why instead of failing silently.
