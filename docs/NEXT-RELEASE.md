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
- [ ] #46 — `ADMIN_EMAILS=<your own account's address>`; without it nobody is an admin.
  `APP_PUBLIC_URL` needs no entry: the Pi compose file builds it from `APP_HOSTNAME`.

## After the deploy

- [ ] #44 — Request a password reset for test accounts at GMX, Gmail and iCloud. Each mail should
  land in the inbox, show the dark layout with the sender name and contact line, and pass
  `spf=pass` and `dkim=pass` in `Authentication-Results`
  (see [Outgoing mail](DEPLOY-PI.md#outgoing-mail)).
- [ ] #46 — The backend log shows `Granted admin to <your address>` and no
  `could not be mailed` warning, and existing accounts can still log in.
- [ ] #51 — Under "Benutzer verwalten", invite a test address of your own. Open the link from the
  mail on the iPhone, set a password, and check you land in an empty app. Open the link again: it
  must say the invitation is no longer valid. Then delete the test account.
- [ ] #51 — `POST /api/auth/register` answers `404`, and the login screen offers no registration.
- [ ] #54 — Under "E-Mail-Adresse ändern", move a test account to another address of your own: the
  code arrives at the new address, the notice "E-Mail-Adresse geändert" at the old one, and you
  stay logged in. Log in with the new address, then change it back.
- [ ] #54 — Before changing your own admin account's address, put the new one in `ADMIN_EMAILS` in
  `deploy/.env`; otherwise the next start creates an invited admin for the old address.
