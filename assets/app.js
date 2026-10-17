let calendar,
  selectedEvent = null,
  allEvents = [],
  isScheduleLoading = false,
  lastScheduleRefresh = 0,
  showingNextWeek = false,
  scheduleToastTimer = null;
const portraitQuery = matchMedia("(orientation: portrait)");
// Live feed first; gym.ics is refreshed every 6 hours by the update-schedule
// workflow. The Pages deploy skips gym.ics changes, so prefer the GitHub raw copy
// over the bundled one.
const scheduleSources = [
  "https://ifgical.api.pgaskin.net/110.ics",
  "https://raw.githubusercontent.com/WinchellWang/Queens-ARC-Schedule/main/gym.ics",
  "./gym.ics",
];
const scheduleFetchTimeout = 8_000;
const scheduleRefreshInterval = 60_000;
const addDays = (date, days) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};
const today = new Date();
today.setHours(0, 0, 0, 0);
const rangeStart = addDays(today, -today.getDay()),
  nextWeekStart = addDays(rangeStart, 7),
  rangeEnd = addDays(rangeStart, 14);
const currentView = () => (portraitQuery.matches ? "listWeek" : "timeGridWeek");
const calendarHeight = () => (portraitQuery.matches ? "auto" : "100%");
const periodStart = (next) => (next ? nextWeekStart : rangeStart);
const goToPeriod = (next) => {
  showingNextWeek = next;
  calendar.gotoDate(periodStart(next));
};
const eventColors = [
  [["basketball"], "#f59e0b"],
  [["pickleball"], "#9333ea"],
  [["volleyball"], "#0d9488"],
  [["futsal", "soccer"], "#be123c"],
  [["spikeball"], "#84cc16"],
  [["yoga", "pilates"], "#16a34a"],
  [["swim", "pool", "aquafit"], "#0284c7"],
  [["zumba", "dance"], "#db2777"],
  [["barre"], "#7c3aed"],
];
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) =>
        console.error("Service Worker registration failed:", error),
      ),
  );
}
document.addEventListener("DOMContentLoaded", () => {
  calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
    initialView: currentView(),
    initialDate: today,
    views: {
      listWeek: {
        // Same as the time grid's column headers, e.g. "Wed 10/14".
        listDayFormat: {
          weekday: "short",
          month: "numeric",
          day: "numeric",
          omitCommas: true,
        },
        listDaySideFormat: false,
      },
    },
    validRange: { start: rangeStart, end: rangeEnd },
    headerToolbar: { left: "thisWeek", center: "title", right: "nextWeek" },
    customButtons: {
      thisWeek: { text: "This Week", click: () => goToPeriod(false) },
      nextWeek: { text: "Next Week", click: () => goToPeriod(true) },
    },
    slotMinTime: "06:00:00",
    slotMaxTime: "23:30:00",
    height: calendarHeight(),
    expandRows: true,
    nowIndicator: true,
    allDaySlot: false,
    eventContent: renderEvent,
    eventClick: (info) => {
      info.jsEvent.preventDefault();
      showModal(info.event);
    },
    datesSet: updateNavigationState,
  });
  calendar.render();
  document.querySelector(".brand-home").addEventListener("click", (event) => {
    event.preventDefault();
    window.location.reload();
  });
  activityFilter.addEventListener("change", () => applyFilters(true));
  locationFilter.addEventListener("change", () => applyFilters(true));
  document
    .querySelector("[data-close-modal]")
    .addEventListener("click", closeModal);
  addToCalBtn.addEventListener("click", addToCalendar);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  portraitQuery.addEventListener("change", () => {
    calendar.setOption("height", calendarHeight());
    applyFilters(false);
    calendar.changeView(currentView(), periodStart(showingNextWeek));
    calendar.updateSize();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshSchedule();
  });
  preventGestureZoom();
  refreshSchedule(true);
});
function updateNavigationState(info) {
  requestAnimationFrame(() => {
    const isThisWeek = info.start < nextWeekStart;
    const thisWeekButton = document.querySelector(".fc-thisWeek-button");
    const nextWeekButton = document.querySelector(".fc-nextWeek-button");
    if (thisWeekButton) thisWeekButton.disabled = isThisWeek;
    if (nextWeekButton) nextWeekButton.disabled = !isThisWeek;
  });
}
function renderEvent(arg) {
  const wrap = document.createElement("div"),
    title = document.createElement("div"),
    loc = document.createElement("div");
  title.className = "event-title";
  title.textContent = arg.event.title;
  loc.className = "event-location";
  loc.textContent = `📍 ${arg.event.extendedProps.location}`;
  wrap.append(title, loc);
  return { domNodes: [wrap] };
}
async function refreshSchedule(force = false) {
  if (isScheduleLoading) return;
  if (!force && Date.now() - lastScheduleRefresh < scheduleRefreshInterval)
    return;
  isScheduleLoading = true;
  scheduleStatus.hidden = false;
  try {
    for (const [index, url] of scheduleSources.entries()) {
      try {
        parseICS(await fetchScheduleText(url));
        lastScheduleRefresh = Date.now();
        if (index > 0) console.warn(`Loaded schedule from fallback: ${url}`);
        return;
      } catch (error) {
        console.warn(`Could not load schedule from ${url}:`, error);
      }
    }
    showScheduleToast("Unable to load the latest schedule.");
  } finally {
    scheduleStatus.hidden = true;
    isScheduleLoading = false;
  }
}
async function fetchScheduleText(url) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), scheduleFetchTimeout);
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Schedule request failed: ${response.status}`);
    }
    const data = await response.text();
    if (!data.trimStart().startsWith("BEGIN:VCALENDAR")) {
      throw new Error("Response is not an iCalendar file");
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
function parseICS(data) {
  const component = new ICAL.Component(ICAL.parse(data));
  const eventGroups = new Map();
  component.getAllSubcomponents("vevent").forEach((raw, index) => {
    const uid = raw.getFirstPropertyValue("uid") || `missing-uid-${index}`;
    if (!eventGroups.has(uid)) eventGroups.set(uid, []);
    eventGroups.get(uid).push(raw);
  });
  allEvents = [...eventGroups.values()].flatMap((components) => {
    const exceptionMap = new Map(
      components
        .filter((raw) => raw.hasProperty("recurrence-id"))
        .map((raw) => {
          const exception = new ICAL.Event(raw);
          return [exception.recurrenceId.toString(), exception];
        }),
    );
    return components
      .filter((raw) => !raw.hasProperty("recurrence-id"))
      .flatMap((raw) => {
        const event = new ICAL.Event(raw);
        if (!event.isRecurring())
          return makeScheduleEvent(event, event.startDate, event.endDate);
        const occurrences = [],
          iterator = event.iterator();
        let occurrence;
        while ((occurrence = iterator.next())) {
          if (occurrence.toJSDate() >= rangeEnd) break;
          const exception = exceptionMap.get(occurrence.toString());
          if (exception) {
            occurrences.push(
              ...makeScheduleEvent(
                exception,
                exception.startDate,
                exception.endDate,
              ),
            );
          } else {
            const end = occurrence.clone();
            end.addDuration(event.duration);
            occurrences.push(...makeScheduleEvent(event, occurrence, end));
          }
        }
        return occurrences;
      });
  });
  populateDropdowns();
  applyFilters(false);
}
function makeScheduleEvent(event, start, end) {
  const status = event.component.getFirstPropertyValue("status");
  if (
    status?.toUpperCase() === "CANCELLED" ||
    !event.location?.trim() ||
    start.toJSDate() >= rangeEnd ||
    end.toJSDate() < rangeStart
  )
    return [];
  const summary = event.summary || "Untitled activity",
    lower = summary.toLowerCase();
  let color = "#ea580c";
  for (const [keywords, value] of eventColors) {
    if (keywords.some((keyword) => lower.includes(keyword))) color = value;
  }
  return [
    {
      title: summary,
      start: start.toString(),
      end: end.toString(),
      color,
      extendedProps: {
        location: event.location,
        icalStart: start,
        icalEnd: end,
        description: event.description || "",
      },
    },
  ];
}
function populateDropdowns() {
  const fill = (select, values, saved) => {
    select.innerHTML = '<option value="all">All</option>';
    [...new Set(values.filter(Boolean))]
      .sort()
      .forEach((value) => select.add(new Option(value, value)));
    if (values.includes(saved)) select.value = saved;
  };
  fill(
    activityFilter,
    allEvents.map((e) => e.title),
    localStorage.getItem("gym_activity"),
  );
  fill(
    locationFilter,
    allEvents.map((e) => e.extendedProps.location),
    localStorage.getItem("gym_location"),
  );
}
function applyFilters(save) {
  const a = activityFilter.value,
    l = locationFilter.value;
  if (save) {
    localStorage.setItem("gym_activity", a);
    localStorage.setItem("gym_location", l);
  }
  calendar.removeAllEvents();
  calendar.addEventSource(
    allEvents.filter(
      (e) =>
        (a === "all" || e.title === a) &&
        (l === "all" || e.extendedProps.location === l) &&
        // The portrait list skips days with no events, so this hides past days.
        (!portraitQuery.matches ||
          e.extendedProps.icalStart.toJSDate() >= today),
    ),
  );
}
function cleanDescription(value) {
  const doc = new DOMParser().parseFromString(
    String(value || "").replace(/<br\s*\/?>/gi, "\n"),
    "text/html",
  );
  return doc.body.textContent || "";
}
function escapeICS(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
const pad = (value) => String(value).padStart(2, "0"),
  formatIcal = (time) =>
    `${time.year}${pad(time.month)}${pad(time.day)}T${pad(time.hour)}${pad(time.minute)}${pad(time.second)}`;
function addToCalendar() {
  if (!selectedEvent) return;
  const event = selectedEvent;
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+/, "");
  const content = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//Queen's ARC Schedule//EN\r
CALSCALE:GREGORIAN\r
BEGIN:VEVENT\r
UID:${now}-${Math.random().toString(36).slice(2)}@queens-arc-schedule\r
DTSTAMP:${now}\r
DTSTART;TZID=America/Toronto:${formatIcal(event.extendedProps.icalStart)}\r
DTEND;TZID=America/Toronto:${formatIcal(event.extendedProps.icalEnd)}\r
SUMMARY:${escapeICS(event.title)}\r
DESCRIPTION:${escapeICS(cleanDescription(event.extendedProps.description))}\r
LOCATION:${escapeICS(event.extendedProps.location)}\r
END:VEVENT\r
END:VCALENDAR`;
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9_-]+/gi, "_") || "ARC_event"}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function showModal(event) {
  const timeFormat = { hour: "numeric", minute: "2-digit" };
  const date = event.start.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time = `${event.start.toLocaleTimeString([], timeFormat)} – ${event.end.toLocaleTimeString([], timeFormat)}`;
  const text = cleanDescription(event.extendedProps.description);
  selectedEvent = event;
  modalTitle.textContent = event.title;
  locText.textContent = event.extendedProps.location;
  modalTime.textContent = `${date} • ${time}`;
  modalDesc.textContent = text;
  modalDesc.hidden = !text;
  document.documentElement.classList.add("modal-open");
  eventModal.hidden = false;
}
function closeModal() {
  if (eventModal.hidden) return;
  eventModal.hidden = true;
  selectedEvent = null;
  document.documentElement.classList.remove("modal-open");
}
function preventGestureZoom() {
  ["gesturestart", "gesturechange", "gestureend"].forEach((type) =>
    document.addEventListener(type, (event) => event.preventDefault(), {
      passive: false,
    }),
  );
  let last = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - last <= 300) event.preventDefault();
      last = now;
    },
    { passive: false },
  );
}
function showScheduleToast(message) {
  clearTimeout(scheduleToastTimer);
  scheduleToast.textContent = message;
  scheduleToast.hidden = false;
  scheduleToast.classList.remove("is-hiding");
  scheduleToastTimer = setTimeout(() => {
    scheduleToast.classList.add("is-hiding");
    setTimeout(() => {
      scheduleToast.hidden = true;
      scheduleToast.classList.remove("is-hiding");
    }, 220);
  }, 2000);
}
