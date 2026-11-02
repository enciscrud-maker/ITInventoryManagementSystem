let refreshInFlight: Promise<boolean> | undefined

export function refreshSession(
  refresh: () => Promise<boolean>,
): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refresh().finally(() => {
      refreshInFlight = undefined
    })
  }
  return refreshInFlight
}
