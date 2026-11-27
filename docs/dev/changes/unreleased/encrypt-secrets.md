type: Security
API keys and secrets are now stored encrypted, including a CAPTCHA field's own secret key, which is also left out of form exports, and a saved secret that can no longer be read is treated as missing and asked for again.
