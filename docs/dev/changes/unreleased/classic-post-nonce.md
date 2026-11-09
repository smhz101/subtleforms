type: Fixed
A form post without AJAX from a logged-in visitor now carries the REST nonce; a post without a valid one is handled as a guest post, so a cross-site post cannot act as the logged-in user.
