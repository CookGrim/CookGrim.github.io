import { useState } from "react";
import { ApiError } from "../lib/api";
import { useSession } from "../lib/auth-client";
import {
  useAcceptInvite,
  useDeclineInvite,
  useGroup,
  useInviteToGroup,
  useLeaveGroup,
  useRemoveGroupMember,
  useRenameGroup,
  useRevokeInvite,
  useTransferOwnership,
} from "../lib/queries/group";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function GroupSettingsSection() {
  const { data: session } = useSession();
  const { data: group, isLoading, isError } = useGroup();
  const renameGroup = useRenameGroup();
  const inviteToGroup = useInviteToGroup();
  const revokeInvite = useRevokeInvite();
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();
  const leaveGroup = useLeaveGroup();
  const removeMember = useRemoveGroupMember();
  const transferOwnership = useTransferOwnership();

  const [name, setName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [leaveMessage, setLeaveMessage] = useState<string | null>(null);

  if (isLoading) return <p className="text-(--color-text-muted)">Chargement…</p>;
  if (isError || !group) return <p className="text-sm text-red-600">Impossible de charger le groupe.</p>;

  const myUserId = session?.user.id;
  const isOwner = group.role === "owner";
  const isSoleMember = group.members.length <= 1;

  const onStartRename = () => {
    setName(group.group.name);
    setIsEditingName(true);
  };

  const onSaveName = async () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== group.group.name) {
      await renameGroup.mutateAsync(trimmed);
    }
    setIsEditingName(false);
  };

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage(null);
    try {
      await inviteToGroup.mutateAsync(pseudo.trim());
      setInviteMessage(`Invitation envoyée à @${pseudo.trim()}.`);
      setPseudo("");
    } catch (err) {
      setInviteMessage(errorMessage(err, "Impossible d'envoyer l'invitation, réessayez."));
    }
  };

  const onLeave = async () => {
    if (!window.confirm("Quitter ce groupe ? Vous perdrez l'accès à ses recettes, son stock et ses listes.")) {
      return;
    }
    setLeaveMessage(null);
    try {
      await leaveGroup.mutateAsync();
    } catch (err) {
      setLeaveMessage(errorMessage(err, "Impossible de quitter le groupe, réessayez."));
    }
  };

  const onRemoveMember = (userId: string, pseudo: string) => {
    if (window.confirm(`Retirer @${pseudo} du groupe ?`)) {
      removeMember.mutate(userId);
    }
  };

  const onTransferOwnership = (userId: string, pseudo: string) => {
    if (
      window.confirm(`Faire de @${pseudo} le nouveau propriétaire du groupe ? Vous deviendrez simple membre.`)
    ) {
      transferOwnership.mutate(userId);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-(--color-surface-line) bg-(--color-surface) p-4">
        {isEditingName ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="min-w-0 flex-1 rounded-lg border border-(--color-surface-line) bg-(--color-bg) px-3 py-1.5 text-(--color-text)"
            />
            <button
              type="button"
              onClick={onSaveName}
              disabled={renameGroup.isPending}
              className="rounded-full bg-(--color-plum) px-4 py-1.5 text-sm font-medium text-(--color-tile-fg) disabled:opacity-60"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setIsEditingName(false)}
              className="text-sm text-(--color-text-muted) hover:text-red-600"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-(--color-text)">
              {group.group.name}
            </h3>
            {isOwner && (
              <button
                type="button"
                onClick={onStartRename}
                className="text-sm text-(--color-plum) underline underline-offset-4"
              >
                Renommer
              </button>
            )}
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {group.members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center gap-3 rounded-lg bg-(--color-bg) px-3 py-2"
            >
              <span className="flex-1 font-medium text-(--color-text)">
                @{member.pseudo}
                {member.userId === myUserId && (
                  <span className="ml-1 font-normal text-(--color-text-muted)">(vous)</span>
                )}
              </span>
              {member.role === "owner" && (
                <span className="rounded-full bg-(--color-saffron)/20 px-2 py-0.5 text-xs font-medium text-(--color-text)">
                  Propriétaire
                </span>
              )}
              {isOwner && member.userId !== myUserId && (
                <button
                  type="button"
                  onClick={() => onTransferOwnership(member.userId, member.pseudo)}
                  className="text-sm text-(--color-plum) underline underline-offset-4"
                >
                  Nommer propriétaire
                </button>
              )}
              {isOwner && member.userId !== myUserId && (
                <button
                  type="button"
                  onClick={() => onRemoveMember(member.userId, member.pseudo)}
                  className="text-sm text-(--color-text-muted) hover:text-red-600"
                >
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>

        {!isSoleMember && (
          <button
            type="button"
            onClick={onLeave}
            disabled={leaveGroup.isPending}
            className="self-start text-sm text-(--color-text-muted) hover:text-red-600 disabled:opacity-60"
          >
            Quitter le groupe
          </button>
        )}
        {leaveMessage && <p className="text-sm text-red-600">{leaveMessage}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-base font-semibold text-(--color-text)">
          Inviter quelqu'un
        </h3>
        <form onSubmit={onInvite} className="flex flex-wrap items-center gap-2">
          <input
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Pseudo à inviter"
            required
            className="min-w-0 flex-1 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
          />
          <button
            type="submit"
            disabled={inviteToGroup.isPending || pseudo.trim().length === 0}
            className="rounded-full bg-(--color-saffron) px-4 py-2 text-sm font-semibold text-(--color-plum) transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {inviteToGroup.isPending ? "Envoi…" : "Inviter"}
          </button>
        </form>
        {inviteMessage && <p className="text-sm text-(--color-text-muted)">{inviteMessage}</p>}

        {group.sentInvites.length > 0 && (
          <ul className="flex flex-col gap-2">
            {group.sentInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center gap-3 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2"
              >
                <span className="flex-1 text-(--color-text)">
                  @{invite.inviteePseudo} — en attente
                </span>
                <button
                  type="button"
                  onClick={() => revokeInvite.mutate(invite.id)}
                  disabled={revokeInvite.isPending}
                  className="text-sm text-(--color-text-muted) hover:text-red-600 disabled:opacity-60"
                >
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {group.receivedInvites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-display text-base font-semibold text-(--color-text)">
            Invitations reçues
          </h3>
          <ul className="flex flex-col gap-2">
            {group.receivedInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2"
              >
                <span className="flex-1 text-(--color-text)">
                  @{invite.inviterPseudo} vous invite à rejoindre « {invite.groupName} »
                </span>
                <button
                  type="button"
                  onClick={() => acceptInvite.mutate(invite.id)}
                  disabled={acceptInvite.isPending}
                  className="rounded-full bg-(--color-plum) px-4 py-1.5 text-sm font-medium text-(--color-tile-fg) disabled:opacity-60"
                >
                  Accepter
                </button>
                <button
                  type="button"
                  onClick={() => declineInvite.mutate(invite.id)}
                  disabled={declineInvite.isPending}
                  className="text-sm text-(--color-text-muted) hover:text-red-600 disabled:opacity-60"
                >
                  Refuser
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
