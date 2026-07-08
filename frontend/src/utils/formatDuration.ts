// Shared by RuleRow (threshold/cooldown display) and NotificationItem
// (context values) — every duration in the domain model is stored in raw
// seconds, this is the one place that turns it into "45 min" / "90 sec".
export function formatDurationSec(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 60) return `${seconds} sec`;
  const minutes = seconds / 60;
  if (Number.isInteger(minutes)) return `${minutes} min`;
  return `${minutes.toFixed(1)} min`;
}
