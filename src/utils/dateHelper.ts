import { HolidaySettings, SpecialHoliday } from '../types';

export const HIJRI_MONTHS = [
  { id: 1, name: 'Muharram' },
  { id: 2, name: 'Safar' },
  { id: 3, name: "Rabi'ul Awwal" },
  { id: 4, name: "Rabi'ul Akhir" },
  { id: 5, name: 'Jumadil Ula' },
  { id: 6, name: 'Jumadil Akhirah' },
  { id: 7, name: 'Rajab' },
  { id: 8, name: "Sya'ban" },
  { id: 9, name: 'Ramadhan' },
  { id: 10, name: 'Syawwal' },
  { id: 11, name: "Dzulqa'dah" },
  { id: 12, name: 'Dzulhijjah' },
];

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export interface HijriDateDetails {
  hDay: number;
  hMonth: number;
  monthName: string;
  hYear: number;
  weekday: string;
  fullFormatted: string; // e.g. "Senin, 25 Rabi'ul Awwal 1448 H"
  shortFormatted: string; // e.g. "25 Rabi'ul Awwal 1448 H"
  gregorianDateStr: string; // e.g. "2026-09-07"
}

// In-memory cache for fast date conversion
const hijriDetailsCache = new Map<string, HijriDateDetails>();

/**
 * Converts a Gregorian date string (YYYY-MM-DD) into rich Hijri details.
 * Uses native Intl.DateTimeFormat with islamic-umalqura calendar.
 */
export const getHijriDateDetails = (dateStr: string): HijriDateDetails => {
  if (!dateStr) {
    return {
      hDay: 1,
      hMonth: 3,
      monthName: "Rabi'ul Awwal",
      hYear: 1448,
      weekday: 'Senin',
      fullFormatted: "1 Rabi'ul Awwal 1448 H",
      shortFormatted: "1 Rabi'ul Awwal 1448 H",
      gregorianDateStr: dateStr || '',
    };
  }

  if (hijriDetailsCache.has(dateStr)) {
    return hijriDetailsCache.get(dateStr)!;
  }

  try {
    const parts = dateStr.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);

    const intlParts = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      weekday: 'long',
    }).formatToParts(date);

    const map: Record<string, string> = {};
    intlParts.forEach((p) => {
      map[p.type] = p.value;
    });

    const hDay = parseInt(map.day, 10) || 1;
    const hMonth = parseInt(map.month, 10) || 3;
    const hYear = parseInt(map.year, 10) || 1448;
    const weekday = map.weekday || 'Senin';
    const monthObj = HIJRI_MONTHS.find((m) => m.id === hMonth);
    const monthName = monthObj ? monthObj.name : `Bulan ${hMonth}`;

    const res: HijriDateDetails = {
      hDay,
      hMonth,
      monthName,
      hYear,
      weekday,
      fullFormatted: `${weekday}, ${hDay} ${monthName} ${hYear} H`,
      shortFormatted: `${hDay} ${monthName} ${hYear} H`,
      gregorianDateStr: dateStr,
    };

    hijriDetailsCache.set(dateStr, res);
    return res;
  } catch (e) {
    console.error('Hijri parse error', e);
    return {
      hDay: 1,
      hMonth: 3,
      monthName: "Rabi'ul Awwal",
      hYear: 1448,
      weekday: 'Senin',
      fullFormatted: dateStr,
      shortFormatted: dateStr,
      gregorianDateStr: dateStr,
    };
  }
};

/**
 * Returns full Hijri date string: e.g. "Senin, 25 Rabi'ul Awwal 1448 H"
 */
export const formatHijriFull = (dateStr: string): string => {
  return getHijriDateDetails(dateStr).fullFormatted;
};

/**
 * Returns short Hijri date string: e.g. "25 Rabi'ul Awwal 1448 H"
 */
export const formatHijriShort = (dateStr: string): string => {
  return getHijriDateDetails(dateStr).shortFormatted;
};

export const formatIndonesianDate = (dateStr: string): string => {
  return formatHijriFull(dateStr);
};

export const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface HolidayCheckResult {
  isHoliday: boolean;
  reason?: string;
  type?: 'rutin' | 'tanggal';
}

