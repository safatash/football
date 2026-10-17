import { PlayerStatusBadge, RoleTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Crest } from "@/components/league";
import { AppBar, Screen } from "@/components/shell/layout";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PasswordForm } from "./password-form";
import { LogoutButton, ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function PlayerProfilePage() {
  const session = await requireUser("/portal/profile");
  const playerId = session.user.playerId;
  const player = playerId
    ? await prisma.player.findUnique({
        where: { id: playerId },
        include: {
          user: { select: { email: true } },
          teamMemberships: {
            where: { leftAt: null, membershipType: "SEASONAL" },
            include: { team: { include: { division: true } } },
            orderBy: { joinedAt: "asc" },
          },
        },
      })
    : null;

  if (!player) {
    return (
      <>
        <AppBar title="Profile" width="wide" />
        <Screen width="narrow">
          <EmptyState
            icon="user"
            title="No player profile yet"
            action={
              <ButtonLink href="/register/new" variant="accent" size="sm">
                Register for the season
              </ButtonLink>
            }
          >
            Your player details are created when you register.
          </EmptyState>
          <PasswordForm />
          {session.user.isAdmin ? (
            <ButtonLink href="/admin" variant="ghost" block>
              Go to the league office
            </ButtonLink>
          ) : null}
          <LogoutButton />
        </Screen>
      </>
    );
  }

  const name = `${player.firstName} ${player.lastName}`;
  const initials = `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase();

  return (
    <>
      <AppBar title="Profile" width="wide" />
      <Screen width="wide" className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-7">
        <div className="flex items-center gap-3.5 lg:col-span-2">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-lime text-[22px] font-bold text-lime-ink">{initials}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[28px]">{name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              Player since {player.registrationDate.getFullYear()} <PlayerStatusBadge status={player.status} />
            </div>
          </div>
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <ProfileForm
            values={{
              firstName: player.firstName,
              lastName: player.lastName,
              dob: player.dob.toISOString().slice(0, 10),
              position: player.position,
              tshirtSize: player.tshirtSize,
              email: player.user.email,
              phone: player.phone,
              address: player.address,
              city: player.city,
              state: player.state,
              zip: player.zip,
              contactMe: player.contactMe,
              social: player.social,
              tournaments: player.tournaments,
            }}
          />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[84px] lg:col-start-2 lg:row-start-2">
          <Card>
            <h3 className="mb-2 text-[19px] font-bold">Teams &amp; access</h3>
            {player.teamMemberships.length ? (
              <ul className="flex flex-col">
                {player.teamMemberships.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <Crest name={m.team.name} />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{m.team.name}</b>
                      <span className="text-xs text-muted">
                        {i === 0 ? "Primary team" : "Additional team"} · {m.team.division.name}
                      </span>
                    </div>
                    <RoleTag role={m.isCaptain ? "Captain" : "Player"} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">You’re not on a team yet.</p>
            )}
          </Card>
          <PasswordForm />
          <LogoutButton />
        </aside>
      </Screen>
    </>
  );
}
