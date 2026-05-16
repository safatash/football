import { PrototypeShell, SectionCard } from "@/components/prototype-shell";
import { ButtonLink } from "@/components/ui/button";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { registrationFeeTable } from "@/lib/mock-data";

export default function RegisterPage() {
  return (
    <PrototypeShell
      role="player"
      title="Register"
      subtitle="Choose the right path before entering the actual registration flow."
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Register with a team">
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">Use this path for standard seasonal registration when the player is joining or returning to a team.</p>
            <div className="grid gap-3">
              <ButtonLink href="/register/account" variant="secondary">Returning player</ButtonLink>
              <ButtonLink href="/login" variant="secondary">Login</ButtonLink>
              <ButtonLink href="/register/account" variant="secondary">Retrieve player information</ButtonLink>
              <ButtonLink href="/register/account">New player</ButtonLink>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Buy a game pass ($15 per game)">
            <div className="space-y-4 text-sm">
              <p className="text-slate-600">Game passes should mirror the regular registration entry pattern, but still stay limited to one specific match and never create lasting roster membership.</p>
              <div className="grid gap-3">
                <ButtonLink href="/register/game-pass/returning" variant="secondary">Returning player</ButtonLink>
                <ButtonLink href="/login" variant="secondary">Login</ButtonLink>
                <ButtonLink href="/register/game-pass/account" variant="secondary">Retrieve player information</ButtonLink>
                <ButtonLink href="/register/game-pass/new">New player</ButtonLink>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Division age requirements & fees">
            <TableWrap>
              <DataTable>
                <TableHead>
                  <tr>
                    <HeadCell>Division</HeadCell>
                    <HeadCell>Age Requirement</HeadCell>
                    <HeadCell>Fee</HeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {registrationFeeTable.map((row) => (
                    <BodyRow key={row.division}>
                      <BodyCell className="font-medium">{row.division}</BodyCell>
                      <BodyCell>{row.ageRule}</BodyCell>
                      <BodyCell>{row.fee}</BodyCell>
                    </BodyRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrap>
          </SectionCard>
        </div>
      </div>
    </PrototypeShell>
  );
}