/**
 * Checks if a given date string (YYYY-MM-DD) is a holiday.
 * Routine holidays in MTK: Selasa (Tuesday) and Jumat (Friday),
 * as well as any special holidays inputted by TU.
 */
export const checkIsHoliday = (dateStr: string, settings?: HolidaySettings | null): HolidayCheckResult => {
  if (!dateStr) return { isHoliday: false };

  // 1. Check special holidays first (specific dates)
  try {
    if (settings && Array.isArray(settings.specialHolidays)) {
      const specialMatch = settings.specialHolidays.find(
        (h: SpecialHoliday) => h && h.tanggal === dateStr
      );
      if (specialMatch) {
        return {
          isHoliday: true,
          reason: specialMatch.keterangan || 'Libur Khusus MTK',
          type: 'tanggal',
        };
      }
    }
  } catch (e) {
    console.error('Special holiday check error', e);
  }

  // 2. Check routine holidays: Selasa (Tuesday) & Jumat (Friday)
  try {
    const parts = dateStr.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = dateObj.getDay(); // 0: Minggu, 1: Senin, 2: Selasa, 3: Rabu, 4: Kamis, 5: Jumat, 6: Sabtu

    // Selasa (Day 2)
    if (dayOfWeek === 2) {
      return {
        isHoliday: true,
        reason: 'Libur Rutin: Hari Selasa',
        type: 'rutin',
      };
    }

    // Jumat (Day 5)
    if (dayOfWeek === 5) {
      return {
        isHoliday: true,
        reason: 'Libur Rutin: Hari Jumat',
        type: 'rutin',
      };
    }
  } catch (e) {
    console.error('Holiday check error', e);
  }

  return { isHoliday: false };
};

export interface HijriDayItem {
  hDay: number;
  hMonth: number;
  hYear: number;
  weekday: string;
  gregorianStr: string;
  isSelasaOrJumat: boolean;
  isSpecialHoliday: boolean;
  holidayReason?: string;
  isActiveDay: boolean;
}

export interface HijriMonthCalendarResult {
  hYear: number;
  hMonth: number;
  monthName: string;
  totalDays: number;
  selasaCount: number;
  jumatCount: number;
  routineHolidayCount: number;
  specialHolidaysInMonth: { hDay: number; dateStr: string; keterangan: string }[];
  activeDaysCount: number;
  days: HijriDayItem[];
  startDate: string;
  endDate: string;
}

// In-memory calendar cache for Hijri months
const monthCalendarCache = new Map<string, HijriDayItem[]>();

/**
 * Computes all days in a Hijri month and automatically calculates active days:
 * Active Days = Total Days in Hijri Month (29/30) - (Tuesdays + Fridays) - (Special Holidays not on Tue/Fri)
 */
