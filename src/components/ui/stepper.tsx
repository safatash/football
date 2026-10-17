export function Stepper({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div className="flex flex-col gap-2" aria-label={`Step ${current} of ${total}: ${label}`}>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={`h-[5px] rounded-[3px] ${i + 1 < current ? "bg-pitch-2" : i + 1 === current ? "bg-lime" : "bg-surface-3"}`} />
        ))}
      </div>
      <div className="flex justify-between text-[12.5px] font-bold text-muted">
        <span>
          Step {current} of {total}
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
}
