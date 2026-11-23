# Next release

Manual steps the next release needs on the Pi: new settings in `deploy/.env`, one-off commands,
checks that only work against production. Every PR that needs such a step adds it here, under the
PR number. After the release, delete the done items and leave the empty headings.

Secrets and personal addresses never go in this file: name the variable and say where its value
comes from.

## Before publishing the release

Settings the new version reads at startup. The Pi redeploys as soon as the release is published,
so set them in `deploy/.env` first.

- [ ] #44 — `MAIL_FROM_NAME=NOREPLY Berdi racing`
- [ ] #44 — `MAIL_CONTACT=<the address users can write to with questions>`

## After the deploy

- [ ] #44 — Request a password reset for test accounts at GMX, Gmail and iCloud. Each mail should
  land in the inbox, show the dark layout with the sender name and contact line, and pass
  `spf=pass` and `dkim=pass` in `Authentication-Results`
  (see [Outgoing mail](DEPLOY-PI.md#outgoing-mail)).