export const getHijriMonthCalendar = (
  hYear: number,
  hMonth: number,
  specialHolidays: SpecialHoliday[] = []
): HijriMonthCalendarResult => {
  const cacheKey = `${hYear}-${hMonth}`;
  let baseDays = monthCalendarCache.get(cacheKey);

  if (!baseDays) {
    const gYear = Math.floor(hYear * 0.970224 + 621.57);
    const startScan = new Date(gYear - 1, 10, 1, 12, 0, 0); // scan from Nov 1 of prior year
    baseDays = [];

    for (let i = 0; i < 460; i++) {
      const cur = new Date(startScan.getTime() + i * 86400000);
      const parts = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        weekday: 'long',
      }).formatToParts(cur);

      const map: Record<string, string> = {};
      parts.forEach((p) => {
        map[p.type] = p.value;
      });

      if (parseInt(map.year, 10) === hYear && parseInt(map.month, 10) === hMonth) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const gregorianStr = `${y}-${m}-${d}`;
        const weekday = map.weekday;

        baseDays.push({
          hDay: parseInt(map.day, 10),
          hMonth,
          hYear,
          weekday,
          gregorianStr,
          isSelasaOrJumat: weekday === 'Selasa' || weekday === 'Jumat',
          isSpecialHoliday: false,
          isActiveDay: weekday !== 'Selasa' && weekday !== 'Jumat',
        });
      }
    }

    baseDays.sort((a, b) => a.hDay - b.hDay);
    monthCalendarCache.set(cacheKey, baseDays);
  }

  // Overlay special holidays
  const days: HijriDayItem[] = baseDays.map((d) => {
    const special = specialHolidays.find((h) => h.tanggal === d.gregorianStr);
    const isSpecial = !!special;
    const isHoliday = d.isSelasaOrJumat || isSpecial;
    let reason: string | undefined = undefined;
    if (special) {
      reason = special.keterangan;
    } else if (d.isSelasaOrJumat) {
      reason = `Libur Rutin: ${d.weekday}`;
    }

    return {
      ...d,
      isSpecialHoliday: isSpecial,
      holidayReason: reason,
      isActiveDay: !isHoliday,
    };
  });

  const totalDays = days.length;
  const selasaCount = days.filter((d) => d.weekday === 'Selasa').length;
  const jumatCount = days.filter((d) => d.weekday === 'Jumat').length;
  const routineHolidayCount = selasaCount + jumatCount;

  // Count special holidays that do NOT fall on Tuesday or Friday
  const specialNotTueFri = days
    .filter((d) => d.isSpecialHoliday && !d.isSelasaOrJumat)
    .map((d) => ({
      hDay: d.hDay,
      dateStr: d.gregorianStr,
      keterangan: d.holidayReason || 'Libur Khusus',
    }));

  const activeDaysCount = Math.max(0, totalDays - routineHolidayCount - specialNotTueFri.length);
  const monthObj = HIJRI_MONTHS.find((m) => m.id === hMonth);
  const monthName = monthObj ? monthObj.name : `Bulan ${hMonth}`;

  return {
    hYear,
    hMonth,
    monthName,
    totalDays,
    selasaCount,
    jumatCount,
    routineHolidayCount,
    specialHolidaysInMonth: specialNotTueFri,
    activeDaysCount,
    days,
    startDate: days.length > 0 ? days[0].gregorianStr : '',
    endDate: days.length > 0 ? days[days.length - 1].gregorianStr : '',
  };
};

/**
 * Get date range for filters
 */
export const getDateRangeForFilter = (
  filterType: 'today' | 'this_week' | 'this_month' | 'hijri' | 'custom',
  options?: {
    customStart?: string;
    customEnd?: string;
    hijriMonthId?: number;
    hijriYear?: number;
    specialHolidays?: SpecialHoliday[];
  }
): { startDate: string; endDate: string; label: string; activeDaysCount?: number } => {
  const todayStr = getTodayString();
  const todayHijri = getHijriDateDetails(todayStr);

  if (filterType === 'today') {
    return {
      startDate: todayStr,
      endDate: todayStr,
      label: todayHijri.fullFormatted,
      activeDaysCount: 1,
    };
  }

  if (filterType === 'this_week') {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const start = formatDateToYMD(monday);
    const end = formatDateToYMD(sunday);
    const startHijri = getHijriDateDetails(start);
    const endHijri = getHijriDateDetails(end);

    return {
      startDate: start,
      endDate: end,
      label: `Minggu Ini (${startHijri.shortFormatted} s/d ${endHijri.shortFormatted})`,
    };
  }

  // Hijri Month Range
  const hMonthId = options?.hijriMonthId || todayHijri.hMonth;
  const hYear = options?.hijriYear || todayHijri.hYear;
  const cal = getHijriMonthCalendar(hYear, hMonthId, options?.specialHolidays || []);

  if (filterType === 'hijri' || filterType === 'this_month') {
    return {
      startDate: cal.startDate || todayStr,
      endDate: cal.endDate || todayStr,
      label: `Bulan ${cal.monthName} ${hYear} H (Hari Aktif Otomatis: ${cal.activeDaysCount} Hari)`,
      activeDaysCount: cal.activeDaysCount,
    };
  }

  // Custom range
  const start = options?.customStart || todayStr;
  const end = options?.customEnd || todayStr;
  const startHijri = getHijriDateDetails(start);
  const endHijri = getHijriDateDetails(end);

  return {
    startDate: start,
    endDate: end,
    label: `${startHijri.shortFormatted} s/d ${endHijri.shortFormatted}`,
  };
};

export const formatDateToYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getHijriDateString = (dateStr?: string): string => {
  return formatHijriFull(dateStr || getTodayString());
};

