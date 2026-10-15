const storageKey = "kkps-pmo:unified-planning-calendar:v1";

export function loadSelectedCalendarId() { return window.localStorage.getItem(storageKey) ?? ""; }
export function saveSelectedCalendarId(calendarId: string) { window.localStorage.setItem(storageKey, calendarId); }
