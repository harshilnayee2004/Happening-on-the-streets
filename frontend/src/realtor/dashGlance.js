function clamp(value, max) {
  return Math.max(0, Math.min(max, Number(value) || 0));
}

export function barRatio(value, cap) {
  return clamp(value, cap) / cap;
}

export function glanceFromFree(free) {
  const visits = Number(free?.visitCount) || 0;
  const invites = Number(free?.inviteCount) || 0;
  const minutes = Math.round((Number(free?.durationSecondsTotal) || 0) / 60);
  const pulse = Math.round(
    barRatio(visits, 8) * 42
    + barRatio(invites, 8) * 28
    + barRatio(minutes, 45) * 30,
  );
  return { visits, invites, minutes, pulse };
}
