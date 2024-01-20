import { CONFIGS } from '../consts/configs';
import { logger } from '../utils/logger';
import { sleep } from '../utils/sleep';

export type TGoogleCalendar = GoogleAppsScript.Calendar.Schema.Calendar;
export type TGoogleEvent = GoogleAppsScript.Calendar.Schema.Event;
export type TGcalPrivateTicktick = {
  private: {
    tickTaskId: string;
    calendar: string;
    completedCalendar: string;
  };
};

export type TParsedGoogleEvent = Pick<TGoogleEvent, 'colorId' | 'id' | 'summary' | 'description' | 'htmlLink' | 'attendees' | 'visibility' | 'reminders' | 'start' | 'end' | 'created' | 'updated'> & { extendedProperties: TGcalPrivateTicktick };

// =============================================================================

export const createMissingCalendars = (allGcalendarsNames: string[]) => {
  let createdCalendar = false;

  allGcalendarsNames.forEach((calName: string) => {
    if (!checkIfCalendarExists(calName)) {
      createCalendar(calName);
      logger.info(`created google calendar: [${calName}]`);
      createdCalendar = true;
    }
  });

  if (createdCalendar) {
    sleep(2000);
  }
};

export const getAllCalendars = () => {
  const calendars = Calendar.CalendarList!.list({ showHidden: true }).items ?? [];
  return calendars;
};

const checkIfCalendarExists = (calendarName: string) => {
  const allCalendars = getAllCalendars();
  const calendar = allCalendars.find((cal) => cal.summary === calendarName);
  return calendar;
};

const createCalendar = (calName: string) => {
  const calendarObj = Calendar;
  const owenedCalendars = calendarObj.CalendarList!.list({ showHidden: true }).items!.filter((cal) => cal.accessRole === 'owner');
  const doesCalendarExists = owenedCalendars.map((cal) => cal.summary).includes(calName);

  if (doesCalendarExists) {
    throw new Error(`calendar ${calName} already exists!`);
  }

  const tmpCalendar = calendarObj.newCalendar();
  tmpCalendar.summary = calName;
  tmpCalendar.timeZone = calendarObj.Settings!.get('timezone').value;

  const calendar = calendarObj.Calendars!.insert(tmpCalendar);
  return calendar;
};

export function getCalendarByName(calName: string) {
  const calendar = getAllCalendars().find((cal) => cal.summary === calName);
  return calendar;
}

function parseGoogleEvent(ev: TGoogleEvent) {
  const parsedGoogleEvent: TParsedGoogleEvent = {
    id: ev.id,
    summary: ev.summary,
    description: ev.description ?? '',
    htmlLink: ev.htmlLink,
    attendees: ev.attendees ?? [],
    reminders: ev.reminders ?? {},
    visibility: ev.visibility ?? 'default',
    start: ev.start,
    end: ev.end,
    created: ev.created,
    updated: ev.updated,
    colorId: ev.colorId,
    extendedProperties: (ev.extendedProperties ?? {}) as TGcalPrivateTicktick
  };

  return parsedGoogleEvent;
}

function getEventsFromCalendar(calendar: TGoogleCalendar) {
  const allEvents = Calendar.Events.list(calendar.id, { maxResults: CONFIGS.MAX_GCAL_TASKS }).items;
  const parsedEventsArr = allEvents.map((ev) => parseGoogleEvent(ev));
  return parsedEventsArr;
}

export function getTasksFromGoogleCalendars(allCalendars: string[]) {
  const tasks: TParsedGoogleEvent[] = allCalendars.reduce((acc, cur) => {
    const taskCalendar = cur;
    const calendar = getCalendarByName(taskCalendar);
    const tasksArray = getEventsFromCalendar(calendar);
    return [...acc, ...tasksArray];
  }, []);

  return tasks;
}

export function addEventToCalendar(calendar: TGoogleCalendar, event: TGoogleEvent) {
  try {
    const eventFinal = Calendar.Events.insert(event, calendar.id);
    return eventFinal;
  } catch (e: any) {
    logger.info(`error when adding event [${event.summary}] to gcal: ${e.message}`);
    return event;
  }
}

export function moveEventToOtherCalendar(calendar: TGoogleCalendar, newCalendar: TGoogleCalendar, event: TGoogleEvent) {
  removeCalendarEvent(calendar, event);
  Utilities.sleep(1500);
  const newEvent = addEventToCalendar(newCalendar, event);
  return newEvent;
}

function removeCalendarEvent(calendar: TGoogleCalendar, event: TGoogleEvent) {
  try {
    Calendar.Events.remove(calendar.id, event.id);
  } catch (e: any) {
    logger.info(`error when deleting event [${event.summary}] to gcal: ${e.message}`);
  }
}
