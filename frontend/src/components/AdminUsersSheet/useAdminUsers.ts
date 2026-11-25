import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { inviteUser, listUsers, type AdminUser, type Invitation } from '../../api/admin';

/** The list, one user opened from it, or the invitation just made. */
type View =
  { kind: 'list' } | { kind: 'user'; id: number } | { kind: 'invited'; invitation: Invitation };

/** The state behind `AdminUsersSheet`: the user list, the invite form, and which view is open. */
export function useAdminUsers(onError: (message: string) => void) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped to load the list again after it turned out to be out of date.
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listUsers().then((list) => {
      if (cancelled) return;
      if (list) setUsers(list);
      else onError('Benutzer konnten nicht geladen werden.');
    });
    return () => {
      cancelled = true;
    };
  }, [onError, loadCount]);

  const replaceUser = (user: AdminUser) =>
    setUsers((list) => list?.map((u) => (u.id === user.id ? user : u)) ?? list);

  const showList = () => setView({ kind: 'list' });

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setBusy(true);
    const result = await inviteUser(email.trim(), displayName.trim());
    setBusy(false);
    if (result === 'conflict') setInviteError('Zu dieser E-Mail gibt es schon ein Konto.');
    else if (result === 'failed') setInviteError('Einladen fehlgeschlagen — Backend erreichbar?');
    else {
      setUsers((list) => (list ? [...list, result.user] : list));
      setEmail('');
      setDisplayName('');
      setView({ kind: 'invited', invitation: result });
    }
  };

  return {
    users,
    invitation: view.kind === 'invited' ? view.invitation : null,
    opened: view.kind === 'user' ? users?.find((u) => u.id === view.id) : undefined,
    email,
    setEmail,
    displayName,
    setDisplayName,
    inviteError,
    busy,
    handleInvite,
    showList,
    openUser: (id: number) => setView({ kind: 'user', id }),
    handleChanged: replaceUser,
    handleResent: (invitation: Invitation) => {
      replaceUser(invitation.user);
      setView({ kind: 'invited', invitation });
    },
    handleDeleted: () => {
      if (view.kind === 'user') setUsers((list) => list?.filter((u) => u.id !== view.id) ?? list);
      showList();
    },
    handleStale: () => {
      onError('Der Benutzer wurde inzwischen geändert. Die Liste ist neu geladen.');
      setLoadCount((n) => n + 1);
    },
  };
}
