let calendar,
  selectedEvent = null,
  allEvents = [],
  isScheduleLoading = false,
  lastScheduleRefresh = 0;
const portraitQuery = matchMedia("(orientation: portrait)");
const scheduleUrl =
  "https://raw.githubusercontent.com/WinchellWang/Queens-ARC-Schedule/main/gym.ics";
const scheduleRefreshInterval = 60_000;
const startOfWeek = (date) => {
  const value = new Date(date),
    day = value.getDay();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - day);
  return value;
};
const rangeStart = startOfWeek(new Date()),
  rangeEnd = new Date(rangeStart);
rangeEnd.setDate(rangeEnd.getDate() + 14);
const brandHome = document.querySelector(".brand-home");
brandHome?.addEventListener("click", (event) => {
  event.preventDefault();
  window.location.reload();
});
document.addEventListener("DOMContentLoaded", () => {
  calendar = new FullCalendar.Calendar(
    document.getElementById("calendar"),
    {
      initialView: portraitQuery.matches ? "listWeek" : "timeGridWeek",
      initialDate: new Date(),
      validRange: { start: rangeStart, end: rangeEnd },
      headerToolbar: {
        left: "thisWeek",
        center: "title",
        right: "nextWeek",
      },
      customButtons: {
        thisWeek: {
          text: "This Week",
          click: () => calendar.gotoDate(rangeStart),
        },
        nextWeek: {
          text: "Next Week",
          click: () => {
            const nextWeekStart = new Date(rangeStart);
            nextWeekStart.setDate(nextWeekStart.getDate() + 7);
            calendar.gotoDate(nextWeekStart);
          },
        },
      },
      firstDay: 0,
      slotMinTime: "06:00:00",
      slotMaxTime: "23:00:00",
      height: portraitQuery.matches ? "auto" : "100%",
      expandRows: true,
      nowIndicator: true,
      allDaySlot: false,
      navLinks: false,
      eventContent: renderEvent,
      eventClick: (info) => {
        info.jsEvent.preventDefault();
        showModal(info.event);
      },
      datesSet: updateNavigationState,
    },
  );
  calendar.render();
  activityFilter.addEventListener("change", () => applyFilters(true));
  locationFilter.addEventListener("change", () => applyFilters(true));
  document
    .querySelector("[data-close-modal]")
    .addEventListener("click", closeModal);
  addToCalBtn.addEventListener("click", addToCalendar);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  portraitQuery.addEventListener("change", (event) => {
    calendar.setOption("height", event.matches ? "auto" : "100%");
    calendar.changeView(event.matches ? "listWeek" : "timeGridWeek");
    calendar.updateSize();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshScheduleIfNeeded();
    }
  });
  preventGestureZoom();
  refreshScheduleIfNeeded(true);
});
function updateNavigationState(info) {
  requestAnimationFrame(() => {
    const thisWeekButton = document.querySelector(".fc-thisWeek-button");
    const nextWeekButton = document.querySelector(".fc-nextWeek-button");
    const isThisWeek = info.start.getTime() === rangeStart.getTime();
    if (thisWeekButton) thisWeekButton.disabled = isThisWeek;
    if (nextWeekButton) nextWeekButton.disabled = !isThisWeek;
  });
}
function renderEvent(arg) {
  const wrap = document.createElement("div"),
    title = document.createElement("div");
  title.className = "event-title";
  title.textContent = arg.event.title;
  wrap.appendChild(title);
  const location = arg.event.extendedProps.location;
  if (location) {
    const loc = document.createElement("div");
    loc.className = "event-location";
    loc.textContent = `📍 ${location}`;
    wrap.appendChild(loc);
  }
  return { domNodes: [wrap] };
}
async function refreshScheduleIfNeeded(force = false) {
  const now = Date.now();
  if (isScheduleLoading) return;
  if (!force && now - lastScheduleRefresh < scheduleRefreshInterval) return;
  await fetchAndParseICS();
}
async function fetchAndParseICS() {
  if (isScheduleLoading) return;
  isScheduleLoading = true;
  setScheduleLoading(true);
  try {
    const response = await fetch(`${scheduleUrl}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Schedule request failed: ${response.status}`);
    }
    const data = await response.text();
    parseICS(data);
    lastScheduleRefresh = Date.now();
    setScheduleLoading(false);
  } catch (error) {
    console.error("Could not load schedule:", error);
    setScheduleLoading(false);
    showScheduleToast("Unable to load the latest schedule.");
  } finally {
    isScheduleLoading = false;
  }
}
function setScheduleLoading(isLoading) {
  const status = document.getElementById("scheduleStatus");
  const text = document.getElementById("scheduleStatusText");
  if (!status || !text) return;
  status.hidden = !isLoading;
  if (isLoading) {
    text.textContent = "Loading latest schedule…";
  }
}
function parseICS(data) {
  try {
    const component = new ICAL.Component(ICAL.parse(data));
    const eventGroups = new Map();
    component.getAllSubcomponents("vevent").forEach((raw, index) => {
      const uid = raw.getFirstPropertyValue("uid") || `missing-uid-${index}`;
      if (!eventGroups.has(uid)) eventGroups.set(uid, []);
      eventGroups.get(uid).push(raw);
    });
    allEvents = [...eventGroups.values()].flatMap((components) => {
      const exceptions = components.filter((raw) =>
        raw.hasProperty("recurrence-id"),
      );
      return components
        .filter((raw) => !raw.hasProperty("recurrence-id"))
        .flatMap((raw) => {
          const event = new ICAL.Event(raw),
            exceptionMap = new Map(
              exceptions.map((exception) => {
                const exceptionEvent = new ICAL.Event(exception);
                return [exceptionEvent.recurrenceId.toString(), exceptionEvent];
              }),
            );
          if (!event.isRecurring())
            return makeScheduleEvent(event, event.startDate, event.endDate);
          const occurrences = [],
            iterator = event.iterator();
          let occurrence;
          while ((occurrence = iterator.next())) {
            if (occurrence.toJSDate() >= rangeEnd) break;
            const exception = exceptionMap.get(occurrence.toString()),
              occurrenceEvent = exception || event,
              occurrenceStart = exception?.startDate || occurrence,
              occurrenceEnd = exception?.endDate || occurrence.clone();
            if (!exception) occurrenceEnd.addDuration(event.duration);
            occurrences.push(
              ...makeScheduleEvent(
                occurrenceEvent,
                occurrenceStart,
                occurrenceEnd,
              ),
            );
          }
          return occurrences;
        });
    });
    populateDropdowns();
    applyFilters(false);
  } catch (error) {
    console.error("Could not parse schedule:", error);
    throw error;
  }
}
function makeScheduleEvent(event, start, end) {
  const status = event.component.getFirstPropertyValue("status");
  if (
    (status && status.toUpperCase() === "CANCELLED") ||
    !event.location?.trim() ||
    start.toJSDate() >= rangeEnd ||
    end.toJSDate() < rangeStart
  )
    return [];
  const summary = event.summary || "Untitled activity",
    lower = summary.toLowerCase();
  let color = "#ea580c";
  if (lower.includes("basketball")) color = "#f59e0b";
  if (lower.includes("pickleball")) color = "#9333ea";
  if (lower.includes("volleyball")) color = "#0d9488";
  if (lower.includes("futsal") || lower.includes("soccer")) color = "#be123c";
  if (lower.includes("spikeball")) color = "#84cc16";
  if (lower.includes("yoga") || lower.includes("pilates")) color = "#16a34a";
  if (
    lower.includes("swim") ||
    lower.includes("pool") ||
    lower.includes("aquafit")
  )
    color = "#0284c7";
  if (lower.includes("zumba") || lower.includes("dance")) color = "#db2777";
  if (lower.includes("barre")) color = "#7c3aed";
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
  activityFilter.innerHTML = '<option value="all">All</option>';
  locationFilter.innerHTML = '<option value="all">All</option>';
  const add = (select, values) =>
    [...values]
      .sort()
      .forEach((value) => select.add(new Option(value, value)));
  add(
    activityFilter,
    new Set(allEvents.map((e) => e.title).filter(Boolean)),
  );
  add(
    locationFilter,
    new Set(
      allEvents.map((e) => e.extendedProps.location).filter(Boolean),
    ),
  );
  const a = localStorage.getItem("gym_activity"),
    l = localStorage.getItem("gym_location");
  if ([...activityFilter.options].some((o) => o.value === a))
    activityFilter.value = a;
  if ([...locationFilter.options].some((o) => o.value === l))
    locationFilter.value = l;
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
        (l === "all" || e.extendedProps.location === l),
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
function makeCalendarFile(event) {
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
  return new File(
    [content],
    `${event.title.replace(/[^a-z0-9_-]+/gi, "_") || "ARC_event"}.ics`,
    { type: "text/calendar;charset=utf-8" },
  );
}
function downloadCalendarFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function addToCalendar() {
  if (!selectedEvent) return;
  downloadCalendarFile(makeCalendarFile(selectedEvent));
}
function showModal(event) {
  selectedEvent = event;
  modalTitle.textContent = event.title;
  locText.textContent =
    event.extendedProps.location || "No location information";
  const date = event.start.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time = `${event.start.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })} – ${event.end.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  modalTime.textContent = `${date} • ${time}`;
  const text = cleanDescription(event.extendedProps.description);
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
let scheduleToastTimer = null;
function showScheduleToast(message) {
  const toast = document.getElementById("scheduleToast");
  if (!toast) return;
  if (scheduleToastTimer) {
    clearTimeout(scheduleToastTimer);
  }
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove("is-hiding");
  scheduleToastTimer = window.setTimeout(() => {
    toast.classList.add("is-hiding");
    window.setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove("is-hiding");
    }, 220);
  }, 2000);
}