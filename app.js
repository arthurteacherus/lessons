const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback
} = React;

/* ============================================================
   ТЕМА / ДИЗАЙН-ТОКЕНЫ
   ============================================================ */
const THEME = {
  bg: "#EEF1F5",
  // светлая подложка страницы
  bgDark: "#132c53",
  // глубокий синий — акцент: кнопки, активные вкладки, заголовки
  bgSoft: "#DCE4F2",
  gold: "#C98A2B",
  // янтарный акцент (вторая кнопка, "сегодня" в календаре и т.п.)
  goldDim: "#66707E",
  // приглушённый текст
  panel: "#FFFFFF",
  panelText: "#1E2530",
  card: "#FFFFFF",
  pastel: "#E7ECF5",
  pastelDark: "#DCE4F2",
  red: "#C1554B",
  redBg: "#FBEDEB",
  border: "#DFE3E9"
};
const HEAD_FONT = "'Playfair Display', Georgia, serif"; // замена Arsenica Antiqua
const BODY_FONT = "'PT Sans', 'Noto Sans', sans-serif"; // замена Evolventa

const SWATCHES = ["#ffb3ba", "#ffdfba", "#ffffba", "#baffc9", "#bae1ff", "#c9baff", "#ffbae7", "#8fc3e0", "#e0a458", "#7fb069", "#c0392b", "#6a89cc", "#f6b93b", "#b8b8ff", "#82c0cc"];
const HIGHLIGHT_COLORS = ["#fff59d", "#a5d6a7", "#f8bbd0", "#90caf9", "#ffcc80"];

/* ============================================================
   ЦВЕТОВЫЕ УТИЛИТЫ ДЛЯ КАТЕГОРИЙ ВИДОВ УПРАЖНЕНИЙ
   Каждая категория хранит один базовый цвет; оттенки для тегов
   внутри неё считаются автоматически (по HSL), чтобы разница
   была заметна невооружённым глазом, и пересчитываются каждый раз,
   когда состав или порядок тегов в категории меняется.
   ============================================================ */
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return {
    h: h * 360,
    s: s * 100,
    l: l * 100
  };
}
function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = x => {
    const v = Math.round(x * 255);
    return v.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
// N заметно различающихся оттенков одного цвета: широкий разброс по светлоте + насыщенность не ниже 55%.
function generateShades(baseHex, count) {
  if (count <= 0) return [];
  const {
    h,
    s
  } = hexToHsl(baseHex);
  const sat = Math.max(s, 55);
  if (count === 1) return [hslToHex(h, sat, 52)];
  const lightMax = 84,
    lightMin = 26;
  const shades = [];
  for (let i = 0; i < count; i++) {
    const l = lightMax - i * (lightMax - lightMin) / (count - 1);
    shades.push(hslToHex(h, sat, l));
  }
  return shades;
}
// Пересчитывает оттенки у всех тегов данной категории (вызывать после любого
// изменения состава/порядка тегов в категории или цвета самой категории).
function recomputeCategoryShades(d, categoryId) {
  const cat = d.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const tags = d.tags.type.filter(t => t.categoryId === categoryId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const shades = generateShades(cat.color, tags.length);
  tags.forEach((t, idx) => {
    if (!t.customColor) t.color = shades[idx];
  });
}
function contrastTextColor(hex) {
  if (!hex) return "#132033";
  const {
    l
  } = hexToHsl(hex);
  return l < 45 ? "#f5f7fa" : "#132033";
}
const DEFAULT_CATEGORIES = [{
  name: "Фонетика",
  color: "#e0ac00"
}, {
  name: "Морфемика",
  color: "#2f9e64"
}, {
  name: "Морфология",
  color: "#d1372c"
}, {
  name: "Синтаксис",
  color: "#2678b3"
}];
// Виды упражнений, которые нужно завести (если их ещё нет) под соответствующей категорией.
const DEFAULT_CATEGORY_ITEMS = {
  "Фонетика": ["Звуковое зеркало", "Слоговое зеркало", "Зазеркалье", "Узнай в лицо", "Различи двойников"],
  "Морфемика": ["Цепочка", "Дойди до сути"],
  "Морфология": ["Сократи слово", "Воскреси слово"],
  "Синтаксис": ["Дежурная буква", "Синтаксический анализ", "Синтаксический заказ", "Пунктуационный чертёж", "Круги по воде", "Синтаксическая пирамида", "Обратная пирамида"]
};

/* ============================================================
   УТИЛИТЫ
   ============================================================ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const CLASSES = ["5", "6", "7", "8", "9", "10", "11"];
function defaultState() {
  return {
    tags: {
      type: [],
      // теги "тип упражнения"
      topic: [],
      // теги "тема урока"
      lessonType: [] // теги "тип урока"
    },
    examples: [],
    // примеры упражнений
    lessons: [],
    // уроки
    courses: [],
    // доп. курсы {id, name}
    theory: [],
    // страницы теории {id, title, html, attachments, diagrams}
    favorites: {
      classes: [],
      courses: []
    },
    // избранные классы/курсы, закреплённые вверху
    categories: [],
    // категории видов упражнений {id, name, color, order}
    reserves: [],
    // запасные упражнения по классам/курсам {id, groupKind, groupValue, exerciseId}
    vacations: [],
    // каникулы {id, name, start, end} — для календаря и расчёта четвертей
    students: [],
    // ученики журнала {id, name, class, courseId, classLetterId, courseSubgroupId}
    marks: [],
    // отметки в журнале {id, studentId, value, date, reason, scale, excused}
    classLetters: [],
    // литеры классов {id, grade, name} — например, 5А/5Б внутри 5 класса
    courseSubgroups: [],
    // подгруппы курсов {id, courseId, name} — как литеры, но для курсов
    classSettings: [],
    // настройки конкретного класса/литеры или курса/подгруппы {id, kind, value, classLetterId, gradingSystem}
    seatingLayouts: [],
    // рассадка по классу/литере или курсу/подгруппе {id, kind, value, classLetterId, files, visionLimits, seatFurther}
    exchangeSends: [],
    // журнал отправленных ученикам файлов {id, studentId, lessonId, kind, sentAt, fileName}
    incomingAnswers: [],
    // новые файлы, найденные в папках учеников {id, studentId, lessonId, fileName, receivedAt}
    worksheetChecklist: defaultWorksheetChecklist(),
    // что по умолчанию убирать при формировании рабочего листа для ученика
    journalMarkedDates: [] // ключи "kind:value:classLetterId:date" — дата в журнале отмечена как "отметки выставлены" (столбец закрашивается)
  };
}

// Чек-лист "что убирать по умолчанию" при формировании рабочего листа для ученика —
// настраивается один раз и применяется ко всем урокам. Ключи "hide*": true — убирать.
function defaultWorksheetChecklist() {
  return {
    hideNotes: true,
    // "Примечание" к упражнению — обычно заметка для себя, а не для ученика
    hideRedFlags: true,
    // красная заметка (⚑) — "для обозначения на уроке", тем более не для ученика
    hideExerciseType: false,
    // строка "Тип: ..." у упражнения
    hideExerciseTopics: false,
    // "Темы: ..." у упражнения
    hideLessonTopics: false,
    // "Темы: ..." у урока
    hideLessonType: false,
    // "Тип урока: ..."
    hideDates: false // "Планируемая дата / Фактическая дата"
  };
}

// Приводит данные, сохранённые более ранней версией приложения, к текущей форме —
// чтобы отсутствующие в старых записях поля не вызывали ошибок рендера.
function migrateState(raw) {
  const base = defaultState();
  const d = {
    ...base,
    ...(raw || {})
  };
  d.tags = {
    ...base.tags,
    ...(raw?.tags || {})
  };
  d.tags.type = (d.tags.type || []).map((t, idx) => ({
    categoryId: null,
    order: idx,
    slots: [],
    ...t
  }));
  d.tags.topic = d.tags.topic || [];
  d.tags.lessonType = d.tags.lessonType || [];

  // Категории видов упражнений: сидируем 4 стандартные один раз, если их ещё нет.
  d.categories = d.categories || [];
  DEFAULT_CATEGORIES.forEach(c => {
    if (!d.categories.some(existing => existing.name === c.name)) {
      d.categories.push({
        id: uid(),
        name: c.name,
        color: c.color,
        order: d.categories.length
      });
    }
  });
  d.categories = d.categories.map((c, idx) => ({
    order: idx,
    ...c
  }));

  // Миграция старого текстового поля category -> categoryId (по совпадению имени).
  d.tags.type.forEach(t => {
    if (t.category && !t.categoryId) {
      const cat = d.categories.find(c => c.name === t.category);
      if (cat) t.categoryId = cat.id;
    }
  });

  // Одноразовое создание конкретных видов упражнений внутри стандартных категорий —
  // только если тега с таким названием ещё нет (чтобы не дублировать и не трогать ручные правки).
  let runningOrder = d.tags.type.length ? Math.max(...d.tags.type.map(t => t.order || 0)) + 1 : 0;
  Object.entries(DEFAULT_CATEGORY_ITEMS).forEach(([catName, items]) => {
    const cat = d.categories.find(c => c.name === catName);
    if (!cat) return;
    items.forEach(itemName => {
      const existing = d.tags.type.find(t => t.name.trim().toLowerCase() === itemName.toLowerCase());
      if (existing) {
        if (!existing.categoryId) existing.categoryId = cat.id;
      } else {
        d.tags.type.push({
          id: uid(),
          name: itemName,
          color: cat.color,
          categoryId: cat.id,
          order: runningOrder++
        });
      }
    });
  });

  // Пересчитываем оттенки для каждой категории — гарантирует заметно различающиеся цвета
  // независимо от того, сколько тегов в категории и в каком они порядке.
  d.categories.forEach(cat => recomputeCategoryShades(d, cat.id));
  d.examples = (d.examples || []).map(ex => {
    const base = {
      topicTagIds: [],
      attachments: [],
      slotId: null,
      ...ex
    };
    if (!base.richMigrated) {
      base.text = nl2br(escapeHtml(base.text || ""));
      base.richMigrated = true;
    }
    return base;
  });
  d.courses = (d.courses || []).map((c, idx) => ({
    color: SWATCHES[idx % SWATCHES.length],
    ...c
  }));
  // Запасные упражнения — свои для каждого класса+литеры (или курса).
  d.reserves = (d.reserves || []).map(r => ({
    id: r.id || uid(),
    groupKind: r.groupKind,
    groupValue: r.groupValue,
    classLetterId: r.classLetterId || null,
    exerciseId: r.exerciseId
  }));
  d.vacations = (d.vacations || []).map(v => ({
    id: v.id || uid(),
    name: v.name || "Каникулы",
    start: v.start || "",
    end: v.end || v.start || ""
  }));
  d.students = (d.students || []).map(s => ({
    id: s.id || uid(),
    name: s.name || "Ученик",
    class: s.class || null,
    courseId: s.courseId || null,
    classLetterId: s.classLetterId || null,
    courseSubgroupId: s.courseSubgroupId || null,
    exchangeFolder: s.exchangeFolder || null
  }));
  // scale: по какой шкале выставлена конкретная отметка — "5" или "100" (старые отметки все были по 5-балльной).
  d.marks = (d.marks || []).map(m => ({
    id: m.id || uid(),
    studentId: m.studentId,
    value: m.value || 0,
    date: m.date || "",
    reason: m.reason || "",
    scale: m.scale || "5",
    excused: m.excused == null ? null : m.excused,
    // true/false — только для value === "Н"; null для обычных отметок
    lessonId: m.lessonId || null,
    exerciseId: m.exerciseId || null
  }));
  d.classLetters = (d.classLetters || []).map(cl => ({
    id: cl.id || uid(),
    grade: cl.grade,
    name: cl.name || ""
  }));
  d.courseSubgroups = (d.courseSubgroups || []).map(g => ({
    id: g.id || uid(),
    courseId: g.courseId,
    name: g.name || ""
  }));
  // Настройки конкретного класса/литеры/курса: система оценивания, норма отметок за период и т.п.
  d.classSettings = (d.classSettings || []).map(s => ({
    id: s.id || uid(),
    kind: s.kind,
    value: s.value,
    classLetterId: s.classLetterId || null,
    gradingSystem: s.gradingSystem || "5",
    periodMode: s.periodMode || "quarter",
    // "quarter" | "semester"
    requiredMarks: s.requiredMarks || null // null — норма не задана
  }));
  // Рассадка: files — 3 "ряда" (у окна/посередине/у двери), каждый — список парт спереди назад,
  // парта — {id, seats:[studentId|null, studentId|null]}. visionLimits — "не далее N парты от доски".
  d.seatingLayouts = (d.seatingLayouts || []).map(s => ({
    id: s.id || uid(),
    kind: s.kind,
    value: s.value,
    classLetterId: s.classLetterId || null,
    files: (s.files && s.files.length === 3 ? s.files : [[], [], []]).map(file => (file || []).map(desk => ({
      id: desk.id || uid(),
      seats: [desk.seats?.[0] || null, desk.seats?.[1] || null]
    }))),
    visionLimits: (s.visionLimits || []).map(v => ({
      studentId: v.studentId,
      maxRow: v.maxRow
    })),
    seatFurther: s.seatFurther || []
  }));
  // Ученики, добавленные до появления рассадки (или через обычное поле "+ Добавить ученика"),
  // сами по себе не занимают место в files — рассаживаем их в произвольном порядке, чтобы
  // у каждого класса/литеры сразу была готовая схема, а не пустая с одним списком "не рассажены".
  // Список учеников и их отметки при этом никак не трогаются — только заполняются свободные места.
  {
    const seatingGroups = new Map();
    d.students.forEach(s => {
      const kind = s.courseId ? "course" : "class";
      const value = s.courseId || s.class;
      const classLetterId = s.courseId ? s.courseSubgroupId || null : s.classLetterId || null;
      const key = seatingKey(kind, value, classLetterId);
      if (!seatingGroups.has(key)) seatingGroups.set(key, {
        kind,
        value,
        classLetterId,
        ids: []
      });
      seatingGroups.get(key).ids.push(s.id);
    });
    seatingGroups.forEach(({
      kind,
      value,
      classLetterId,
      ids
    }) => {
      const layout = getOrCreateSeatingLayout(d, kind, value, classLetterId);
      const seated = new Set();
      layout.files.forEach(file => file.forEach(desk => desk.seats.forEach(sid => sid && seated.add(sid))));
      shuffleArray(ids.filter(id => !seated.has(id))).forEach((id, i) => placeInFirstEmptySeat(layout, id, i % 3));
      ensureSeatingCapacity(layout);
    });
  }
  // Автообмен файлами с учениками: журнал отправленного (для имени файла и привязки ответов
  // к нужному уроку) и список входящих ответов, найденных в папках учеников.
  d.exchangeSends = (d.exchangeSends || []).map(s => ({
    id: s.id || uid(),
    studentId: s.studentId,
    lessonId: s.lessonId || null,
    kind: s.kind || "lesson",
    sentAt: s.sentAt || "",
    fileName: s.fileName || ""
  }));
  d.incomingAnswers = (d.incomingAnswers || []).map(a => ({
    id: a.id || uid(),
    studentId: a.studentId,
    lessonId: a.lessonId || null,
    fileName: a.fileName || "",
    receivedAt: a.receivedAt || ""
  }));
  d.worksheetChecklist = {
    ...defaultWorksheetChecklist(),
    ...(d.worksheetChecklist || {})
  };
  d.journalMarkedDates = Array.isArray(d.journalMarkedDates) ? d.journalMarkedDates : [];
  d.favorites = {
    classes: [],
    courses: [],
    ...(raw?.favorites || {})
  };
  d.favorites.classes = d.favorites.classes || [];
  d.favorites.courses = d.favorites.courses || [];
  d.lessons = (d.lessons || []).map(l => {
    const base = {
      topicTagIds: [],
      lessonTypeTagIds: [],
      exerciseIds: [],
      theoryIds: [],
      homework: "",
      homeworkItems: [],
      homeworkAttachments: [],
      completed: false,
      archived: false,
      plannedDate: "",
      actualDate: "",
      excludeFromSchedule: false,
      needsWork: false,
      classLetterId: null,
      ...l
    };
    if (!base.items) {
      base.items = [...(base.exerciseIds || []).map(refId => ({
        id: uid(),
        type: "exercise",
        refId
      })), ...(base.theoryIds || []).map(refId => ({
        id: uid(),
        type: "theory",
        refId
      }))];
    }
    base.items = base.items.map(it => {
      const norm = {
        note: "",
        ...it
      };
      // Раньше на упражнение можно было вызвать только одного ученика (student/grade/…
      // прямо в item); теперь их несколько — students[]. Конвертируем один раз при загрузке.
      if (norm.type === "exercise" && !Array.isArray(norm.students)) {
        norm.students = norm.student ? [{
          id: uid(),
          name: norm.student,
          grade: norm.grade || "",
          gradeScale: norm.gradeScale || "",
          gradeExcused: norm.gradeExcused ?? null,
          markId: norm.markId || null
        }] : [];
        delete norm.student;
        delete norm.grade;
        delete norm.gradeScale;
        delete norm.gradeExcused;
        delete norm.markId;
      }
      return norm;
    });
    base.homeworkItems = base.homeworkItems || [];
    base.homeworkAttachments = base.homeworkAttachments || [];
    return base;
  });
  // Самолечение: один раз при загрузке пересчитываем order уроков по датам для каждой группы
  // (класс+литера/курс) — раньше order мог разойтись с календарём (например, урок создавался
  // сразу с более ранней датой, чем уже существующие уроки, без пересчёта порядка).
  {
    const seenLessonGroups = new Set();
    d.lessons.forEach(l => {
      const groupKey = l.courseId ? `course:${l.courseId}` : `class:${l.class}:${l.classLetterId || "none"}`;
      if (seenLessonGroups.has(groupKey)) return;
      seenLessonGroups.add(groupKey);
      resyncOrderForGroup(d, l);
    });
  }
  d.theory = (d.theory || []).map(p => ({
    html: "",
    attachments: [],
    diagrams: [],
    topicTagIds: [],
    classTags: [],
    courseTagIds: [],
    ...p
  }));
  return d;
}

/* ============================================================
   ЭКСПОРТ: Word (.doc) и PDF (через диалог печати браузера)
   ============================================================ */
function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function nl2br(escapedStr) {
  return escapedStr.replace(/\n/g, "<br>");
}

// Достаёт обычный текст из HTML (для компактных превью, поиска и имён файлов при экспорте).
function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

// opts.noTitle — без заголовка (для листов с карточками); opts.pageCss — своё поле/размер страницы Word.
function wordDocHtml(titleText, bodyHtml, opts = {}) {
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset="utf-8"><title>${escapeHtml(titleText)}</title>
  <style>
    body{font-family:Calibri,Arial,sans-serif; color:#1a1a1a;}
    h1{font-family:Georgia,serif;} h2{font-family:Georgia,serif; margin-top:22px;} h3{margin-top:16px;}
    .tag{background:#eef3f7;padding:2px 8px;border-radius:10px;margin-right:5px;font-size:11px;}
    .red{color:#c0392b;font-weight:bold;}
    .muted{color:#777;font-size:11px;}
    .ex{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #ddd;}
    ${opts.pageCss || ""}
  </style>
  </head><body>${opts.noTitle ? "" : `<h1>${escapeHtml(titleText)}</h1>`}${opts.pageCss ? `<div class="Section1">${bodyHtml}</div>` : bodyHtml}</body></html>`;
}

// \u0418\u043c\u044f \u0444\u0430\u0439\u043b\u0430, \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0435 \u0434\u043b\u044f \u0444\u0430\u0439\u043b\u043e\u0432\u043e\u0439 \u0441\u0438\u0441\u0442\u0435\u043c\u044b Windows (\u0437\u0430\u043f\u0440\u0435\u0449\u0451\u043d\u043d\u044b\u0435 \u0441\u0438\u043c\u0432\u043e\u043b\u044b, \u043e\u0431\u0440\u0435\u0437\u043a\u0430 \u0434\u043b\u0438\u043d\u044b).
function sanitizeFileName(str) {
  return (str || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f";
}
function downloadWord(filename, titleText, bodyHtml, opts) {
  const html = wordDocHtml(titleText, bodyHtml, opts);
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".doc") ? filename : filename + ".doc";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function ensurePrintArea() {
  if (document.getElementById("lc-print-area")) return;
  const div = document.createElement("div");
  div.id = "lc-print-area";
  document.body.appendChild(div);
  const style = document.createElement("style");
  style.textContent = `
    #lc-print-area { display: none; }
    @media print {
      body > *:not(#lc-print-area) { display: none !important; }
      #lc-print-area { display: block !important; }
      #lc-print-area * { visibility: visible !important; }
    }
  `;
  document.head.appendChild(style);
}
function printAsPdf(titleText, bodyHtml) {
  ensurePrintArea();
  const area = document.getElementById("lc-print-area");
  area.innerHTML = `<div style="font-family:'PT Sans',Arial,sans-serif; color:#12233a; padding:24px; max-width:800px; margin:0 auto;">
    <h1 style="font-family:'Playfair Display',Georgia,serif;">${escapeHtml(titleText)}</h1>${bodyHtml}
  </div>`;
  setTimeout(() => window.print(), 80);
}

/* ============================================================
   ПЕЧАТЬ/СКАЧИВАНИЕ ОТДЕЛЬНОГО ЭЛЕМЕНТА УРОКА: один и тот же материал повторяется N раз на листе A4
   (карточки, которые режут и раздают ученикам). Сетка [столбцов, строк]; поля листа 8 мм.
   ============================================================ */
const CARD_LAYOUTS = {
  1: [1, 1],
  2: [1, 2],
  4: [2, 2],
  6: [2, 3],
  8: [2, 4]
};
const CARD_PAGE_W_MM = 194; // A4 (210) минус поля по 8 мм
const CARD_PAGE_H_MM = 277; // A4 (297) минус поля по 8 мм и небольшой запас, чтобы не рождался пустой лист

function cardsPageHtml(contentHtml, copies, fontPx, clip) {
  const [cols, rows] = CARD_LAYOUTS[copies] || [1, 1];
  const cellW = CARD_PAGE_W_MM / cols;
  const cellH = CARD_PAGE_H_MM / rows;
  const border = copies > 1 ? "1px dashed #8a97a5" : "none";
  const cell = `<td style="width:${cellW}mm;height:${cellH}mm;vertical-align:top;border:${border};padding:3mm;"><div class="lc-card-cell" style="height:${(cellH - 7).toFixed(1)}mm;overflow:${clip ? "hidden" : "visible"};font-size:${fontPx}px;line-height:1.4;">${contentHtml}</div></td>`;
  const row = `<tr style="height:${cellH}mm">${cell.repeat(cols)}</tr>`;
  return `<table style="border-collapse:collapse;table-layout:fixed;width:${CARD_PAGE_W_MM}mm;">${row.repeat(rows)}</table>`;
}
const CARDS_WORD_PAGE_CSS = `@page Section1 { size: 210mm 297mm; margin: 8mm 8mm 8mm 8mm; mso-page-orientation: portrait; } div.Section1 { page: Section1; }`;

// Печать листа с карточками: поля 8 мм и размер A4 действуют только на время печати.
function printCardsPdf(bodyHtml) {
  ensurePrintArea();
  document.getElementById("lc-cards-page-style")?.remove();
  const st = document.createElement("style");
  st.id = "lc-cards-page-style";
  st.textContent = "@page { size: A4 portrait; margin: 8mm; }";
  document.head.appendChild(st);
  document.getElementById("lc-print-area").innerHTML = `<div style="font-family:'PT Sans',Arial,sans-serif;color:#12233a;">${bodyHtml}</div>`;
  const cleanup = () => {
    st.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 120);
}

/* ============================================================
   АВТООБМЕН С УЧЕНИКАМИ: у каждого ученика может быть указана папка на диске,
   которую с его устройством синхронизирует сторонняя программа (Яндекс.Диск,
   Google Диск и т.п.). Мы только читаем и кладём туда обычные файлы —
   никакой отправки через интернет сам конструктор не делает.
   ============================================================ */

// Отправляет готовый документ (тот же HTML, что уходит в "Экспортировать в Word") прямо
// в папку ученика — без диалога "Сохранить как". baseName без даты — дату добавляем сами,
// чтобы файлы не путались и не перезаписывали друг друга.
async function sendDocToStudent(update, student, titleText, bodyHtml, meta) {
  // lcShareMode — версия для планшета: папок нет, файл отдаётся через системное «Поделиться».
  if (!window.lcShareMode && !student.exchangeFolder) {
    alert(`У ученика «${student.name}» не указана папка для автообмена — сначала укажите её в карточке ученика.`);
    return false;
  }
  const dateStr = new Date().toISOString().slice(0, 10);
  const baseName = sanitizeFileName(`${dateStr} ${titleText}`);
  const html = wordDocHtml(titleText, bodyHtml);
  const res = await window.lcAPI.sendExchangeFile(student.exchangeFolder, baseName, html);
  if (!res.ok) {
    alert(`Не удалось отправить файл ученику «${student.name}»: ${res.error || "неизвестная ошибка"}`);
    return false;
  }
  update(d => {
    d.exchangeSends = d.exchangeSends || [];
    d.exchangeSends.push({
      id: uid(),
      studentId: student.id,
      lessonId: meta?.lessonId || null,
      kind: meta?.kind || "lesson",
      sentAt: new Date().toISOString(),
      fileName: res.fileName
    });
    return d;
  });
  return true;
}

// Смотрит в папку "Ответы ученика" у указанных учеников и находит файлы, которых раньше не
// видели (сравнивая с уже известными именами файлов). Каждый новый файл привязывается к тому
// уроку/заданию, который этому ученику отправляли последним (по дате отправки) — как и решили:
// ориентируемся на дату отправления урока. Не трогает data/state напрямую (IPC асинхронный,
// а update() в приложении синхронный) — возвращает готовые записи, которые вызывающий код
// сам добавит через update().
async function findNewExchangeAnswers(data, students) {
  const sends = data.exchangeSends || [];
  const known = new Set((data.incomingAnswers || []).map(a => `${a.studentId}::${a.fileName}`));
  const found = [];
  for (const student of students) {
    if (!student.exchangeFolder) continue;
    const res = await window.lcAPI.listExchangeAnswers(student.exchangeFolder);
    if (!res.ok) continue;
    const sendsForStudent = sends.filter(s => s.studentId === student.id && s.sentAt).sort((a, b) => a.sentAt < b.sentAt ? 1 : -1);
    const lastLessonId = sendsForStudent.length ? sendsForStudent[0].lessonId : null;
    res.files.forEach(f => {
      const key = `${student.id}::${f.name}`;
      if (known.has(key)) return;
      known.add(key);
      found.push({
        id: uid(),
        studentId: student.id,
        lessonId: lastLessonId,
        fileName: f.name,
        receivedAt: new Date().toISOString()
      });
    });
  }
  return found;
}
async function runExchangeCheck(data, update, students) {
  const found = await findNewExchangeAnswers(data, students);
  if (found.length === 0) return 0;
  update(d => {
    d.incomingAnswers = [...(d.incomingAnswers || []), ...found];
    return d;
  });
  return found.length;
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function diagramToImageDataUrl(diagram, w = 1100, h = 580) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f6fbfe";
  ctx.fillRect(0, 0, w, h);
  (diagram.lines || []).forEach(l => {
    ctx.strokeStyle = l.color || "#7fa0bd";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  });
  ctx.strokeStyle = "#8fa9bd";
  ctx.lineWidth = 3;
  (diagram.edges || []).forEach(e => {
    const a = diagram.nodes.find(n => n.id === e.from);
    const b = diagram.nodes.find(n => n.id === e.to);
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x + 60, a.y + 20);
    ctx.lineTo(b.x + 60, b.y + 20);
    ctx.stroke();
  });
  (diagram.nodes || []).forEach(n => {
    const shape = n.shape || "rect";
    ctx.fillStyle = n.color || "#bfe0f5";
    ctx.strokeStyle = "#12233a";
    ctx.lineWidth = 1;
    if (shape === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(n.x + 60, n.y + 20, 60, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (shape === "diamond") {
      ctx.beginPath();
      ctx.moveTo(n.x + 60, n.y);
      ctx.lineTo(n.x + 120, n.y + 20);
      ctx.lineTo(n.x + 60, n.y + 40);
      ctx.lineTo(n.x, n.y + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      roundRectPath(ctx, n.x, n.y, 120, 40, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#12233a";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((n.text || "").slice(0, 18), n.x + 60, n.y + 21);
  });
  (diagram.texts || []).forEach(t => {
    ctx.fillStyle = t.color || "#12233a";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(t.text || "", t.x, t.y);
  });
  return canvas.toDataURL("image/png");
}
function exerciseToHtml(ex, data) {
  const typeTag = data.tags.type.find(t => t.id === ex.typeTagId);
  const topicTags = ex.topicTagIds.map(id => data.tags.topic.find(t => t.id === id)).filter(Boolean);
  return `<div class="ex">
    <div class="muted">Тип: ${escapeHtml(typeTag?.name || "—")}</div>
    <div style="font-weight:bold; margin:6px 0;">${ex.text}</div>
    ${ex.note ? `<div style="margin-bottom:6px;">${escapeHtml(ex.note)}</div>` : ""}
    ${topicTags.length ? `<div class="muted">Темы: ${topicTags.map(t => escapeHtml(t.name)).join(", ")}</div>` : ""}
    ${ex.redNote ? `<div class="red">⚑ ${escapeHtml(ex.redNote)}</div>` : ""}
  </div>`;
}
function theoryPageToHtml(page) {
  return `<div style="margin-bottom:22px;"><h2>${escapeHtml(page.title)}</h2>${page.html || ""}</div>`;
}
function diagramToHtmlWithImage(diagram) {
  const dataUrl = diagramToImageDataUrl(diagram);
  return `<div style="margin-bottom:20px;"><h3>${escapeHtml(diagram.title)}</h3><img src="${dataUrl}" style="max-width:100%; border:1px solid #ccc;" /></div>`;
}
function lessonPlaceLabel(lesson, data) {
  if (lesson.courseId) return data.courses.find(c => c.id === lesson.courseId)?.name || "Курс";
  const letter = lesson.classLetterId ? classLetterName(data, lesson.classLetterId) : "";
  return `${lesson.class}${letter}` + " класс";
}

// Литеры (буквенные обозначения параллельных классов) — например, 5А/5Б внутри 5 класса.
function lettersForGrade(data, grade) {
  return (data.classLetters || []).filter(cl => cl.grade === grade);
}
function classLetterName(data, id) {
  const cl = (data.classLetters || []).find(c => c.id === id);
  return cl ? cl.name : "";
}
// Подгруппы курса — тот же принцип, что литеры класса, но для курсов (например, "Группа 1"/"Группа 2").
function subgroupsForCourse(data, courseId) {
  return (data.courseSubgroups || []).filter(g => g.courseId === courseId);
}
function courseSubgroupName(data, id) {
  const g = (data.courseSubgroups || []).find(x => x.id === id);
  return g ? g.name : "";
}
// Литеры того же класса, в материалах которых этого упражнения нет ни в одном уроке —
// подсказка для "Запасных упражнений": видно, где ещё не пройдено то же самое.
function lettersMissingExercise(data, grade, exerciseId, excludeLetterId) {
  return lettersForGrade(data, grade).filter(cl => cl.id !== excludeLetterId).filter(cl => !data.lessons.some(l => l.class === grade && !l.courseId && l.classLetterId === cl.id && (l.items || []).some(it => it.type === "exercise" && it.refId === exerciseId))).map(cl => `${grade}${cl.name}`);
}

// Ученики везде расставляются по алфавиту — единая точка сортировки.
function sortedStudents(list) {
  return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
}

// Следующий класс для перевода на новый учебный год (5→6…10→11), для 11 перевода нет.
function nextGrade(grade) {
  const idx = CLASSES.indexOf(grade);
  return idx >= 0 && idx < CLASSES.length - 1 ? CLASSES[idx + 1] : null;
}

// Настройки конкретного класса/литеры/курса (система оценивания и т.п.) —
// заводятся по требованию, пока не настроены явно — используется 5-балльная система.
function classSettingsKey(kind, value, classLetterId) {
  return `${kind}:${value}:${classLetterId || "none"}`;
}
// Ключ "дата отмечена как отметки выставлены" в журнале — своя отметка для каждой
// литеры/подгруппы (letterFilter), т.к. у разных литер уроки на одну дату не связаны.
function journalMarkedKey(kind, value, classLetterId, date) {
  return `${kind}:${value}:${classLetterId || "none"}:${date}`;
}
function getClassSettings(data, kind, value, classLetterId) {
  const key = classSettingsKey(kind, value, classLetterId);
  const found = (data.classSettings || []).find(s => classSettingsKey(s.kind, s.value, s.classLetterId) === key);
  return found || {
    gradingSystem: "5",
    periodMode: "quarter",
    requiredMarks: null
  };
}
function settingsForLesson(data, lesson) {
  return getClassSettings(data, lesson.courseId ? "course" : "class", lesson.courseId || lesson.class, lesson.classLetterId || null);
}
function settingsForStudent(data, student) {
  return getClassSettings(data, student.courseId ? "course" : "class", student.courseId || student.class, student.courseId ? student.courseSubgroupId || null : student.classLetterId || null);
}
const GRADING_SYSTEM_LABELS = {
  "5": "5-балльная",
  "100": "100-балльная",
  combined: "Комбинированная"
};

// Рассадка по классу/литере (или курсу/подгруппе). 3 "ряда" — физические ряды парт в классе
// (у окна / посередине / у двери), каждый — список парт от доски вглубь класса. Ограничение по
// зрению — "не далее N-й парты от доски", не зависит от того, в каком ряду сидит ученик.
function seatingKey(kind, value, classLetterId) {
  return `${kind}:${value}:${classLetterId || "none"}`;
}
function getSeatingLayout(data, kind, value, classLetterId) {
  const key = seatingKey(kind, value, classLetterId);
  return (data.seatingLayouts || []).find(s => seatingKey(s.kind, s.value, s.classLetterId) === key) || null;
}
// Гарантирует, что в каждом ряду есть хотя бы одна парта со свободным местом (чтобы было куда
// добавить ученика кликом), и убирает лишние полностью пустые парты в хвосте ряда.
function ensureSeatingCapacity(layout) {
  layout.files.forEach(file => {
    while (file.length > 1 && file[file.length - 1].seats.every(s => !s) && file[file.length - 2].seats.every(s => !s)) {
      file.pop();
    }
    if (file.length === 0 || !file.some(desk => desk.seats.some(s => !s))) {
      file.push({
        id: uid(),
        seats: [null, null]
      });
    }
  });
}
function getOrCreateSeatingLayout(d, kind, value, classLetterId) {
  d.seatingLayouts = d.seatingLayouts || [];
  const key = seatingKey(kind, value, classLetterId);
  let layout = d.seatingLayouts.find(s => seatingKey(s.kind, s.value, s.classLetterId) === key);
  if (!layout) {
    layout = {
      id: uid(),
      kind,
      value,
      classLetterId: classLetterId || null,
      files: [[], [], []],
      visionLimits: [],
      seatFurther: []
    };
    d.seatingLayouts.push(layout);
  }
  ensureSeatingCapacity(layout);
  return layout;
}
const SEATING_FILE_LABELS = ["У окна", "Посередине", "У двери"];

// На упражнение можно вызвать сразу нескольких учеников — у каждого своя строка
// в item.students[] (имя, отметка, markId). Старый формат (одиночные item.student/
// item.grade/…) конвертируется в этот массив один раз при загрузке файла — см. migrateState.
function itemStudents(item) {
  return Array.isArray(item.students) ? item.students : [];
}

// Находит/заводит ученика в журнале (по имени + классу/литере/курсу этого урока)
// и синхронизирует его отметку за конкретное упражнение. Если имя или отметку
// стёрли — соответствующая запись в журнале удаляется. Запись хранит markId,
// чтобы повторное изменение отметки правило ту же запись, а не плодило новые.
function syncStudentEntryMark(d, lesson, item, entry) {
  const name = (entry.name || "").trim();
  const gradeRaw = (entry.grade || "").trim();
  if (!name || !gradeRaw) {
    if (entry.markId) {
      d.marks = d.marks.filter(m => m.id !== entry.markId);
      entry.markId = null;
    }
    return;
  }
  let student = d.students.find(s => s.name.trim().toLowerCase() === name.toLowerCase() && (s.class || null) === (lesson.class || null) && (s.courseId || null) === (lesson.courseId || null) && (s.classLetterId || null) === (lesson.classLetterId || null));
  if (!student) {
    student = {
      id: uid(),
      name,
      class: lesson.class || null,
      courseId: lesson.courseId || null,
      classLetterId: lesson.classLetterId || null
    };
    d.students.push(student);
  }
  const markDate = lesson.actualDate || lesson.plannedDate || todayIso();
  const ex = d.examples.find(e => e.id === item.refId);
  const reason = ex ? stripHtml(ex.text).slice(0, 60) : lesson.topic || "";
  const value = Number(gradeRaw) || gradeRaw;
  const scale = entry.gradeScale || "5";
  const excused = value === "Н" ? entry.gradeExcused !== false : null;
  let mark = entry.markId ? d.marks.find(m => m.id === entry.markId) : null;
  if (mark) {
    mark.studentId = student.id;
    mark.value = value;
    mark.date = markDate;
    mark.reason = reason;
    mark.scale = scale;
    mark.excused = excused;
    mark.lessonId = lesson.id;
    mark.exerciseId = item.refId || null;
  } else {
    mark = {
      id: uid(),
      studentId: student.id,
      value,
      date: markDate,
      reason,
      scale,
      excused,
      lessonId: lesson.id,
      exerciseId: item.refId || null
    };
    d.marks.push(mark);
    entry.markId = mark.id;
  }
}

// Уроки в одной "группе" (класс+литера, либо курс) — литеры считаются независимо друг от друга.
function sameLessonGroup(a, b) {
  if (a.courseId || b.courseId) return a.courseId === b.courseId;
  return a.class === b.class && (a.classLetterId || null) === (b.classLetterId || null);
}
function lessonNumber(lesson, data) {
  const group = data.lessons.filter(l => sameLessonGroup(l, lesson));
  const sorted = group.sort((a, b) => a.order - b.order);
  return sorted.findIndex(l => l.id === lesson.id) + 1;
}
// Пересчитывает order всех уроков группы (класс+литера/курс) по датам — уроки с датой идут по датам
// в хронологическом порядке, уроки без даты — следом, в прежнем относительном порядке.
function resyncOrderForGroup(d, sampleLesson) {
  const group = d.lessons.filter(l => sameLessonGroup(l, sampleLesson));
  const withDate = group.filter(l => l.plannedDate).sort((a, b) => a.plannedDate < b.plannedDate ? -1 : a.plannedDate > b.plannedDate ? 1 : a.order - b.order);
  const withoutDate = group.filter(l => !l.plannedDate).sort((a, b) => a.order - b.order);
  [...withDate, ...withoutDate].forEach((l, idx) => {
    l.order = idx;
  });
}

// Создаёт урок(и) при добавлении нового: если у класса есть литеры — по одному независимому
// уроку на каждую (удаление/редактирование дальше не связаны между собой); если литер нет —
// один урок, как раньше. Курсы литер не имеют — всегда один урок.
// plannedDate: если явно передана (например, выбрана кликом по дате в календаре) — ставится всем
// копиям одинаково; если не передана — каждая копия получает дату "на следующий день после
// последнего урока этой же литеры/курса в календаре" (или пусто, если уроков с датой ещё нет).
// Создаёт ОДИН новый урок (для конкретного класса/литеры или курса) — дата автоматически
// ставится на следующий день после последнего урока этой же литеры/курса в календаре, если
// такой уже есть. Урок по литерам сам по себе не размножается — когда он наполнен (упражнения,
// теги, тип) и его нужно распространить на другие литеры, для этого есть отдельная кнопка
// «Перенести в другие литеры» на странице урока.
function createSingleLesson(d, {
  kind,
  value,
  classLetterId,
  topic,
  plannedDate
}) {
  const sample = {
    class: kind === "class" ? value : null,
    courseId: kind === "course" ? value : null,
    classLetterId: classLetterId || null
  };
  const siblings = d.lessons.filter(l => sameLessonGroup(l, sample));
  const order = siblings.length ? Math.max(...siblings.map(l => l.order)) + 1 : 0;
  let autoDate = plannedDate;
  if (autoDate === undefined) {
    const groupDates = siblings.map(l => l.plannedDate).filter(Boolean).sort();
    autoDate = groupDates.length ? addDaysIso(groupDates[groupDates.length - 1], 1) : "";
  }
  const id = uid();
  const created = {
    id,
    class: sample.class,
    courseId: sample.courseId,
    classLetterId: sample.classLetterId,
    topic: topic || "",
    topicTagIds: [],
    lessonTypeTagIds: [],
    items: [],
    homework: "",
    homeworkItems: [],
    homeworkAttachments: [],
    completed: false,
    archived: false,
    plannedDate: autoDate,
    actualDate: "",
    excludeFromSchedule: false,
    needsWork: false,
    order
  };
  d.lessons.push(created);
  // Если дата задана явно (например, клик по конкретному дню в календаре) — она может оказаться
  // раньше уже существующих уроков этой же литеры/курса, поэтому сразу пересчитываем order по
  // датам, а не просто добавляем урок в конец списка.
  if (created.plannedDate) resyncOrderForGroup(d, created);
  return id;
}

// Независимая копия существующего урока в выбранный класс/литеру (или курс) — материалы и ДЗ
// клонируются, отметки/статус "пройден"/дата — нет, копия начинает свою собственную историю.
function duplicateLessonInto(d, srcId, {
  kind,
  value,
  classLetterId
}) {
  const src = d.lessons.find(x => x.id === srcId);
  if (!src) return null;
  const sample = {
    class: kind === "class" ? value : null,
    courseId: kind === "course" ? value : null,
    classLetterId: classLetterId || null
  };
  const siblings = d.lessons.filter(l => sameLessonGroup(l, sample));
  const order = siblings.length ? Math.max(...siblings.map(s => s.order)) + 1 : 0;
  const clone = structuredClone(src);
  const copy = {
    ...clone,
    id: uid(),
    class: sample.class,
    courseId: sample.courseId,
    classLetterId: sample.classLetterId,
    order,
    completed: false,
    archived: false,
    plannedDate: clone.plannedDate || "",
    actualDate: "",
    needsWork: false,
    items: (clone.items || []).map(it => ({
      ...it,
      id: uid(),
      students: itemStudents(it).map(s => ({
        ...s,
        id: uid(),
        markId: null
      }))
    })),
    homeworkItems: (clone.homeworkItems || []).map(it => ({
      ...it,
      id: uid()
    }))
  };
  d.lessons.push(copy);
  if (copy.plannedDate) resyncOrderForGroup(d, copy);
  return copy.id;
}
function pluralizeRu(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
function formatDateRu(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/* ============================================================
   КАЛЕНДАРЬ / ЖУРНАЛ: даты, каникулы, цвета классов и курсов
   ============================================================ */
const MONTHS_RU = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_RU_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const CLASS_COLORS = {
  "5": "#2678b3",
  "6": "#2f9e64",
  "7": "#e0ac00",
  "8": "#c0392b",
  "9": "#7e57c2",
  "10": "#00838f",
  "11": "#ad6800"
};
function pad2(n) {
  return String(n).padStart(2, "0");
}
function isoOfDate(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function fromIso(iso) {
  const p = iso.split("-");
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function addDaysIso(iso, n) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return isoOfDate(d);
}
function mondayOf(iso) {
  const d = fromIso(iso);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return isoOfDate(d);
}
function todayIso() {
  return isoOfDate(new Date());
}
function curMonthYm() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
}
function monthDaysCount(ym) {
  const p = ym.split("-");
  return new Date(+p[0], +p[1], 0).getDate();
}
function addMonthsYm(ym, delta) {
  const p = ym.split("-");
  const d = new Date(+p[0], +p[1] - 1 + delta, 1);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
}
function ymLabel(ym) {
  const p = ym.split("-");
  return MONTHS_RU[+p[1] - 1] + " " + p[0];
}
function dayNum(iso) {
  return +iso.slice(8, 10);
}
function shortMon(iso) {
  return MONTHS_RU_SHORT[+iso.slice(5, 7) - 1];
}
function weekdayShort(iso) {
  return WEEKDAYS_RU[(fromIso(iso).getDay() + 6) % 7];
}
function ruShortDate(iso) {
  return dayNum(iso) + " " + shortMon(iso);
}
function weeksOfMonthYm(ym) {
  const start = mondayOf(ym + "-01");
  const lastIso = ym + "-" + pad2(monthDaysCount(ym));
  const out = [];
  let cur = start,
    g = 0;
  while (cur <= lastIso && g < 10) {
    out.push(cur);
    cur = addDaysIso(cur, 7);
    g++;
  }
  return out;
}
function monthGridYm(ym) {
  const start = mondayOf(ym + "-01");
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const iso = addDaysIso(start, i);
    cells.push({
      iso,
      inMonth: iso.slice(0, 7) === ym
    });
  }
  return cells;
}
function weekLabelRange(mon) {
  const sun = addDaysIso(mon, 6);
  if (mon.slice(5, 7) === sun.slice(5, 7)) return dayNum(mon) + "–" + dayNum(sun) + " " + shortMon(sun);
  return dayNum(mon) + " " + shortMon(mon) + " – " + dayNum(sun) + " " + shortMon(sun);
}
function sortedVacations(data) {
  return [...data.vacations].sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
}
function vacationAt(data, iso) {
  return data.vacations.find(v => v.start && v.end && iso >= v.start && iso <= v.end) || null;
}
function quarterOfDate(data, iso) {
  let n = 0;
  sortedVacations(data).forEach(v => {
    if (v.end && v.end < iso) n++;
  });
  return n;
}
function quarterCountOf(data) {
  return data.vacations.length + 1;
}
// Полугодие = пара четвертей (0,1 → 1-е; 2,3 → 2-е и т.д.) — своего явного деления
// на полугодия в программе нет, поэтому просто группируем уже посчитанные четверти.
function semesterOfQuarter(q) {
  return Math.floor(q / 2);
}
function semesterCountOf(qc) {
  return Math.ceil(qc / 2);
}
function quartersInPeriod(periodMode, periodIdx, qc) {
  if (periodMode !== "semester") return [periodIdx];
  const out = [];
  for (let q = periodIdx * 2; q < Math.min(periodIdx * 2 + 2, qc); q++) out.push(q);
  return out;
}
// Дата окончания четверти q — начало следующих каникул (если это не последняя четверть,
// у которой определённого конца в программе нет — считаем её открытой).
function quarterEndDate(data, q) {
  const vac = sortedVacations(data);
  return vac[q]?.start || null;
}
function periodEndDate(data, periodMode, periodIdx, qc) {
  const qs = quartersInPeriod(periodMode, periodIdx, qc);
  return quarterEndDate(data, qs[qs.length - 1]);
}

// Единый список "классы + курсы" для выбора в календаре/журнале.
function allTracks(data) {
  return [...CLASSES.map(c => ({
    kind: "class",
    value: c,
    label: `${c} класс`,
    color: CLASS_COLORS[c] || "#888"
  })), ...data.courses.map(c => ({
    kind: "course",
    value: c.id,
    label: c.name,
    color: c.color || "#888"
  }))];
}
function trackKeyOf(kindOrLesson, value) {
  if (typeof kindOrLesson === "object") {
    const l = kindOrLesson;
    return l.courseId ? `course:${l.courseId}` : `class:${l.class}`;
  }
  return `${kindOrLesson}:${value}`;
}
function trackColorOf(data, kind, value) {
  if (kind === "course") return data.courses.find(c => c.id === value)?.color || "#888";
  return CLASS_COLORS[value] || "#888";
}
function lessonTrackColor(lesson, data) {
  return lesson.courseId ? trackColorOf(data, "course", lesson.courseId) : trackColorOf(data, "class", lesson.class);
}
// Цвет отметки/среднего зависит от шкалы — 5-балльной или 100-балльной.
// Намеренно НЕ пересчитываем 100-балльные отметки в 5-балльные — это отдельный вопрос,
// который пока не решён; каждая шкала живёт своей жизнью.
function markColorFor(v, scale = "5") {
  if (scale === "100") return v >= 85 ? "#1b7a4a" : v >= 65 ? "#2678b3" : v >= 45 ? "#c98a2b" : "#c0392b";
  return v >= 5 ? "#1b7a4a" : v >= 4 ? "#2678b3" : v >= 3 ? "#c98a2b" : "#c0392b";
}
function avgColorFor(a, scale = "5") {
  if (scale === "100") return a >= 85 ? "#1b7a4a" : a >= 65 ? "#2678b3" : a >= 45 ? "#c98a2b" : "#c0392b";
  return a >= 4.5 ? "#1b7a4a" : a >= 3.5 ? "#2678b3" : a >= 2.5 ? "#c98a2b" : "#c0392b";
}
// Без scale — все отметки ученика; со scale — только отметки этой шкалы (для комбинированной системы).
// "Н" (пропуск) — тоже запись в data.marks, поэтому studentMarksOf её включает.
function studentMarksOf(data, sid, scale) {
  const ms = data.marks.filter(m => m.studentId === sid);
  return scale ? ms.filter(m => (m.scale || "5") === scale) : ms;
}
// Только реальные числовые отметки — без "Н" (пропуск не участвует в среднем и подсчёте отметок).
function numericMarksOf(data, sid, scale) {
  return studentMarksOf(data, sid, scale).filter(m => m.value !== "Н");
}
function quarterAvgOf(data, sid, q, scale) {
  const ms = numericMarksOf(data, sid, scale).filter(m => quarterOfDate(data, m.date) === q);
  if (!ms.length) return null;
  return Math.round(ms.reduce((a, m) => a + (+m.value || 0), 0) / ms.length * 100) / 100;
}
function yearAvgOf(data, sid, scale) {
  const ms = numericMarksOf(data, sid, scale);
  if (!ms.length) return null;
  return Math.round(ms.reduce((a, m) => a + (+m.value || 0), 0) / ms.length * 100) / 100;
}
function scalesInUse(gradingSystem) {
  return gradingSystem === "100" ? ["100"] : gradingSystem === "combined" ? ["5", "100"] : ["5"];
}
// Цвет для имени ученика в журнале, если отметок за период меньше нормы: чем меньше остаётся
// уроков, чтобы наверстать нехватку, тем краснее — как просили: "краснеет с каждым уроком".
// Возвращает null, когда норма набрана (или не задана) — обычный цвет.
function urgencyColorFor(haveCount, requiredMarks, remainingLessons) {
  if (!requiredMarks) return null;
  const shortfall = requiredMarks - haveCount;
  if (shortfall <= 0) return null;
  if (remainingLessons <= 0) return THEME.red;
  const urgency = shortfall / remainingLessons;
  if (urgency >= 1) return THEME.red;
  if (urgency >= 0.5) return "#d97b3f";
  return "#dba556";
}
// Годовая средняя — не сырое среднее всех отметок за год, а среднее по уже посчитанным
// четвертным средним (так каждая четверть весит одинаково, независимо от числа отметок в ней).
function yearAvgFromQuarters(data, sid, scale, qc) {
  const qAvgs = [];
  for (let q = 0; q < qc; q++) {
    const a = quarterAvgOf(data, sid, q, scale);
    if (a != null) qAvgs.push(a);
  }
  if (!qAvgs.length) return null;
  return Math.round(qAvgs.reduce((a, b) => a + b, 0) / qAvgs.length * 100) / 100;
}
// Округляет среднюю до ближайшей целой отметки 1–5 (для "итоговой" отметки студента за период).
function roundToGrade(avg) {
  return avg == null ? null : Math.max(1, Math.min(5, Math.round(avg)));
}

// Текст всплывающей подсказки над клеткой с отметкой: дата, тема урока, тип урока, упражнение.
function markTooltip(data, m) {
  const lines = [formatDateRu(m.date)];
  if (m.lessonId) {
    const lesson = data.lessons.find(l => l.id === m.lessonId);
    if (lesson) {
      lines.push(lesson.topic || "Без темы");
      const typeNames = (lesson.lessonTypeTagIds || []).map(id => data.tags.lessonType.find(t => t.id === id)?.name).filter(Boolean);
      if (typeNames.length) lines.push("Тип урока: " + typeNames.join(", "));
    }
  }
  if (m.exerciseId) {
    const ex = data.examples.find(e => e.id === m.exerciseId);
    if (ex) lines.push("Упражнение: " + stripHtml(ex.text).slice(0, 90));
  }
  if (!m.lessonId && m.reason) lines.push(m.reason);
  return lines.join("\n");
}

// % успеваемости/качества — считаются только по 5-балльной шкале (у 100-балльной нет
// понятия "3/4/5"). Ученик: по его собственным отметкам. Класс: по одной "итоговой" отметке
// на ученика за период (округлённое среднее за период, либо сырая отметка — для отчёта за
// конкретную дату/работу), знаменатель — весь список класса, а не только у кого есть отметки.
function performancePct(grades) {
  const withGrade = grades.filter(g => g != null);
  if (!grades.length) return null;
  return Math.round(withGrade.filter(g => g >= 3).length / grades.length * 1000) / 10;
}
function qualityPct(grades) {
  const withGrade = grades.filter(g => g != null);
  if (!grades.length) return null;
  return Math.round(withGrade.filter(g => g >= 4).length / grades.length * 1000) / 10;
}
function pctBarHtml(pct, color) {
  if (pct == null) return `<span style="color:#999;">нет данных</span>`;
  const p = Math.max(0, Math.min(100, pct));
  return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;">
    <div style="width:180px;height:10px;background:#e6eef4;border-radius:5px;overflow:hidden;"><div style="width:${p}%;height:10px;background:${color};"></div></div>
    <b>${pct}%</b>
  </div>`;
}
function fmtAvgNum(a) {
  return a == null ? "—" : a.toFixed(2).replace(".", ",");
}

// Изучен ли урок с точки зрения календарного плана: пройден, помечен "не учитывать",
// либо уже есть фактическая дата проведения.
function isLessonStudied(l) {
  return !!(l.completed || l.excludeFromSchedule || l.actualDate);
}

// Разница между планом и фактом для ОДНОГО урока, в днях.
// Отрицательное число = опережение (провели раньше плана), положительное = отставание.
function lessonDateDiffDays(lesson) {
  if (!lesson.plannedDate || !lesson.actualDate) return null;
  const planned = new Date(lesson.plannedDate);
  const actual = new Date(lesson.actualDate);
  return Math.round((actual - planned) / 86400000);
}

// Калькулятор опережения/отставания для ГРУППЫ уроков (класс или курс):
// сравнивает, сколько уроков должно быть пройдено по плану на сегодня,
// со сколькими фактически изучено (isLessonStudied).
function computeScheduleStatus(lessons) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const relevant = lessons.filter(l => !l.archived);
  const withPlan = relevant.filter(l => l.plannedDate);
  const plannedSoFar = withPlan.filter(l => new Date(l.plannedDate) <= today).length;
  const studiedSoFar = relevant.filter(isLessonStudied).length;
  const diff = studiedSoFar - plannedSoFar;
  return {
    plannedSoFar,
    studiedSoFar,
    diff,
    hasPlan: withPlan.length > 0
  };
}
function lessonToHtml(lesson, data) {
  const topicTags = (lesson.topicTagIds || []).map(id => data.tags.topic.find(t => t.id === id)).filter(Boolean);
  const typeTags = (lesson.lessonTypeTagIds || []).map(id => data.tags.lessonType.find(t => t.id === id)).filter(Boolean);
  const items = (lesson.items || []).map(it => ({
    it,
    obj: it.type === "exercise" ? data.examples.find(e => e.id === it.refId) : data.theory.find(t => t.id === it.refId)
  })).filter(x => x.obj);
  const itemsHtml = items.map(({
    it,
    obj
  }, idx) => {
    const numLabel = `<div class="muted" style="margin-top:14px;">№${idx + 1} ${it.type === "exercise" ? "· Упражнение" : "· Теория"}</div>`;
    return numLabel + (it.type === "exercise" ? exerciseToHtml(obj, data) : theoryPageToHtml(obj));
  }).join("");
  const homeworkItems = (lesson.homeworkItems || []).map(it => data.examples.find(e => e.id === it.refId)).filter(Boolean);
  const homeworkItemsHtml = homeworkItems.map((ex, idx) => `<div class="muted" style="margin-top:14px;">№${idx + 1} · Упражнение</div>` + exerciseToHtml(ex, data)).join("");
  return `<div>
    <div class="muted">${escapeHtml(lessonPlaceLabel(lesson, data))}</div>
    <h2>${escapeHtml(lesson.topic || "Без темы")}</h2>
    ${topicTags.length ? `<div>Темы: ${topicTags.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join("")}</div>` : ""}
    ${typeTags.length ? `<div style="margin-top:6px;">Тип урока: ${typeTags.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join("")}</div>` : ""}
    ${lesson.plannedDate || lesson.actualDate ? `<div style="margin-top:6px;" class="muted">${lesson.plannedDate ? `Планируемая дата: ${formatDateRu(lesson.plannedDate)} ` : ""}${lesson.actualDate ? `· Фактическая дата: ${formatDateRu(lesson.actualDate)}` : ""}</div>` : ""}
    <h3>Материалы урока</h3>
    ${itemsHtml || "<div class='muted'>—</div>"}
    <h3>Домашняя работа</h3>
    <div>${escapeHtml(lesson.homework) || "—"}</div>
    ${homeworkItemsHtml}
  </div>`;
}

// То же самое, что exerciseToHtml/lessonToHtml, но с учётом чек-листа "что убирать по
// умолчанию" (data.worksheetChecklist) — используется только для черновика рабочего листа
// перед отправкой ученику. Сам учительский конспект (exerciseToHtml/lessonToHtml) не трогаем.
function exerciseWorksheetHtml(ex, data, checklist) {
  const typeTag = data.tags.type.find(t => t.id === ex.typeTagId);
  const topicTags = ex.topicTagIds.map(id => data.tags.topic.find(t => t.id === id)).filter(Boolean);
  return `<div class="ex">
    ${checklist.hideExerciseType ? "" : `<div class="muted">Тип: ${escapeHtml(typeTag?.name || "—")}</div>`}
    <div style="font-weight:bold; margin:6px 0;">${ex.text}</div>
    ${!checklist.hideNotes && ex.note ? `<div style="margin-bottom:6px;">${escapeHtml(ex.note)}</div>` : ""}
    ${!checklist.hideExerciseTopics && topicTags.length ? `<div class="muted">Темы: ${topicTags.map(t => escapeHtml(t.name)).join(", ")}</div>` : ""}
    ${!checklist.hideRedFlags && ex.redNote ? `<div class="red">⚑ ${escapeHtml(ex.redNote)}</div>` : ""}
  </div>`;
}
function lessonWorksheetHtml(lesson, data, checklist) {
  const topicTags = (lesson.topicTagIds || []).map(id => data.tags.topic.find(t => t.id === id)).filter(Boolean);
  const typeTags = (lesson.lessonTypeTagIds || []).map(id => data.tags.lessonType.find(t => t.id === id)).filter(Boolean);
  const items = (lesson.items || []).map(it => ({
    it,
    obj: it.type === "exercise" ? data.examples.find(e => e.id === it.refId) : data.theory.find(t => t.id === it.refId)
  })).filter(x => x.obj);
  const itemsHtml = items.map(({
    it,
    obj
  }, idx) => {
    const numLabel = `<div class="muted" style="margin-top:14px;">№${idx + 1} ${it.type === "exercise" ? "· Упражнение" : "· Теория"}</div>`;
    return numLabel + (it.type === "exercise" ? exerciseWorksheetHtml(obj, data, checklist) : theoryPageToHtml(obj));
  }).join("");
  const homeworkItems = (lesson.homeworkItems || []).map(it => data.examples.find(e => e.id === it.refId)).filter(Boolean);
  const homeworkItemsHtml = homeworkItems.map((ex, idx) => `<div class="muted" style="margin-top:14px;">№${idx + 1} · Упражнение</div>` + exerciseWorksheetHtml(ex, data, checklist)).join("");
  return `<div>
    <h2>${escapeHtml(lesson.topic || "Без темы")}</h2>
    ${!checklist.hideLessonTopics && topicTags.length ? `<div>Темы: ${topicTags.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join("")}</div>` : ""}
    ${!checklist.hideLessonType && typeTags.length ? `<div style="margin-top:6px;">Тип урока: ${typeTags.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join("")}</div>` : ""}
    ${!checklist.hideDates && (lesson.plannedDate || lesson.actualDate) ? `<div style="margin-top:6px;" class="muted">${lesson.plannedDate ? `Планируемая дата: ${formatDateRu(lesson.plannedDate)} ` : ""}${lesson.actualDate ? `· Фактическая дата: ${formatDateRu(lesson.actualDate)}` : ""}</div>` : ""}
    <h3>Материалы урока</h3>
    ${itemsHtml || "<div class='muted'>—</div>"}
    <h3>Домашняя работа</h3>
    <div>${escapeHtml(lesson.homework) || "—"}</div>
    ${homeworkItemsHtml}
  </div>`;
}
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Полноэкранный просмотр картинки-вложения с кнопкой скачивания.
function ImageLightboxModal({
  src,
  name,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(10,20,35,0.9)",
      zIndex: 1200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      maxWidth: "92vw",
      maxHeight: "92vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      maxWidth: "92vw",
      maxHeight: "80vh",
      borderRadius: 8,
      display: "block",
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => downloadDataUrl(src, name || "image.jpg")
  }, "\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#fff",
      border: "1.5px solid rgba(255,255,255,0.5)"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C"))));
}

// Единая отрисовка вложений: картинки открываются в полноэкранном просмотре
// (с кнопкой скачивания), остальные файлы скачиваются сразу по клику —
// без этого прикреплённые файлы было невозможно ни посмотреть, ни сохранить.
function AttachmentThumbs({
  attachments,
  size = 54
}) {
  const [lightbox, setLightbox] = useState(null);
  if (!attachments || attachments.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, attachments.map(a => a.kind === "image" ? /*#__PURE__*/React.createElement("img", {
    key: a.id,
    src: a.dataUrl,
    alt: a.name,
    title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435",
    onClick: e => {
      e.stopPropagation();
      setLightbox(a);
    },
    style: {
      width: size,
      height: size,
      objectFit: "cover",
      borderRadius: 6,
      cursor: "pointer"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    key: a.id,
    title: a.dataUrl ? "Скачать файл" : a.url ? "Открыть ссылку" : "Ссылка не указана",
    onClick: e => {
      e.stopPropagation();
      if (a.dataUrl) downloadDataUrl(a.dataUrl, a.name || "file");else if (a.url) window.open(a.url, "_blank");
    },
    style: {
      fontSize: 11,
      background: "#dfeaf3",
      padding: "4px 8px",
      borderRadius: 6,
      color: "#12233a",
      cursor: a.dataUrl || a.url ? "pointer" : "default"
    }
  }, "\uD83D\uDCCE ", a.name, a.dataUrl ? " ⬇" : "")), lightbox && /*#__PURE__*/React.createElement(ImageLightboxModal, {
    src: lightbox.dataUrl,
    name: lightbox.name,
    onClose: () => setLightbox(null)
  }));
}
function ScheduleCalculator({
  status,
  style = {}
}) {
  if (!status.hasPlan) return null;
  const {
    diff,
    plannedSoFar,
    studiedSoFar
  } = status;
  let label, color;
  if (diff > 0) {
    label = `Опережение на ${diff} ${pluralizeRu(diff, "урок", "урока", "уроков")}`;
    color = "#1b5e20";
  } else if (diff < 0) {
    label = `Отставание на ${Math.abs(diff)} ${pluralizeRu(Math.abs(diff), "урок", "урока", "уроков")}`;
    color = THEME.red;
  } else {
    label = "Точно по плану";
    color = "#12233a";
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      background: "#fff",
      border: "1px solid #d7e6f0",
      borderRadius: 10,
      padding: "8px 14px",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 13,
      color
    }
  }, "\uD83D\uDCCA ", label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "#7a8a9c"
    }
  }, "\u041F\u043E \u043F\u043B\u0430\u043D\u0443 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F: ", plannedSoFar, " \xB7 \u0418\u0437\u0443\u0447\u0435\u043D\u043E: ", studiedSoFar));
}
function ExportButtons({
  onWord,
  onPdf,
  small = true,
  label = "",
  labeled = false
}) {
  if (labeled) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        alignItems: "center"
      }
    }, label && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: "#7a8a9c"
      }
    }, label), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: small,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: onWord,
      title: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 Word (.doc)"
    }, "\uD83D\uDCC4 Word"), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: small,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: onPdf,
      title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433 \u043F\u0435\u0447\u0430\u0442\u0438 \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \xAB\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A PDF\xBB"
    }, "\uD83D\uDDA8 PDF"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 2,
      alignItems: "center"
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#7a8a9c",
      marginRight: 4
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    onClick: onWord,
    title: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 Word (.doc)"
  }, "\uD83D\uDCC4"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    onClick: onPdf,
    title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u0438\u0430\u043B\u043E\u0433 \u043F\u0435\u0447\u0430\u0442\u0438 \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \xAB\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A PDF\xBB"
  }, "\uD83D\uDDA8"));
}
function loadFont() {
  if (document.getElementById("lc-fonts")) return;
  const link = document.createElement("link");
  link.id = "lc-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=PT+Sans:wght@400;700&display=swap";
  document.head.appendChild(link);
}
function injectStyles() {
  if (document.getElementById("lc-notion-style")) return;
  const style = document.createElement("style");
  style.id = "lc-notion-style";
  style.textContent = `
    .lc-row { transition: background-color .1s ease; }
    .lc-row:hover { background-color: rgba(19,44,83,0.035); }
    .lc-row .lc-reveal { opacity: 0; pointer-events: none; transition: opacity .1s ease; }
    .lc-row:hover .lc-reveal { opacity: 1; pointer-events: auto; }
    .lc-iconbtn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 6px; border: 1px solid transparent;
      background: transparent; cursor: pointer; color: #5a6b7d; font-size: 13px; line-height: 1;
      transition: background-color .1s ease, color .1s ease;
    }
    .lc-iconbtn:hover { background-color: rgba(19,44,83,0.08); color: #12233a; }
    .lc-toggle-caret { display:inline-block; transition: transform .12s ease; color: #8a97a5; font-size: 11px; }
    .lc-toggle-caret.open { transform: rotate(90deg); }
    .lc-worksheet .muted { color: #7a8a9c; font-size: 11.5px; }
    .lc-worksheet .tag { background: #eef3f7; padding: 2px 8px; border-radius: 10px; margin-right: 5px; font-size: 11px; display: inline-block; }
    .lc-worksheet .red { color: #c1554b; font-weight: bold; }
    .lc-worksheet .ex { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }
    .lc-worksheet h2 { font-family: 'Playfair Display', Georgia, serif; }
    .lc-worksheet h3 { margin-top: 16px; }
  `;
  document.head.appendChild(style);
}
function resizeImage(file, maxW = 640, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Максимальный размер файла (не фото), который встраивается целиком, чтобы его можно
// было открыть/скачать прямо из приложения. Более крупные файлы просят добавить ссылкой.
const MAX_EMBED_FILE_SIZE = 4 * 1024 * 1024;
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   МЕЛКИЕ UI-КОМПОНЕНТЫ
   ============================================================ */
function Heading({
  children,
  size = 22,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: HEAD_FONT,
      fontWeight: 800,
      color: THEME.bgDark,
      fontSize: size,
      margin: 0,
      letterSpacing: 0.2,
      ...style
    }
  }, children);
}
function Badge({
  tag,
  onClick,
  active,
  onRemove
}) {
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: tag.color,
      color: contrastTextColor(tag.color),
      fontFamily: BODY_FONT,
      fontSize: 12.5,
      fontWeight: 700,
      padding: "4px 10px",
      borderRadius: 999,
      cursor: onClick ? "pointer" : "default",
      border: active ? `2px solid ${contrastTextColor(tag.color)}` : "2px solid transparent",
      opacity: active === false ? 0.45 : 1,
      whiteSpace: "nowrap"
    }
  }, tag.name, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onRemove();
    },
    style: {
      cursor: "pointer",
      fontWeight: 900,
      opacity: 0.6
    }
  }, "\xD7"));
}

// Компактный выбор тегов "Тема урока": показывает только уже выбранные теги,
// остальные находятся через поиск (чтобы не показывать сразу весь список).
function TopicTagPicker({
  data,
  selectedIds,
  onToggle,
  ensureTopicTag,
  onDeleteTag,
  placeholder = "Найти или создать тему…"
}) {
  const [q, setQ] = useState("");
  const selected = selectedIds.map(id => data.tags.topic.find(t => t.id === id)).filter(Boolean);
  const matches = q.trim() ? data.tags.topic.filter(t => !selectedIds.includes(t.id) && t.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const exactMatch = data.tags.topic.some(t => t.name.toLowerCase() === q.trim().toLowerCase());
  return /*#__PURE__*/React.createElement("div", null, selected.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 8
    }
  }, selected.map(t => /*#__PURE__*/React.createElement(Badge, {
    key: t.id,
    tag: t,
    onClick: () => onToggle(t.id),
    onRemove: onDeleteTag ? () => onDeleteTag(t.id) : undefined
  }))), /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      maxWidth: 260
    },
    placeholder: placeholder,
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && q.trim() && !exactMatch) {
        const id = ensureTopicTag(q.trim());
        onToggle(id);
        setQ("");
      }
    }
  }), q.trim() && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8
    }
  }, matches.map(t => /*#__PURE__*/React.createElement(Badge, {
    key: t.id,
    tag: t,
    onClick: () => onToggle(t.id)
  })), !exactMatch && /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => {
      const id = ensureTopicTag(q.trim());
      onToggle(id);
      setQ("");
    }
  }, "+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \xAB", q.trim(), "\xBB")));
}
function Btn({
  children,
  onClick,
  kind = "primary",
  small,
  disabled,
  style = {},
  title
}) {
  const base = {
    fontFamily: BODY_FONT,
    fontWeight: 700,
    fontSize: small ? 12.5 : 14,
    padding: small ? "6px 12px" : "9px 18px",
    borderRadius: 10,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "transform .08s ease"
  };
  const kinds = {
    primary: {
      background: THEME.bgDark,
      color: "#ffffff"
    },
    ghost: {
      background: "#ffffff",
      color: THEME.bgDark,
      border: `1.5px solid ${THEME.border}`
    },
    pastel: {
      background: THEME.pastel,
      color: THEME.bgDark
    },
    danger: {
      background: THEME.redBg,
      color: THEME.red,
      border: `1.5px solid ${THEME.red}`
    },
    dark: {
      background: THEME.bgDark,
      color: "#ffffff"
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    title: title,
    disabled: disabled,
    onClick: onClick,
    onMouseDown: e => e.currentTarget.style.transform = "scale(0.97)",
    onMouseUp: e => e.currentTarget.style.transform = "scale(1)",
    style: {
      ...base,
      ...kinds[kind],
      ...style
    }
  }, children);
}
function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: BODY_FONT,
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 5,
      color: "inherit"
    }
  }, label), children);
}
const inputStyle = {
  width: "100%",
  fontFamily: BODY_FONT,
  fontSize: 14,
  padding: "9px 12px",
  borderRadius: 8,
  border: `1.5px solid ${THEME.border}`,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
  color: THEME.panelText
};
function ColorPicker({
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      alignItems: "center"
    }
  }, SWATCHES.map(c => /*#__PURE__*/React.createElement("div", {
    key: c,
    onClick: () => onChange(c),
    style: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: c,
      cursor: "pointer",
      border: value === c ? "3px solid #132033" : "2px solid #fff",
      boxShadow: "0 0 0 1px #cfd8e0"
    }
  })), /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      width: 26,
      height: 26,
      border: "none",
      background: "none",
      cursor: "pointer"
    }
  }));
}

/* ============================================================
   ГЛАВНЫЙ КОМПОНЕНТ
   ============================================================ */
function LessonConstructorInner() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // Путь к файлу проекта, который сейчас открыт. Пока он не выбран (null),
  // работа идёт "в черновике" — программа не знает, куда автосохранять,
  // и покажет экран выбора/создания файла.
  const [projectPath, setProjectPath] = useState(null);
  const [projectPathError, setProjectPathError] = useState(null);
  const [tab, setTab] = useState("bank"); // tags | bank | lessons
  const [activeClass, setActiveClass] = useState("5");
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [lessonTarget, setLessonTarget] = useState({
    kind: "class",
    classNum: "5",
    courseId: null
  });
  // Выбранные литеры/подгруппы и вкладки — запоминаются на уровне всего приложения,
  // чтобы при переходе на другую страницу и обратно всё оставалось там, где было.
  const [lessonsLetterFilter, setLessonsLetterFilter] = useState("all");
  const [calSubTab, setCalSubTab] = useState("calendar");
  const [calFilterKey, setCalFilterKey] = useState("all");
  const [calLetterFilter, setCalLetterFilter] = useState("all");
  const [journalTrackKey, setJournalTrackKey] = useState(null);
  const [journalLetterFilter, setJournalLetterFilter] = useState("all");
  const [classListsTrack, setClassListsTrack] = useState({
    kind: "class",
    value: CLASSES[0]
  });
  const [classListsSub, setClassListsSub] = useState("none");
  const [calMonth, setCalMonth] = useState(curMonthYm());
  const [calView, setCalView] = useState("weeks"); // weeks | month
  // Откуда открыт урок ({tab, scroll}) — «Назад» на странице урока возвращает туда же:
  // в календарь, в архив или (если null) в список уроков.
  const [lessonOrigin, setLessonOrigin] = useState(null);
  const [archiveMode, setArchiveMode] = useState("class");
  const [archiveOpenGroup, setArchiveOpenGroup] = useState(null);
  const saveTimer = useRef(null);
  loadFont();
  injectStyles();
  const openFromText = (text, path) => {
    const parsed = JSON.parse(text);
    setData(migrateState(parsed));
    setProjectPath(path);
    setProjectPathError(null);
  };

  // ---- при запуске пробуем открыть тот же файл, что был открыт в прошлый раз; если это не
  // получилось (файл удалили/повредили, или файл проекта вообще ни разу не выбирали) —
  // пробуем восстановить данные из теневой копии в папке данных приложения ----
  useEffect(() => {
    window.lcAPI.getLastProjectPath().then(async lastPath => {
      if (lastPath) {
        const res = await window.lcAPI.readPath(lastPath);
        if (res.ok) {
          openFromText(res.text, lastPath);
          setLoaded(true);
          return;
        }
      }
      const shadow = await window.lcAPI.readShadowBackup();
      if (shadow.ok) {
        try {
          setData(migrateState(JSON.parse(shadow.text)));
          setProjectPath(null);
          setProjectPathError(null);
          setTimeout(() => alert(lastPath ? `Файл «${lastPath}» не найден или повреждён. Данные восстановлены из резервной копии — сохраните файл заново кнопкой «Сохранить как…».` : "Найдены несохранённые данные из прошлого сеанса (резервная копия) — они восстановлены. Сохраните файл кнопкой «Сохранить как…»."), 0);
        } catch (e) {
          if (lastPath) setProjectPathError(`Не удалось открыть файл «${lastPath}», а резервная копия повреждена.`);
        }
      } else if (lastPath) {
        setProjectPathError(`Не удалось открыть файл «${lastPath}»: файл не найден, а резервной копии нет.`);
      }
      setLoaded(true);
    }).catch(e => {
      console.error("Ошибка при определении последнего файла", e);
      setLoaded(true);
    });
  }, []);

  // На планшете проект всегда хранится в браузерном хранилище — отдельный «файл» выбирать не нужно.
  useEffect(() => {
    if (loaded && data && !projectPath && window.lcDefaultProjectPath) setProjectPath(window.lcDefaultProjectPath);
  }, [loaded, data, projectPath]);

  // ---- автосохранение в текущий открытый файл (с задержкой) ----
  useEffect(() => {
    if (!loaded || !data || !projectPath) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.lcAPI.save(projectPath, JSON.stringify(data)).then(res => {
        if (!res.ok) console.error("Ошибка автосохранения", res.error);
      });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded, projectPath]);

  // ---- теневая копия: пишется при каждом изменении данных в папку данных приложения,
  // независимо от того, выбран ли файл проекта — на случай потери/повреждения основного файла ----
  const shadowTimer = useRef(null);
  useEffect(() => {
    if (!loaded || !data) return;
    if (shadowTimer.current) clearTimeout(shadowTimer.current);
    shadowTimer.current = setTimeout(() => {
      window.lcAPI.writeShadowBackup(JSON.stringify(data)).catch(() => {});
    }, 400);
    return () => clearTimeout(shadowTimer.current);
  }, [data, loaded]);
  const handleOpenProject = async () => {
    const res = await window.lcAPI.openDialog();
    if (res.ok) {
      try {
        openFromText(res.text, res.path);
        confirmSyncAfterSwitch();
      } catch (e) {
        alert("Не удалось прочитать файл — убедитесь, что это файл конструктора уроков (.json).");
      }
    } else if (res.error) {
      alert("Не удалось открыть файл: " + res.error);
    }
  };
  const handleSaveAsProject = async () => {
    if (!data) return;
    const res = await window.lcAPI.saveAsDialog(JSON.stringify(data), "Мои уроки.json");
    if (res.ok) {
      setProjectPath(res.path);
      alert("Сохранено:\n" + res.path);
    }
  };
  const handleNewProject = () => {
    if (data && !window.confirm("Начать новый пустой проект? Текущий открытый файл не изменится — просто перестанет быть активным, пока вы не сохраните новый.")) {
      return;
    }
    setData(migrateState(null));
    setProjectPath(null);
    confirmSyncAfterSwitch();
  };
  const handleBackup = async () => {
    if (!projectPath) {
      alert("Сначала сохраните файл (кнопка «Сохранить как…»), потом можно будет сделать резервную копию.");
      return;
    }
    const res = await window.lcAPI.backup(projectPath);
    if (res.ok) alert("Резервная копия сохранена:\n" + res.path);
  };
  const update = useCallback(fn => setData(prev => fn(structuredClone(prev))), []);

  // Ctrl+S — если файл уже выбран, сохраняем немедленно (не дожидаясь отложенного
  // автосохранения); если ещё нет — то же самое, что кнопка «Сохранить как…».
  useEffect(() => {
    const handler = e => {
      if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) return;
      e.preventDefault();
      if (!data) return;
      if (projectPath) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        window.lcAPI.save(projectPath, JSON.stringify(data)).then(res => {
          if (!res.ok) alert("Не удалось сохранить: " + res.error);
        });
      } else {
        handleSaveAsProject();
      }
      if (syncInfoRef.current.connected && syncOnceRef.current) syncOnceRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [data, projectPath]);

  // Один раз при запуске — тихо проверяем папки автообмена учеников на новые ответы,
  // чтобы они сразу были видны в карточках уроков, без нажатия отдельной кнопки.
  const exchangeCheckedOnLoad = useRef(false);
  useEffect(() => {
    if (!loaded || !data || exchangeCheckedOnLoad.current) return;
    exchangeCheckedOnLoad.current = true;
    runExchangeCheck(data, update, data.students).catch(() => {});
  }, [loaded]);

  // ---- Синхронизация проекта через Яндекс.Диск (файл lessons.json в папке приложения на Диске).
  // Логика сравнения версий — в main-процессе (sync.js); здесь — расписание и разрешение конфликтов.
  const [syncInfo, setSyncInfo] = useState({
    clientId: "",
    connected: false,
    lastSyncAt: null
  });
  const [syncStatus, setSyncStatus] = useState("off"); // off | idle | syncing | ok | error | conflict | paused
  const [syncError, setSyncError] = useState("");
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncConflict, setSyncConflict] = useState(null); // { remoteText, md5 }
  const syncBusy = useRef(false);
  const syncPaused = useRef(false);
  const dataRef = useRef(null);
  const lastSyncedDataRef = useRef(null); // объект data, который последним совпадал с Диском
  const syncConflictRef = useRef(null);
  const syncInfoRef = useRef(syncInfo);
  const syncOnceRef = useRef(null);
  dataRef.current = data;
  syncConflictRef.current = syncConflict;
  syncInfoRef.current = syncInfo;
  const refreshSyncInfo = async () => {
    const info = await window.lcAPI.syncInfo();
    setSyncInfo(info);
    setSyncStatus(s => !info.connected ? "off" : s === "off" ? "idle" : s);
    return info;
  };
  useEffect(() => {
    refreshSyncInfo().catch(() => {});
  }, []);
  const applyRemoteText = async (text, md5) => {
    const nd = migrateState(JSON.parse(text));
    lastSyncedDataRef.current = nd;
    dataRef.current = nd;
    setData(nd);
    await window.lcAPI.syncMarkSynced(md5, JSON.stringify(nd));
  };
  const handleSyncFailure = res => {
    if (res.auth) {
      setSyncInfo(i => ({
        ...i,
        connected: false
      }));
      setSyncStatus("off");
    } else {
      setSyncStatus("error");
    }
    setSyncError(res.error || "Ошибка синхронизации");
  };
  const syncOnce = async () => {
    if (syncBusy.current || syncPaused.current || syncConflictRef.current || !syncInfoRef.current.connected) return;
    syncBusy.current = true;
    setSyncStatus("syncing");
    setSyncError("");
    try {
      const pull = await window.lcAPI.syncPull();
      if (!pull.ok) {
        handleSyncFailure(pull);
        return;
      }
      const cur = dataRef.current;
      if (pull.status === "remote-newer") {
        const changed = cur ? await window.lcAPI.syncIsLocalChanged(JSON.stringify(cur), pull.md5) : false;
        if (!changed) {
          await applyRemoteText(pull.text, pull.md5);
        } else {
          setSyncConflict({
            remoteText: pull.text,
            md5: pull.md5
          });
          setSyncStatus("conflict");
          return;
        }
      } else if (cur && cur !== lastSyncedDataRef.current) {
        const push = await window.lcAPI.syncPush(JSON.stringify(cur), false);
        if (!push.ok) {
          handleSyncFailure(push);
          return;
        }
        if (push.status === "conflict") {
          setSyncStatus("error");
          setSyncError("Файл на Диске изменился во время синхронизации — повторю позже");
          return;
        }
        lastSyncedDataRef.current = cur;
      }
      setSyncInfo(await window.lcAPI.syncInfo());
      setSyncStatus("ok");
    } catch (e) {
      setSyncStatus("error");
      setSyncError(String(e && e.message || e));
    } finally {
      syncBusy.current = false;
    }
  };
  syncOnceRef.current = syncOnce;
  const resolveSyncConflict = async choice => {
    if (!syncConflictRef.current || syncBusy.current) return;
    syncBusy.current = true;
    setSyncStatus("syncing");
    try {
      const cur = dataRef.current;
      const res = await window.lcAPI.syncResolve(choice, cur ? JSON.stringify(cur) : "");
      if (!res.ok) {
        handleSyncFailure(res);
        return;
      }
      if (choice === "remote") await applyRemoteText(res.text, res.md5);else lastSyncedDataRef.current = cur;
      setSyncConflict(null);
      setSyncInfo(await window.lcAPI.syncInfo());
      setSyncStatus("ok");
    } catch (e) {
      setSyncStatus("error");
      setSyncError(String(e && e.message || e));
    } finally {
      syncBusy.current = false;
    }
  };

  // При запуске/подключении — сразу сверяемся; при правках — через 20 с (файл большой, не дёргаем
  // Диск на каждую букву); плюс раз в 90 с и при возвращении в окно подтягиваем чужие изменения.
  useEffect(() => {
    if (loaded && syncInfo.connected) syncOnceRef.current();
  }, [loaded, syncInfo.connected]);
  useEffect(() => {
    if (!loaded || !syncInfo.connected || !data || data === lastSyncedDataRef.current) return;
    const t = setTimeout(() => syncOnceRef.current(), 20000);
    return () => clearTimeout(t);
  }, [data, loaded, syncInfo.connected]);
  useEffect(() => {
    if (!syncInfo.connected) return;
    const iv = setInterval(() => syncOnceRef.current(), 90000);
    const onFocus = () => syncOnceRef.current();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [syncInfo.connected]);

  // Если пользователь вручную открыл другой файл или начал новый проект — не затираем им Диск молча.
  const confirmSyncAfterSwitch = () => {
    if (!syncInfoRef.current.connected) return;
    const ok = window.confirm("Яндекс.Диск подключён. Синхронизировать этот файл с Диском? Данные на Диске будут заменены им.\n\nОК — синхронизировать. Отмена — не синхронизировать до перезапуска программы.");
    syncPaused.current = !ok;
    if (!ok) setSyncStatus("paused");else if (syncStatus === "paused") setSyncStatus("idle");
  };
  const syncLabel = syncStatus === "off" ? "Яндекс.Диск" : syncStatus === "syncing" ? "Синхронизация…" : syncStatus === "error" ? "Ошибка синхр." : syncStatus === "conflict" ? "Конфликт!" : syncStatus === "paused" ? "Синхр. на паузе" : syncInfo.lastSyncAt ? "Синхр. " + new Date(syncInfo.lastSyncAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }) : "Подключён";
  const syncModalEl = /*#__PURE__*/React.createElement(React.Fragment, null, syncModalOpen && /*#__PURE__*/React.createElement(SyncModal, {
    info: syncInfo,
    status: syncStatus,
    error: syncError,
    onClose: () => setSyncModalOpen(false),
    onChanged: refreshSyncInfo,
    onSyncNow: () => {
      syncPaused.current = false;
      if (syncStatus === "paused") setSyncStatus("idle");
      syncOnceRef.current();
    },
    onDisconnected: () => {
      lastSyncedDataRef.current = null;
      setSyncStatus("off");
    }
  }), syncConflict && /*#__PURE__*/React.createElement(SyncConflictModal, {
    onChoose: resolveSyncConflict,
    busy: syncStatus === "syncing"
  }));
  const openLessonFrom = (originTab, lesson) => {
    if (lesson.courseId) {
      setLessonTarget({
        kind: "course",
        classNum: null,
        courseId: lesson.courseId
      });
    } else {
      setActiveClass(lesson.class);
      setLessonTarget({
        kind: "class",
        classNum: lesson.class,
        courseId: null
      });
    }
    setLessonOrigin({
      tab: originTab,
      scroll: window.scrollY
    });
    setActiveLessonId(lesson.id);
    setTab("lessons");
    window.scrollTo({
      top: 0
    });
  };
  // Возвращает true, если урок был открыт не из списка уроков и мы вернулись туда, откуда пришли.
  const goBackFromLesson = () => {
    if (!lessonOrigin) return false;
    const {
      tab: originTab,
      scroll
    } = lessonOrigin;
    setActiveLessonId(null);
    setLessonOrigin(null);
    setTab(originTab);
    setTimeout(() => window.scrollTo({
      top: scroll
    }), 50);
    return true;
  };
  // Ручной переход по вкладкам сбрасывает «откуда пришли» — иначе «Назад» вёл бы в неожиданное место.
  const goTab = t => {
    setLessonOrigin(null);
    setTab(t);
  };
  if (!loaded) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...outer,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: THEME.bgDark,
        fontFamily: BODY_FONT
      }
    }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026"));
  }

  // Файл ещё не открыт (первый запуск, либо предыдущий файл не найден) —
  // просим открыть существующий файл или начать новый проект.
  if (!data) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...outer,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: THEME.panel,
        color: THEME.panelText,
        borderRadius: 16,
        padding: "30px 34px",
        maxWidth: 560,
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(Heading, {
      size: 24,
      style: {
        color: THEME.panelText,
        marginBottom: 14
      }
    }, "\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0443\u0440\u043E\u043A\u043E\u0432"), projectPathError && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        marginBottom: 16,
        color: THEME.red,
        lineHeight: 1.5
      }
    }, projectPathError), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        marginBottom: 20,
        lineHeight: 1.5
      }
    }, "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0444\u0430\u0439\u043B \u0441 \u0432\u0430\u0448\u0438\u043C\u0438 \u0443\u0440\u043E\u043A\u0430\u043C\u0438 (\u043E\u0431\u044B\u0447\u043D\u044B\u0439 .json-\u0444\u0430\u0439\u043B) \u0438\u043B\u0438 \u043D\u0430\u0447\u043D\u0438\u0442\u0435 \u043D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12,
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      kind: "primary",
      onClick: handleOpenProject
    }, "\uD83D\uDCC2 \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0444\u0430\u0439\u043B\u2026"), /*#__PURE__*/React.createElement(Btn, {
      kind: "pastel",
      onClick: handleNewProject
    }, "+ \u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0435\u043A\u0442")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      onClick: () => setSyncModalOpen(true)
    }, "\u2601 ", syncInfo.connected ? "Яндекс.Диск подключён" : "Загрузить проект с Яндекс.Диска"))), syncModalEl);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: outer
  }, /*#__PURE__*/React.createElement(TopBar, {
    tab: tab,
    setTab: goTab,
    projectPath: projectPath,
    onOpen: handleOpenProject,
    onSaveAs: handleSaveAsProject,
    onNew: handleNewProject,
    onBackup: handleBackup,
    onSyncClick: () => setSyncModalOpen(true),
    syncLabel: syncLabel,
    syncStatus: syncStatus,
    data: data
  }), syncModalEl, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "22px 26px 60px",
      maxWidth: 1180,
      margin: "0 auto"
    }
  }, tab === "tags" && /*#__PURE__*/React.createElement(TagsTab, {
    data: data,
    update: update
  }), tab === "bank" && /*#__PURE__*/React.createElement(BankTab, {
    data: data,
    update: update
  }), tab === "theory" && /*#__PURE__*/React.createElement(TheoryTab, {
    data: data,
    update: update
  }), tab === "lessons" && /*#__PURE__*/React.createElement(LessonsTab, {
    data: data,
    update: update,
    activeClass: activeClass,
    setActiveClass: setActiveClass,
    activeLessonId: activeLessonId,
    setActiveLessonId: setActiveLessonId,
    target: lessonTarget,
    setTarget: setLessonTarget,
    letterFilter: lessonsLetterFilter,
    setLetterFilter: setLessonsLetterFilter,
    onBackFromLesson: goBackFromLesson
  }), tab === "calendar" && /*#__PURE__*/React.createElement(CalendarTab, {
    data: data,
    update: update,
    month: calMonth,
    setMonth: setCalMonth,
    view: calView,
    setView: setCalView,
    onOpenLesson: lesson => openLessonFrom("calendar", lesson),
    subTab: calSubTab,
    setSubTab: setCalSubTab,
    filterKey: calFilterKey,
    setFilterKey: setCalFilterKey,
    calLetterFilter: calLetterFilter,
    setCalLetterFilter: setCalLetterFilter,
    journalTrackKey: journalTrackKey,
    setJournalTrackKey: setJournalTrackKey,
    journalLetterFilter: journalLetterFilter,
    setJournalLetterFilter: setJournalLetterFilter,
    classListsTrack: classListsTrack,
    setClassListsTrack: setClassListsTrack,
    classListsSub: classListsSub,
    setClassListsSub: setClassListsSub
  }), tab === "archive" && /*#__PURE__*/React.createElement(ArchiveTab, {
    data: data,
    mode: archiveMode,
    setMode: setArchiveMode,
    openGroup: archiveOpenGroup,
    setOpenGroup: setArchiveOpenGroup,
    onOpenLesson: lesson => openLessonFrom("archive", lesson)
  })));
}
const outer = {
  minHeight: "100vh",
  background: THEME.bg,
  fontFamily: BODY_FONT
};

/* ============================================================
   ВЕРХНЯЯ ПАНЕЛЬ
   ============================================================ */
function TopBar({
  tab,
  setTab,
  projectPath,
  onOpen,
  onSaveAs,
  onNew,
  onBackup,
  onSyncClick,
  syncLabel,
  syncStatus,
  data
}) {
  const fileName = projectPath ? projectPath.split(/[\\/]/).pop() : null;
  const items = [{
    id: "bank",
    label: "Банк упражнений"
  }, {
    id: "lessons",
    label: "Уроки и курсы"
  }, {
    id: "calendar",
    label: "Планирование"
  }];
  const buildEverythingHtml = () => {
    const exBody = data.tags.type.map(t => {
      const exs = data.examples.filter(e => e.typeTagId === t.id);
      if (!exs.length) return "";
      return `<h3>${escapeHtml(t.name)}</h3>${exs.map(ex => exerciseToHtml(ex, data)).join("")}`;
    }).join("");
    const theoryBody = data.theory.map(p => theoryPageToHtml(p)).join("");
    const diagramsBody = data.theory.flatMap(p => p.diagrams || []).map(dg => diagramToHtmlWithImage(dg)).join("");
    return `
      <h2>Упражнения</h2>${exBody || "<div>—</div>"}
      <h2>Теория</h2>${theoryBody || "<div>—</div>"}
      <h2>Карты-схемы</h2>${diagramsBody || "<div>—</div>"}
    `;
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#ffffff",
      borderBottom: `1px solid ${THEME.border}`,
      padding: "18px 26px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "vendor/logo.png",
    alt: "\u041B\u043E\u0433\u043E\u0442\u0438\u043F",
    style: {
      width: 46,
      height: 46,
      borderRadius: "50%",
      boxShadow: `0 0 0 2px ${THEME.border}`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Heading, {
    size: 26
  }, "\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0443\u0440\u043E\u043A\u043E\u0432 \u0440\u0443\u0441\u0441\u043A\u043E\u0433\u043E \u044F\u0437\u044B\u043A\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: THEME.goldDim,
      marginTop: 2
    }
  }, fileName ? `📄 ${fileName}` : "Файл не сохранён"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexShrink: 0,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0439 \u0444\u0430\u0439\u043B \u0441 \u0443\u0440\u043E\u043A\u0430\u043C\u0438",
    onClick: onOpen
  }, "\uD83D\uDCC2 \u041E\u0442\u043A\u0440\u044B\u0442\u044C\u2026"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    title: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u043D\u043E\u0432\u044B\u0439 \u0444\u0430\u0439\u043B",
    onClick: onSaveAs
  }, "\uD83D\uDCBE \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A\u2026"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    title: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u0447\u0435\u0440\u0435\u0437 \u042F\u043D\u0434\u0435\u043A\u0441.\u0414\u0438\u0441\u043A",
    style: {
      color: syncStatus === "conflict" || syncStatus === "error" ? THEME.red : undefined
    },
    onClick: onSyncClick
  }, "\u2601 ", syncLabel), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    title: "\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0444\u0430\u0439\u043B\u0430 \u0441 \u0441\u0435\u0433\u043E\u0434\u043D\u044F\u0448\u043D\u0435\u0439 \u0434\u0430\u0442\u043E\u0439",
    onClick: onBackup
  }, "\u2B73 \u0420\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    title: "\u041D\u0430\u0447\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u043F\u0443\u0441\u0442\u043E\u0439 \u043F\u0440\u043E\u0435\u043A\u0442",
    onClick: onNew
  }, "+ \u041D\u043E\u0432\u044B\u0439"), /*#__PURE__*/React.createElement("span", {
    onClick: () => setTab("tags"),
    title: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432\u0441\u0435\u043C\u0438 \u0442\u0435\u0433\u0430\u043C\u0438",
    style: {
      fontSize: 11,
      color: THEME.goldDim,
      opacity: 0.7,
      cursor: "pointer",
      marginLeft: 4,
      textDecoration: "underline"
    }
  }, "\u2699 \u0442\u0435\u0433\u0438"), /*#__PURE__*/React.createElement("span", {
    onClick: () => setTab("theory"),
    title: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0442\u0435\u043E\u0440\u0438\u0438",
    style: {
      fontSize: 11,
      color: THEME.goldDim,
      opacity: 0.7,
      cursor: "pointer",
      marginLeft: 4,
      textDecoration: "underline"
    }
  }, "\uD83D\uDCD8 \u0442\u0435\u043E\u0440\u0438\u044F"), /*#__PURE__*/React.createElement("span", {
    onClick: () => setTab("archive"),
    title: "\u0410\u0440\u0445\u0438\u0432 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043D\u044B\u0445 \u0443\u0440\u043E\u043A\u043E\u0432",
    style: {
      fontSize: 11,
      color: THEME.goldDim,
      opacity: 0.7,
      cursor: "pointer",
      marginLeft: 4,
      textDecoration: "underline"
    }
  }, "\uD83D\uDDC4 \u0430\u0440\u0445\u0438\u0432"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: THEME.goldDim,
      alignSelf: "center"
    }
  }, "\u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0441\u0451 (\u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F + \u0442\u0435\u043E\u0440\u0438\u044F + \u0441\u0445\u0435\u043C\u044B):"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    onClick: () => downloadWord("vse-materialy", "Все материалы", buildEverythingHtml())
  }, "\uD83D\uDCC4 Word"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    onClick: () => printAsPdf("Все материалы", buildEverythingHtml())
  }, "\uD83D\uDDA8 PDF")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "#E2E7EF",
      padding: 4,
      borderRadius: 11,
      gap: 4,
      marginBottom: 14
    }
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    onClick: () => setTab(it.id),
    style: {
      padding: "9px 18px",
      fontFamily: BODY_FONT,
      fontWeight: 700,
      fontSize: 13.5,
      cursor: "pointer",
      color: tab === it.id ? THEME.bgDark : THEME.goldDim,
      background: tab === it.id ? "#ffffff" : "transparent",
      boxShadow: tab === it.id ? "0 1px 2px rgba(19,44,83,.06), 0 6px 20px rgba(19,44,83,.08)" : "none",
      borderRadius: 8
    }
  }, it.label)))));
}

/* ============================================================
   ВКЛАДКА: ТЕГИ
   ============================================================ */
function TagsTab({
  data,
  update
}) {
  const groups = [{
    key: "type",
    title: "Теги «Тип упражнения»",
    hint: "Используются как категории в банке упражнений."
  }, {
    key: "topic",
    title: "Теги «Тема урока»",
    hint: "Могут создаваться автоматически из примечаний или вручную."
  }, {
    key: "lessonType",
    title: "Теги «Тип урока»",
    hint: "Назначаются самим урокам на странице урока."
  }];
  const addTag = (key, name, color) => {
    if (!name.trim()) return;
    update(d => {
      d.tags[key].push({
        id: uid(),
        name: name.trim(),
        color
      });
      return d;
    });
  };
  const removeTag = (key, id) => {
    update(d => {
      d.tags[key] = d.tags[key].filter(t => t.id !== id);
      if (key === "type") d.examples = d.examples.filter(ex => ex.typeTagId !== id);
      if (key === "topic") {
        d.examples.forEach(ex => ex.topicTagIds = ex.topicTagIds.filter(t => t !== id));
        d.lessons.forEach(l => l.topicTagIds = (l.topicTagIds || []).filter(t => t !== id));
      }
      if (key === "lessonType") {
        d.lessons.forEach(l => l.lessonTypeTagIds = (l.lessonTypeTagIds || []).filter(t => t !== id));
      }
      return d;
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 22
    }
  }, groups.map(g => /*#__PURE__*/React.createElement(TagGroup, {
    key: g.key,
    group: g,
    tags: data.tags[g.key],
    onAdd: addTag,
    onRemove: removeTag
  })));
}
function TagGroup({
  group,
  tags,
  onAdd,
  onRemove
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  return /*#__PURE__*/React.createElement("div", {
    style: panelStyle
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: THEME.panelText,
      marginBottom: 2
    }
  }, group.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#5a6b7d",
      marginBottom: 12
    }
  }, group.hint), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14
    }
  }, tags.length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#8593a3"
    }
  }, "\u0422\u0435\u0433\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442."), tags.map(t => /*#__PURE__*/React.createElement(Badge, {
    key: t.id,
    tag: t,
    onRemove: () => onRemove(group.key, t.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0433\u043E \u0442\u0435\u0433\u0430",
    style: {
      ...inputStyle,
      maxWidth: 240
    },
    onKeyDown: e => {
      if (e.key === "Enter") {
        onAdd(group.key, name, color);
        setName("");
      }
    }
  }), /*#__PURE__*/React.createElement(ColorPicker, {
    value: color,
    onChange: setColor
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => {
      onAdd(group.key, name, color);
      setName("");
    }
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0442\u0435\u0433")));
}
const panelStyle = {
  background: THEME.panel,
  color: THEME.panelText,
  borderRadius: 14,
  padding: "18px 20px",
  border: `1px solid ${THEME.border}`,
  boxShadow: "0 1px 2px rgba(19,44,83,.06), 0 6px 20px rgba(19,44,83,.08)"
};

/* ============================================================
   АРХИВ: пройденные уроки, с просмотром по классам, темам и типам урока
   ============================================================ */
function ArchiveTab({
  data,
  onOpenLesson,
  mode,
  setMode,
  openGroup,
  setOpenGroup
}) {
  // mode ("class" | "topic" | "type") и openGroup хранятся на уровне приложения — после
  // открытия урока и «Назад» архив остаётся в том же режиме и на той же группе.

  const completedLessons = data.lessons.filter(l => l.completed);
  let groups = [];
  if (mode === "class") {
    groups = allTracks(data).map(t => ({
      key: trackKeyOf(t.kind, t.value),
      label: t.label,
      lessons: completedLessons.filter(l => trackKeyOf(l) === trackKeyOf(t.kind, t.value))
    })).filter(g => g.lessons.length > 0);
  } else if (mode === "topic") {
    const byTag = {};
    completedLessons.forEach(l => {
      const ids = (l.topicTagIds || []).length ? l.topicTagIds : ["__none__"];
      ids.forEach(tid => {
        byTag[tid] = byTag[tid] || [];
        byTag[tid].push(l);
      });
    });
    groups = Object.entries(byTag).map(([tid, lessons]) => ({
      key: tid,
      label: tid === "__none__" ? "Без темы" : data.tags.topic.find(t => t.id === tid)?.name || "?",
      lessons
    }));
  } else {
    const byType = {};
    completedLessons.forEach(l => {
      const ids = (l.lessonTypeTagIds || []).length ? l.lessonTypeTagIds : ["__none__"];
      ids.forEach(tid => {
        byType[tid] = byType[tid] || [];
        byType[tid].push(l);
      });
    });
    groups = Object.entries(byType).map(([tid, lessons]) => ({
      key: tid,
      label: tid === "__none__" ? "Без типа урока" : data.tags.lessonType.find(t => t.id === tid)?.name || "?",
      lessons
    }));
  }
  groups.sort((a, b) => b.lessons.length - a.lessons.length);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 22,
    style: {
      color: THEME.panelText
    }
  }, "\u0410\u0440\u0445\u0438\u0432 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043D\u044B\u0445 \u0443\u0440\u043E\u043A\u043E\u0432"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.goldDim
    }
  }, "\u0412\u0441\u0435\u0433\u043E \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043E: ", completedLessons.length), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "#E2E7EF",
      padding: 4,
      borderRadius: 11,
      gap: 4,
      width: "fit-content"
    }
  }, [{
    id: "class",
    label: "По классам/курсам"
  }, {
    id: "topic",
    label: "По темам"
  }, {
    id: "type",
    label: "По типу урока"
  }].map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    onClick: () => {
      setMode(it.id);
      setOpenGroup(null);
    },
    style: {
      padding: "9px 16px",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 13,
      fontFamily: BODY_FONT,
      color: mode === it.id ? THEME.bgDark : THEME.goldDim,
      background: mode === it.id ? "#ffffff" : "transparent",
      boxShadow: mode === it.id ? "0 1px 2px rgba(19,44,83,.06), 0 6px 20px rgba(19,44,83,.08)" : "none"
    }
  }, it.label))), groups.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      textAlign: "center",
      padding: 40
    }
  }, "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043D\u043E\u0433\u043E \u0443\u0440\u043E\u043A\u0430.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10
    }
  }, groups.map(g => /*#__PURE__*/React.createElement(CollapsiblePanel, {
    key: g.key,
    title: g.label,
    count: g.lessons.length,
    open: openGroup === g.key,
    onToggle: () => setOpenGroup(openGroup === g.key ? null : g.key)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, g.lessons.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    onClick: () => onOpenLesson(l),
    className: "lc-row",
    style: {
      ...cardStyle,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13.5
    }
  }, l.topic || "Без темы"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#7a8a9c"
    }
  }, lessonPlaceLabel(l, data), l.actualDate ? ` · пройден: ${formatDateRu(l.actualDate)}` : l.plannedDate ? ` · план: ${formatDateRu(l.plannedDate)}` : ""))))))));
}

/* ============================================================
   ВКЛАДКА: БАНК УПРАЖНЕНИЙ
   ============================================================ */
function BankTab({
  data,
  update
}) {
  const [openType, setOpenType] = useState(null);
  const [addingType, setAddingType] = useState(null); // categoryId, "__none__" (без категории), или null
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeColor, setNewTypeColor] = useState(SWATCHES[0]);
  const [dragTypeId, setDragTypeId] = useState(null);
  const [dragExampleId, setDragExampleId] = useState(null);
  const [dragCategoryId, setDragCategoryId] = useState(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(SWATCHES[0]);
  const [editingCategoryColor, setEditingCategoryColor] = useState(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [newSlotName, setNewSlotName] = useState("");
  const [formSlotId, setFormSlotId] = useState(undefined); // slotId для формы "+ добавить пример" (undefined = форма закрыта)
  const [editingTypeColor, setEditingTypeColor] = useState(false);
  const importExerciseFileRef = useRef(null);
  const importExerciseFile = async file => {
    let payload;
    try {
      payload = JSON.parse(await readTextFile(file));
    } catch (e) {
      alert("Не удалось прочитать файл — это не корректный JSON.");
      return;
    }
    if (!payload || payload.type !== "literature-constructor-exercise") {
      alert("Файл не похож на экспортированное упражнение.");
      return;
    }
    update(d => {
      importExerciseData(d, payload);
      return d;
    });
    alert("Упражнение импортировано.");
  };
  const addExample = (typeTagId, ex, slotId) => {
    update(d => {
      d.examples.push({
        id: uid(),
        typeTagId,
        text: ex.text,
        note: ex.note,
        topicTagIds: ex.topicTagIds,
        redNote: ex.redNote,
        attachments: ex.attachments,
        slotId: slotId || null,
        richMigrated: true
      });
      return d;
    });
  };
  const updateExample = (id, patch) => {
    update(d => {
      const ex = d.examples.find(e => e.id === id);
      Object.assign(ex, patch);
      return d;
    });
  };
  const deleteExample = id => {
    update(d => {
      d.examples = d.examples.filter(e => e.id !== id);
      d.lessons.forEach(l => {
        l.items = (l.items || []).filter(it => !(it.type === "exercise" && it.refId === id));
      });
      return d;
    });
  };
  const ensureTopicTag = name => {
    let tag = data.tags.topic.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (tag) return tag.id;
    const id = uid();
    update(d => {
      d.tags.topic.push({
        id,
        name,
        color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)]
      });
      return d;
    });
    return id;
  };
  const addTypeTag = categoryId => {
    if (!newTypeName.trim()) return;
    const id = uid();
    update(d => {
      const order = d.tags.type.length ? Math.max(...d.tags.type.map(t => t.order || 0)) + 1 : 0;
      d.tags.type.push({
        id,
        name: newTypeName.trim(),
        color: newTypeColor,
        categoryId: categoryId || null,
        order
      });
      if (categoryId) recomputeCategoryShades(d, categoryId);
      return d;
    });
    setNewTypeName("");
    setNewTypeColor(SWATCHES[0]);
    setAddingType(null);
    setOpenType(id);
  };

  // Перемещает тег в другую категорию (или в "без категории"), при необходимости
  // ставит его перед конкретным тегом-целью, и пересчитывает оттенки обеих категорий.
  const moveTypeToCategory = (tagId, categoryId, beforeTagId) => {
    update(d => {
      const tag = d.tags.type.find(t => t.id === tagId);
      if (!tag) return d;
      const oldCategoryId = tag.categoryId || null;
      const newCategoryId = categoryId || null;
      tag.categoryId = newCategoryId;
      const destGroup = d.tags.type.filter(t => (t.categoryId || null) === newCategoryId && t.id !== tagId).sort((a, b) => (a.order || 0) - (b.order || 0));
      let insertAt = destGroup.length;
      if (beforeTagId) {
        const idx = destGroup.findIndex(t => t.id === beforeTagId);
        if (idx !== -1) insertAt = idx;
      }
      destGroup.splice(insertAt, 0, tag);
      destGroup.forEach((t, idx) => {
        d.tags.type.find(x => x.id === t.id).order = idx;
      });
      if (oldCategoryId !== newCategoryId) {
        const srcGroup = d.tags.type.filter(t => (t.categoryId || null) === oldCategoryId).sort((a, b) => (a.order || 0) - (b.order || 0));
        srcGroup.forEach((t, idx) => {
          d.tags.type.find(x => x.id === t.id).order = idx;
        });
        if (oldCategoryId) recomputeCategoryShades(d, oldCategoryId);
      }
      if (newCategoryId) recomputeCategoryShades(d, newCategoryId);
      return d;
    });
  };
  const reorderCategory = (draggedId, targetId) => {
    if (draggedId === targetId) return;
    update(d => {
      const sorted = [...d.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
      const fromIdx = sorted.findIndex(c => c.id === draggedId);
      const toIdx = sorted.findIndex(c => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return d;
      const [moved] = sorted.splice(fromIdx, 1);
      sorted.splice(toIdx, 0, moved);
      sorted.forEach((c, idx) => {
        d.categories.find(x => x.id === c.id).order = idx;
      });
      return d;
    });
  };
  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    update(d => {
      d.categories.push({
        id: uid(),
        name: newCategoryName.trim(),
        color: newCategoryColor,
        order: d.categories.length
      });
      return d;
    });
    setNewCategoryName("");
    setNewCategoryColor(SWATCHES[0]);
    setAddingCategory(false);
  };
  const setCategoryColor = (categoryId, color) => {
    update(d => {
      const cat = d.categories.find(c => c.id === categoryId);
      cat.color = color;
      recomputeCategoryShades(d, categoryId);
      return d;
    });
  };

  // Ручной выбор цвета для конкретного упражнения — перестаёт участвовать
  // в автоматическом пересчёте оттенков категории, пока цвет не сбросят.
  const setTypeColor = (id, color) => {
    update(d => {
      const t = d.tags.type.find(x => x.id === id);
      t.color = color;
      t.customColor = true;
      return d;
    });
  };
  const resetTypeColor = id => {
    update(d => {
      const t = d.tags.type.find(x => x.id === id);
      t.customColor = false;
      if (t.categoryId) recomputeCategoryShades(d, t.categoryId);
      return d;
    });
  };
  const deleteTypeTag = id => {
    const exCount = data.examples.filter(e => e.typeTagId === id).length;
    const msg = exCount > 0 ? `Удалить этот вид упражнения вместе со всеми его примерами (${exCount})? Они также пропадут из уроков, где использовались.` : "Удалить этот вид упражнения?";
    if (!window.confirm(msg)) return;
    update(d => {
      const removed = d.tags.type.find(t => t.id === id);
      const exIds = d.examples.filter(e => e.typeTagId === id).map(e => e.id);
      d.examples = d.examples.filter(e => e.typeTagId !== id);
      d.lessons.forEach(l => {
        l.items = (l.items || []).filter(it => !(it.type === "exercise" && exIds.includes(it.refId)));
      });
      d.tags.type = d.tags.type.filter(t => t.id !== id);
      if (removed?.categoryId) recomputeCategoryShades(d, removed.categoryId);
      return d;
    });
    setOpenType(null);
  };

  // Слоты — способ упорядочить упражнения ВНУТРИ одного вида (например, "Цепочка"),
  // чисто для удобства просмотра в банке; на уроки никак не влияет.
  const addSlot = typeId => {
    if (!newSlotName.trim()) return;
    update(d => {
      const t = d.tags.type.find(x => x.id === typeId);
      t.slots = t.slots || [];
      t.slots.push({
        id: uid(),
        name: newSlotName.trim(),
        order: t.slots.length
      });
      return d;
    });
    setNewSlotName("");
    setAddingSlot(false);
  };
  const deleteSlot = (typeId, slotId) => {
    if (!window.confirm("Удалить слот? Упражнения из него не удалятся, просто станут «без слота».")) return;
    update(d => {
      const t = d.tags.type.find(x => x.id === typeId);
      t.slots = (t.slots || []).filter(s => s.id !== slotId);
      d.examples.forEach(ex => {
        if (ex.typeTagId === typeId && ex.slotId === slotId) ex.slotId = null;
      });
      return d;
    });
  };
  const exportAllWord = () => {
    const body = data.tags.type.map(t => {
      const exs = data.examples.filter(e => e.typeTagId === t.id);
      if (!exs.length) return "";
      return `<h2>${escapeHtml(t.name)}</h2>${exs.map(ex => exerciseToHtml(ex, data)).join("")}`;
    }).join("");
    downloadWord("vse-uprazhneniya", "Все упражнения", body || "<div>Пока пусто</div>");
  };
  const exportAllPdf = () => {
    const body = data.tags.type.map(t => {
      const exs = data.examples.filter(e => e.typeTagId === t.id);
      if (!exs.length) return "";
      return `<h2>${escapeHtml(t.name)}</h2>${exs.map(ex => exerciseToHtml(ex, data)).join("")}`;
    }).join("");
    printAsPdf("Все упражнения", body || "<div>Пока пусто</div>");
  };
  const addExerciseToChosenLesson = (exId, lessonId) => {
    update(d => {
      const l = d.lessons.find(x => x.id === lessonId);
      if (!l) return d;
      l.items = l.items || [];
      if (!l.items.some(it => it.type === "exercise" && it.refId === exId)) {
        l.items.push({
          id: uid(),
          type: "exercise",
          refId: exId
        });
      }
      return d;
    });
  };
  const openTypeTag = data.tags.type.find(t => t.id === openType);

  // ===== Страница конкретного типа упражнения =====
  if (openTypeTag) {
    const examples = data.examples.filter(e => e.typeTagId === openTypeTag.id);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: panelStyle
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
        flexWrap: "wrap",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => setOpenType(null)
    }, "\u2190 \u041D\u0430\u0437\u0430\u0434"), /*#__PURE__*/React.createElement(Badge, {
      tag: openTypeTag
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "#5a6b7d"
      }
    }, examples.length, " \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0439"), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => setEditingTypeColor(!editingTypeColor)
    }, "\uD83C\uDFA8 \u0421\u0432\u043E\u0439 \u0446\u0432\u0435\u0442"), openTypeTag.customColor && openTypeTag.categoryId && /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => resetTypeColor(openTypeTag.id)
    }, "\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u043C"), /*#__PURE__*/React.createElement("select", {
      value: openTypeTag.categoryId || "",
      onChange: e => moveTypeToCategory(openTypeTag.id, e.target.value || null, null),
      style: {
        ...toolSelectStyle,
        fontSize: 11.5
      },
      title: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F"
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "\u0411\u0435\u0437 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438"), [...data.categories].sort((a, b) => (a.order || 0) - (b.order || 0)).map(c => /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: c.id
    }, c.name))), /*#__PURE__*/React.createElement(Btn, {
      kind: "danger",
      small: true,
      onClick: () => deleteTypeTag(openTypeTag.id)
    }, "\uD83D\uDDD1 \u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0438\u0434"))), editingTypeColor && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement(ColorPicker, {
      value: openTypeTag.color,
      onChange: c => setTypeColor(openTypeTag.id, c)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#7a8a9c",
        marginTop: 4
      }
    }, openTypeTag.categoryId ? "Пока задан свой цвет, автоматический пересчёт оттенков категории его не тронет." : "")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: "#7a8a9c"
      }
    }, "\u0421\u043B\u043E\u0442\u044B (\u0434\u043B\u044F \u043F\u043E\u0440\u044F\u0434\u043A\u0430 \u0432\u043D\u0443\u0442\u0440\u0438 \u0432\u0438\u0434\u0430, \u043D\u0430 \u0443\u0440\u043E\u043A\u0438 \u043D\u0435 \u0432\u043B\u0438\u044F\u044E\u0442):"), !addingSlot ? /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px dashed #9bb6c9"
      },
      onClick: () => setAddingSlot(true)
    }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u043B\u043E\u0442") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
      autoFocus: true,
      style: {
        ...inputStyle,
        maxWidth: 160,
        padding: "5px 8px",
        fontSize: 12
      },
      placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0441\u043B\u043E\u0442\u0430",
      value: newSlotName,
      onChange: e => setNewSlotName(e.target.value),
      onKeyDown: e => e.key === "Enter" && addSlot(openTypeTag.id)
    }), /*#__PURE__*/React.createElement(Btn, {
      kind: "pastel",
      small: true,
      onClick: () => addSlot(openTypeTag.id)
    }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => setAddingSlot(false)
    }, "\u041E\u0442\u043C\u0435\u043D\u0430"))), (openTypeTag.slots || []).length === 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))",
        gap: 10
      }
    }, examples.map(ex => /*#__PURE__*/React.createElement(ExampleCard, {
      key: ex.id,
      ex: ex,
      data: data,
      onUpdate: patch => updateExample(ex.id, patch),
      onDelete: () => deleteExample(ex.id),
      ensureTopicTag: ensureTopicTag,
      onAddToLesson: lessonId => addExerciseToChosenLesson(ex.id, lessonId)
    }))), formSlotId === null ? /*#__PURE__*/React.createElement(ExampleForm, {
      data: data,
      ensureTopicTag: ensureTopicTag,
      onCancel: () => setFormSlotId(undefined),
      onSave: ex => {
        addExample(openTypeTag.id, ex, null);
        setFormSlotId(undefined);
      }
    }) : /*#__PURE__*/React.createElement(Btn, {
      kind: "pastel",
      small: true,
      style: {
        marginTop: 14
      },
      onClick: () => setFormSlotId(null)
    }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0438\u043C\u0435\u0440 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F")) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#8593a3"
      }
    }, "\u0413\u043E\u0442\u043E\u0432\u044B\u0435 \u043F\u0440\u0438\u043C\u0435\u0440\u044B \u043C\u043E\u0436\u043D\u043E \u043F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u044C \u043C\u044B\u0448\u044C\u044E \u0438\u0437 \u043E\u0434\u043D\u043E\u0433\u043E \u0441\u043B\u043E\u0442\u0430 \u0432 \u0434\u0440\u0443\u0433\u043E\u0439."), [...openTypeTag.slots].sort((a, b) => (a.order || 0) - (b.order || 0)).map(slot => {
      const slotExamples = examples.filter(ex => ex.slotId === slot.id);
      return /*#__PURE__*/React.createElement("div", {
        key: slot.id,
        onDragOver: e => e.preventDefault(),
        onDrop: e => {
          e.preventDefault();
          if (dragExampleId) updateExample(dragExampleId, {
            slotId: slot.id
          });
          setDragExampleId(null);
        },
        style: {
          borderRadius: 10,
          padding: 6,
          border: "1.5px dashed transparent"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12.5,
          fontWeight: 700,
          color: "#5a6b7d"
        }
      }, slot.name), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          color: "#8593a3"
        }
      }, "(", slotExamples.length, ")"), /*#__PURE__*/React.createElement("span", {
        onClick: () => deleteSlot(openTypeTag.id, slot.id),
        style: {
          color: THEME.red,
          fontWeight: 900,
          fontSize: 13,
          cursor: "pointer"
        }
      }, "\xD7")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))",
          gap: 10,
          minHeight: 40
        }
      }, slotExamples.map(ex => /*#__PURE__*/React.createElement(ExampleCard, {
        key: ex.id,
        ex: ex,
        data: data,
        onUpdate: patch => updateExample(ex.id, patch),
        onDelete: () => deleteExample(ex.id),
        ensureTopicTag: ensureTopicTag,
        onAddToLesson: lessonId => addExerciseToChosenLesson(ex.id, lessonId),
        onDragStartExample: setDragExampleId
      }))), formSlotId === slot.id ? /*#__PURE__*/React.createElement(ExampleForm, {
        data: data,
        ensureTopicTag: ensureTopicTag,
        onCancel: () => setFormSlotId(undefined),
        onSave: ex => {
          addExample(openTypeTag.id, ex, slot.id);
          setFormSlotId(undefined);
        }
      }) : /*#__PURE__*/React.createElement(Btn, {
        kind: "ghost",
        small: true,
        style: {
          marginTop: 8,
          color: "#12233a",
          border: "1.5px dashed #9bb6c9"
        },
        onClick: () => setFormSlotId(slot.id)
      }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0438\u043C\u0435\u0440"));
    }), /*#__PURE__*/React.createElement("div", {
      onDragOver: e => e.preventDefault(),
      onDrop: e => {
        e.preventDefault();
        if (dragExampleId) updateExample(dragExampleId, {
          slotId: null
        });
        setDragExampleId(null);
      },
      style: {
        borderRadius: 10,
        padding: 6,
        border: "1.5px dashed transparent"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: "#5a6b7d",
        marginBottom: 8
      }
    }, "\u0411\u0435\u0437 \u0441\u043B\u043E\u0442\u0430"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))",
        gap: 10,
        minHeight: 40
      }
    }, examples.filter(ex => !ex.slotId).map(ex => /*#__PURE__*/React.createElement(ExampleCard, {
      key: ex.id,
      ex: ex,
      data: data,
      onUpdate: patch => updateExample(ex.id, patch),
      onDelete: () => deleteExample(ex.id),
      ensureTopicTag: ensureTopicTag,
      onAddToLesson: lessonId => addExerciseToChosenLesson(ex.id, lessonId),
      onDragStartExample: setDragExampleId
    }))), formSlotId === null ? /*#__PURE__*/React.createElement(ExampleForm, {
      data: data,
      ensureTopicTag: ensureTopicTag,
      onCancel: () => setFormSlotId(undefined),
      onSave: ex => {
        addExample(openTypeTag.id, ex, null);
        setFormSlotId(undefined);
      }
    }) : /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        marginTop: 8,
        color: "#12233a",
        border: "1.5px dashed #9bb6c9"
      },
      onClick: () => setFormSlotId(null)
    }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0438\u043C\u0435\u0440")))));
  }

  // ===== Плитки с типами упражнений, сгруппированные по категориям =====
  const sortedCategories = [...data.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
  const uncategorized = data.tags.type.filter(t => !t.categoryId).sort((a, b) => (a.order || 0) - (b.order || 0));
  const renderTile = (typeTag, categoryId) => {
    const count = data.examples.filter(e => e.typeTagId === typeTag.id).length;
    return /*#__PURE__*/React.createElement("div", {
      key: typeTag.id,
      className: "lc-row",
      draggable: true,
      onDragStart: e => {
        e.stopPropagation();
        setDragTypeId(typeTag.id);
      },
      onDragOver: e => e.preventDefault(),
      onDrop: e => {
        e.preventDefault();
        e.stopPropagation();
        if (dragTypeId) moveTypeToCategory(dragTypeId, categoryId, typeTag.id);
        setDragTypeId(null);
      },
      onClick: () => setOpenType(typeTag.id),
      style: {
        ...cardStyle,
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 76,
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tag: typeTag
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: "#7a8a9c"
      }
    }, count, " \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0439"));
  };
  const renderAddTile = categoryId => {
    const key = categoryId || "__none__";
    if (addingType !== key) {
      return /*#__PURE__*/React.createElement("div", {
        className: "lc-row",
        onClick: () => {
          setAddingType(key);
          setNewTypeName("");
          setNewTypeColor(SWATCHES[0]);
        },
        style: {
          ...cardStyle,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 76,
          border: "1.5px dashed #9bb6c9",
          color: "#5a6b7d",
          fontWeight: 700,
          fontSize: 13
        }
      }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0438\u0434 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F");
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...cardStyle,
        minHeight: 76,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement("input", {
      autoFocus: true,
      style: {
        ...inputStyle,
        fontSize: 12.5,
        padding: "6px 8px"
      },
      placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u0438\u0434\u0430",
      value: newTypeName,
      onChange: e => setNewTypeName(e.target.value),
      onKeyDown: e => e.key === "Enter" && addTypeTag(categoryId)
    }), !categoryId && /*#__PURE__*/React.createElement(ColorPicker, {
      value: newTypeColor,
      onChange: setNewTypeColor
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      kind: "pastel",
      small: true,
      onClick: () => addTypeTag(categoryId)
    }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => setAddingType(null)
    }, "\u041E\u0442\u043C\u0435\u043D\u0430")));
  };
  const renderCategorySection = cat => {
    const tags = data.tags.type.filter(t => t.categoryId === cat.id).sort((a, b) => (a.order || 0) - (b.order || 0));
    return /*#__PURE__*/React.createElement("div", {
      key: cat.id,
      onDragOver: e => e.preventDefault(),
      onDrop: e => {
        e.preventDefault();
        if (dragTypeId) moveTypeToCategory(dragTypeId, cat.id, null);
        setDragTypeId(null);
      }
    }, /*#__PURE__*/React.createElement("div", {
      draggable: true,
      onDragStart: () => setDragCategoryId(cat.id),
      onDragOver: e => e.preventDefault(),
      onDrop: e => {
        e.preventDefault();
        e.stopPropagation();
        if (dragCategoryId) reorderCategory(dragCategoryId, cat.id);
        setDragCategoryId(null);
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
        cursor: "grab"
      },
      title: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439"
    }, /*#__PURE__*/React.createElement("span", {
      onClick: e => {
        e.stopPropagation();
        setEditingCategoryColor(editingCategoryColor === cat.id ? null : cat.id);
      },
      style: {
        width: 11,
        height: 11,
        borderRadius: "50%",
        background: cat.color,
        display: "inline-block",
        cursor: "pointer",
        boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${THEME.border}`
      },
      title: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0446\u0432\u0435\u0442 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: THEME.goldDim
      }
    }, cat.name)), editingCategoryColor === cat.id && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(ColorPicker, {
      value: cat.color,
      onChange: c => setCategoryColor(cat.id, c)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
        gap: 12
      }
    }, tags.map(t => renderTile(t, cat.id)), renderAddTile(cat.id)));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 20
    }
  }, data.tags.type.length === 0 && addingType === null && /*#__PURE__*/React.createElement("div", {
    style: panelStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14
    }
  }, "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0432\u0438\u0434\u0430 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F \u2014 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u043D\u0438\u0436\u0435.")), sortedCategories.map(renderCategorySection), /*#__PURE__*/React.createElement("div", {
    onDragOver: e => e.preventDefault(),
    onDrop: e => {
      e.preventDefault();
      if (dragTypeId) moveTypeToCategory(dragTypeId, null, null);
      setDragTypeId(null);
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: "50%",
      background: "#9bb6c9",
      display: "inline-block"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: THEME.goldDim
    }
  }, "\u0411\u0435\u0437 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
      gap: 12
    }
  }, uncategorized.map(t => renderTile(t, null)), renderAddTile(null))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: THEME.goldDim,
      marginBottom: 8
    }
  }, "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
      gap: 12
    }
  }, !addingCategory ? /*#__PURE__*/React.createElement("div", {
    className: "lc-row",
    onClick: () => setAddingCategory(true),
    style: {
      ...cardStyle,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 76,
      border: "1.5px dashed #9bb6c9",
      color: "#5a6b7d",
      fontWeight: 700,
      fontSize: 13
    }
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E") : /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      minHeight: 76,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    style: {
      ...inputStyle,
      fontSize: 12.5,
      padding: "6px 8px"
    },
    placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438",
    value: newCategoryName,
    onChange: e => setNewCategoryName(e.target.value),
    onKeyDown: e => e.key === "Enter" && addCategory()
  }), /*#__PURE__*/React.createElement(ColorPicker, {
    value: newCategoryColor,
    onChange: setNewCategoryColor
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addCategory
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setAddingCategory(false)
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => importExerciseFileRef.current?.click()
  }, "\u2B06 \u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435"), /*#__PURE__*/React.createElement("input", {
    ref: importExerciseFileRef,
    type: "file",
    accept: ".json,application/json",
    style: {
      display: "none"
    },
    onChange: e => {
      const file = e.target.files?.[0];
      if (file) importExerciseFile(file);
      e.target.value = "";
    }
  }), /*#__PURE__*/React.createElement(ExportButtons, {
    onWord: exportAllWord,
    onPdf: exportAllPdf,
    label: "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432\u0441\u0435\u0433\u043E \u0431\u0430\u043D\u043A\u0430:"
  })));
}
function ExampleCard({
  ex,
  data,
  onUpdate,
  onDelete,
  ensureTopicTag,
  onAddToLesson,
  onDragStartExample
}) {
  const [peekOpen, setPeekOpen] = useState(false);
  const usedIn = data.lessons.filter(l => (l.items || []).some(it => it.type === "exercise" && it.refId === ex.id));
  const topicTags = ex.topicTagIds.map(id => data.tags.topic.find(t => t.id === id)).filter(Boolean);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lc-row",
    onClick: () => setPeekOpen(true),
    draggable: !!onDragStartExample,
    onDragStart: onDragStartExample ? () => onDragStartExample(ex.id) : undefined,
    title: onDragStartExample ? "Можно перетащить в другой слот" : undefined,
    style: {
      ...cardStyle,
      cursor: onDragStartExample ? "grab" : "pointer",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      minHeight: 88
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      minHeight: 18,
      flexWrap: "wrap",
      maxWidth: "100%"
    }
  }, topicTags.slice(0, 2).map(t => /*#__PURE__*/React.createElement("span", {
    key: t.id,
    style: {
      maxWidth: "100%",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tag: t
  }))), ex.redNote && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: THEME.red,
      marginLeft: "auto"
    },
    title: ex.redNote
  }, "\u2691"), usedIn.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: "#1b5e20",
      marginLeft: ex.redNote ? 4 : "auto"
    },
    title: usedIn.map(l => lessonLabel(l, data)).join(", ")
  }, "\u2713 ", usedIn.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13.5,
      whiteSpace: "pre-wrap",
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    }
  }, stripHtml(ex.text) || /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#9aa7b3",
      fontWeight: 400
    }
  }, "\u0411\u0435\u0437 \u0442\u0435\u043A\u0441\u0442\u0430"))), peekOpen && /*#__PURE__*/React.createElement(ExercisePeekModal, {
    ex: ex,
    data: data,
    usedIn: usedIn,
    topicTags: topicTags,
    ensureTopicTag: ensureTopicTag,
    onUpdate: onUpdate,
    onDelete: () => {
      onDelete();
      setPeekOpen(false);
    },
    onAddToLesson: onAddToLesson,
    onClose: () => setPeekOpen(false)
  }));
}
function ExercisePeekModal({
  ex,
  data,
  usedIn,
  topicTags,
  ensureTopicTag,
  onUpdate,
  onDelete,
  onAddToLesson,
  onClose,
  removeLabel,
  onRemove
}) {
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addGroup, setAddGroup] = useState("");
  const [addLessonId, setAddLessonId] = useState("");
  const lessonsInGroup = addGroup ? data.lessons.filter(l => {
    const [kind, val] = addGroup.split(":");
    return kind === "class" ? l.class === val && !l.courseId : l.courseId === val;
  }).sort((a, b) => a.order - b.order) : [];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 14,
      padding: 20,
      width: "min(560px, 95vw)",
      maxHeight: "88vh",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: "#12233a"
    }
  }, "\u0423\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C")), editing ? /*#__PURE__*/React.createElement(ExampleForm, {
    data: data,
    initial: ex,
    ensureTopicTag: ensureTopicTag,
    onCancel: () => setEditing(false),
    onSave: patch => {
      onUpdate(patch);
      setEditing(false);
    }
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 15,
      marginBottom: 10
    },
    dangerouslySetInnerHTML: {
      __html: ex.text
    }
  }), ex.note && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "#3d4c5e",
      whiteSpace: "pre-wrap",
      marginBottom: 10
    }
  }, ex.note), topicTags.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 5,
      marginBottom: 10
    }
  }, topicTags.map(t => /*#__PURE__*/React.createElement(Badge, {
    key: t.id,
    tag: t
  }))), ex.redNote && /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.redBg,
      color: THEME.red,
      fontWeight: 700,
      fontSize: 12.5,
      padding: "6px 10px",
      borderRadius: 8,
      marginBottom: 10
    }
  }, "\u2691 ", ex.redNote), ex.attachments?.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(AttachmentThumbs, {
    attachments: ex.attachments
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: usedIn.length ? "#1b5e20" : "#8593a3",
      marginBottom: 16
    }
  }, usedIn.length > 0 ? `Используется в уроках: ${usedIn.map(l => lessonLabel(l, data)).join(", ")}` : "Пока не используется ни в одном уроке"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    onClick: () => setEditing(true),
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    }
  }, "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C"), onRemove ? /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: onRemove
  }, removeLabel || "Убрать") : /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: onDelete
  }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setAddOpen(!addOpen)
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u0443\u0440\u043E\u043A"), /*#__PURE__*/React.createElement(ExportButtons, {
    labeled: true,
    onWord: () => downloadWord(stripHtml(ex.text).slice(0, 30) || "uprazhnenie", stripHtml(ex.text).slice(0, 60), exerciseToHtml(ex, data)),
    onPdf: () => printAsPdf(stripHtml(ex.text).slice(0, 60), exerciseToHtml(ex, data))
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => downloadJson(sanitizeFileName(stripHtml(ex.text).slice(0, 40) || "uprazhnenie"), {
      type: "literature-constructor-exercise",
      version: 1,
      exportedAt: new Date().toISOString(),
      ...exerciseExportData(ex, data)
    })
  }, "\uD83D\uDCE4 \u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432 \u0444\u0430\u0439\u043B")), addOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: addGroup,
    onChange: e => {
      setAddGroup(e.target.value);
      setAddLessonId("");
    },
    style: {
      ...toolSelectStyle,
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u041A\u043B\u0430\u0441\u0441 \u0438\u043B\u0438 \u043A\u0443\u0440\u0441\u2026"), CLASSES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: `class:${c}`
  }, c, " \u043A\u043B\u0430\u0441\u0441")), data.courses.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: `course:${c.id}`
  }, c.name))), /*#__PURE__*/React.createElement("select", {
    value: addLessonId,
    onChange: e => setAddLessonId(e.target.value),
    disabled: !addGroup,
    style: {
      ...toolSelectStyle,
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, addGroup ? "Урок…" : "Сначала выберите класс/курс"), lessonsInGroup.map(l => /*#__PURE__*/React.createElement("option", {
    key: l.id,
    value: l.id
  }, l.topic || "Без темы"))), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    disabled: !addLessonId,
    onClick: () => {
      onAddToLesson(addLessonId);
      setAddOpen(false);
      setAddGroup("");
      setAddLessonId("");
    }
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C")))));
}
function lessonLabel(l, data) {
  const course = data.courses.find(c => c.id === l.courseId);
  const place = course ? course.name : `${l.class} класс`;
  return `«${l.topic || "без темы"}» (${place})`;
}
const cardStyle = {
  background: THEME.card,
  color: THEME.panelText,
  borderRadius: 8,
  padding: "10px 12px",
  border: `1px solid ${THEME.border}`
};
const rowClass = "lc-row";
const revealClass = "lc-reveal";
function ExampleForm({
  data,
  initial,
  onSave,
  onCancel,
  ensureTopicTag
}) {
  const [text, setText] = useState(initial?.text || "");
  const [note, setNote] = useState(initial?.note || "");
  const [redNote, setRedNote] = useState(initial?.redNote || "");
  const [topicIds, setTopicIds] = useState(initial?.topicTagIds || []);
  const [attachments, setAttachments] = useState(initial?.attachments || []);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const fileRef = useRef(null);
  const editorRef = useRef(null);
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initial?.text || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const saveText = () => setText(editorRef.current.innerHTML);
  const exec = (cmd, value) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    saveText();
  };
  const execHighlight = color => {
    editorRef.current?.focus();
    const ok = document.execCommand("hiliteColor", false, color);
    if (!ok) document.execCommand("backColor", false, color);
    saveText();
  };
  const toggleTopic = id => {
    setTopicIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleFiles = async files => {
    const list = Array.from(files);
    const added = [];
    for (const f of list) {
      if (f.type.startsWith("image/")) {
        const dataUrl = await resizeImage(f);
        added.push({
          id: uid(),
          name: f.name,
          kind: "image",
          dataUrl
        });
      } else {
        added.push({
          id: uid(),
          name: f.name,
          kind: "file",
          url: ""
        });
      }
    }
    setAttachments(prev => [...prev, ...added]);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      marginTop: 14,
      borderColor: THEME.pastelDark
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0435\u043A\u0441\u0442 / \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flexWrap: "wrap",
      marginBottom: 6,
      background: "#dfeaf3",
      padding: "5px 6px",
      borderRadius: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("bold")
  }, /*#__PURE__*/React.createElement("b", null, "\u0416")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("italic")
  }, /*#__PURE__*/React.createElement("i", null, "\u041A")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("underline")
  }, /*#__PURE__*/React.createElement("u", null, "\u0427")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("strikeThrough")
  }, /*#__PURE__*/React.createElement("s", null, "\u0417")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("insertUnorderedList")
  }, "\u2022 \u0421\u043F\u0438\u0441\u043E\u043A"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("insertOrderedList")
  }, "1. \u0421\u043F\u0438\u0441\u043E\u043A"), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 18,
      background: "#b9cfe0",
      margin: "0 2px"
    }
  }), HIGHLIGHT_COLORS.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    onMouseDown: e => e.preventDefault(),
    onClick: () => execHighlight(c),
    title: "\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0430\u0440\u043A\u0435\u0440\u043E\u043C",
    style: {
      width: 18,
      height: 18,
      borderRadius: 4,
      background: c,
      cursor: "pointer",
      border: "1.5px solid #b9cfe0"
    }
  })), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => execHighlight("transparent")
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    ref: editorRef,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onInput: saveText,
    onBlur: saveText,
    style: {
      minHeight: 70,
      background: "#fff",
      border: "1.5px solid #cfe3f2",
      borderRadius: 8,
      padding: "9px 12px",
      fontSize: 14,
      lineHeight: 1.5,
      color: "#12233a",
      outline: "none"
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: 2,
    style: {
      ...inputStyle,
      resize: "vertical"
    },
    value: note,
    onChange: e => setNote(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0435\u043C\u0430 \u0443\u0440\u043E\u043A\u0430 (\u0442\u0435\u0433\u0438)"
  }, /*#__PURE__*/React.createElement(TopicTagPicker, {
    data: data,
    selectedIds: topicIds,
    onToggle: toggleTopic,
    ensureTopicTag: ensureTopicTag
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\u0417\u0430\u043C\u0435\u0442\u043A\u0430 (\u043A\u0440\u0430\u0441\u043D\u0430\u044F, \u0434\u043B\u044F \u043E\u0431\u043E\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043D\u0430 \u0443\u0440\u043E\u043A\u0435)"
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      borderColor: THEME.red
    },
    value: redNote,
    onChange: e => setRedNote(e.target.value),
    placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\u0424\u0430\u0439\u043B\u044B / \u0444\u043E\u0442\u043E / \u0432\u0438\u0434\u0435\u043E"
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    multiple: true,
    onChange: e => handleFiles(e.target.files),
    style: {
      fontSize: 12.5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#7a8a9c",
      marginTop: 4
    }
  }, "\u0424\u043E\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u043F\u0440\u044F\u043C\u043E \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 (\u0432 \u0441\u0436\u0430\u0442\u043E\u043C \u0432\u0438\u0434\u0435). \u0414\u043B\u044F \u0432\u0438\u0434\u0435\u043E \u0438 \u0431\u043E\u043B\u044C\u0448\u0438\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u0441\u044F \u0441\u0441\u044B\u043B\u043A\u0430 \u2014 \u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0435\u0451 \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u043D\u0438\u0436\u0435.")), attachments.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6,
      marginTop: -6,
      marginBottom: 12
    }
  }, attachments.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, a.kind === "image" ? /*#__PURE__*/React.createElement("img", {
    src: a.dataUrl,
    onClick: () => setPreviewAttachment(a),
    style: {
      width: 32,
      height: 32,
      objectFit: "cover",
      borderRadius: 4,
      cursor: "pointer"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12
    }
  }, "\uD83D\uDCCE ", a.name), a.kind === "file" && /*#__PURE__*/React.createElement("input", {
    placeholder: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0444\u0430\u0439\u043B (URL)",
    style: {
      ...inputStyle,
      padding: "4px 8px",
      fontSize: 11.5
    },
    value: a.url,
    onChange: e => {
      const url = e.target.value;
      setAttachments(prev => prev.map((x, idx) => idx === i ? {
        ...x,
        url
      } : x));
    }
  }), /*#__PURE__*/React.createElement("span", {
    onClick: () => setAttachments(prev => prev.filter((_, idx) => idx !== i)),
    style: {
      cursor: "pointer",
      color: THEME.red,
      fontWeight: 900
    }
  }, "\xD7"))), previewAttachment && /*#__PURE__*/React.createElement(ImageLightboxModal, {
    src: previewAttachment.dataUrl,
    name: previewAttachment.name,
    onClose: () => setPreviewAttachment(null)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    disabled: !stripHtml(text).trim(),
    onClick: () => onSave({
      text,
      note,
      redNote,
      topicTagIds: topicIds,
      attachments
    })
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onCancel
  }, "\u041E\u0442\u043C\u0435\u043D\u0430")));
}

/* ============================================================
   ВКЛАДКА: УРОКИ И КУРСЫ
   ============================================================ */
function LetterChip({
  label,
  active,
  onClick,
  onRemove
}) {
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      border: `1.5px solid ${active ? THEME.bgDark : THEME.border}`,
      background: active ? THEME.pastel : "#fff",
      color: THEME.panelText,
      padding: "4px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, label, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onRemove();
    },
    style: {
      opacity: 0.6,
      fontWeight: 900
    }
  }, "\xD7"));
}
function LessonsTab({
  data,
  update,
  activeClass,
  setActiveClass,
  activeLessonId,
  setActiveLessonId,
  target,
  setTarget,
  letterFilter,
  setLetterFilter,
  onBackFromLesson
}) {
  const [newCourse, setNewCourse] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingCourseName, setEditingCourseName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [copyLettersId, setCopyLettersId] = useState(null);
  const [copyLettersChecked, setCopyLettersChecked] = useState([]);
  const scrollPosRef = useRef(0);
  const importLessonFileRef = useRef(null);
  const importLessonFile = async file => {
    let payload;
    try {
      payload = JSON.parse(await readTextFile(file));
    } catch (e) {
      alert("Не удалось прочитать файл — это не корректный JSON.");
      return;
    }
    if (!payload || payload.type !== "literature-constructor-lesson") {
      alert("Файл не похож на экспортированный урок.");
      return;
    }
    const wantLetterId = target.kind === "class" && letterFilter !== "all" && letterFilter !== "none" ? letterFilter : null;
    update(d => {
      const id = importLessonData(d, payload, {
        kind: target.kind,
        value: target.kind === "class" ? target.classNum : target.courseId,
        classLetterId: wantLetterId
      });
      setActiveLessonId(id);
      return d;
    });
  };

  // При смене класса/курса старый фильтр по литере больше не имеет смысла — но не сбрасываем
  // его при самом первом рендере (например, при возврате на эту страницу): литера, на которой
  // вы были, должна сохраниться.
  const lessonsFirstRender = useRef(true);
  useEffect(() => {
    if (lessonsFirstRender.current) {
      lessonsFirstRender.current = false;
      return;
    }
    setLetterFilter("all");
  }, [target.kind, target.classNum, target.courseId]);
  const openLesson = id => {
    scrollPosRef.current = window.scrollY;
    setActiveLessonId(id);
  };
  const backToList = () => {
    if (onBackFromLesson && onBackFromLesson()) return;
    setActiveLessonId(null);
    setTimeout(() => window.scrollTo({
      top: scrollPosRef.current
    }), 0);
  };
  const lessonsFor = t => data.lessons.filter(l => t.kind === "class" ? l.class === t.classNum && !l.courseId : l.courseId === t.courseId).filter(l => showArchived ? true : !l.archived).filter(l => {
    if (t.kind !== "class" || letterFilter === "all") return true;
    if (letterFilter === "none") return !l.classLetterId;
    return l.classLetterId === letterFilter;
  }).sort((a, b) => a.order - b.order);

  // Новый урок создаётся один, для текущей выбранной литеры (или без литеры, если выбрано
  // "Все"/"Без литеры") — пустым по другим литерам не размножается. Дата ставится на следующий
  // день после последнего урока этой же литеры в календаре, если такой уже есть. Когда урок
  // наполнен (упражнения, теги, тип) — его можно перенести в другие литеры кнопкой на странице урока.
  const addLesson = t => {
    const wantLetterId = t.kind === "class" && letterFilter !== "all" && letterFilter !== "none" ? letterFilter : null;
    update(d => {
      const id = createSingleLesson(d, {
        kind: t.kind,
        value: t.kind === "class" ? t.classNum : t.courseId,
        classLetterId: wantLetterId
      });
      setActiveLessonId(id);
      return d;
    });
  };
  const move = (t, id, dir) => {
    update(d => {
      const list = d.lessons.filter(l => t.kind === "class" ? l.class === t.classNum && !l.courseId : l.courseId === t.courseId).filter(l => showArchived ? true : !l.archived).filter(l => {
        if (t.kind !== "class" || letterFilter === "all") return true;
        if (letterFilter === "none") return !l.classLetterId;
        return l.classLetterId === letterFilter;
      }).sort((a, b) => a.order - b.order);
      const idx = list.findIndex(l => l.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= list.length) return d;
      const a = list[idx],
        b = list[swapIdx];
      const fullA = d.lessons.find(x => x.id === a.id);
      const fullB = d.lessons.find(x => x.id === b.id);
      const tmp = fullA.order;
      fullA.order = fullB.order;
      fullB.order = tmp;
      return d;
    });
  };
  const toggleArchive = id => {
    update(d => {
      const l = d.lessons.find(x => x.id === id);
      l.archived = !l.archived;
      return d;
    });
  };
  const toggleCompletedInList = id => {
    update(d => {
      const l = d.lessons.find(x => x.id === id);
      l.completed = !l.completed;
      return d;
    });
  };
  const deleteLesson = id => {
    if (!window.confirm("Удалить урок? Упражнения и теория, использованные в нём, останутся в базе.")) return;
    update(d => {
      d.lessons = d.lessons.filter(l => l.id !== id);
      return d;
    });
  };
  const moveLessonTo = (id, destValue) => {
    if (!destValue) return;
    const [kind, val] = destValue.split(":");
    update(d => {
      const l = d.lessons.find(x => x.id === id);
      const siblings = d.lessons.filter(x => x.id !== id && (kind === "class" ? x.class === val && !x.courseId : x.courseId === val));
      const order = siblings.length ? Math.max(...siblings.map(s => s.order)) + 1 : 0;
      l.class = kind === "class" ? val : null;
      l.courseId = kind === "course" ? val : null;
      l.classLetterId = null;
      l.order = order;
      return d;
    });
  };

  // Создаёт независимую копию урока в другом классе/курсе (или в том же классе как вариант).
  // Копия полностью самостоятельна: изменения в ней не затрагивают оригинал, и наоборот.
  const duplicateLessonTo = (id, destValue) => {
    if (!destValue) return;
    const [kind, val] = destValue.split(":");
    update(d => {
      duplicateLessonInto(d, id, {
        kind,
        value: val,
        classLetterId: null
      });
      return d;
    });
  };

  // Создаёт по независимой копии этого урока для каждой выбранной литеры того же класса —
  // чтобы не дублировать вручную один и тот же урок несколько раз. У каждой копии дальше
  // своя дата, свой статус "пройден" и свои отметки, как и у обычного дубликата.
  const duplicateLessonToLetters = (id, letterIds) => {
    if (!letterIds || letterIds.length === 0) return;
    update(d => {
      const src = d.lessons.find(x => x.id === id);
      if (!src) return d;
      letterIds.forEach(letterId => {
        duplicateLessonInto(d, id, {
          kind: "class",
          value: src.class,
          classLetterId: letterId
        });
      });
      return d;
    });
  };
  const addCourse = () => {
    if (!newCourse.trim()) return;
    const id = uid();
    update(d => {
      d.courses.push({
        id,
        name: newCourse.trim()
      });
      return d;
    });
    setNewCourse("");
    setAddingCourse(false);
    setTarget({
      kind: "course",
      classNum: null,
      courseId: id
    });
  };
  const renameCourse = (id, name) => {
    update(d => {
      const c = d.courses.find(x => x.id === id);
      if (c) c.name = name.trim() || c.name;
      return d;
    });
  };
  const commitCourseRename = () => {
    if (editingCourseId) renameCourse(editingCourseId, editingCourseName);
    setEditingCourseId(null);
  };
  const deleteCourse = id => {
    update(d => {
      d.courses = d.courses.filter(c => c.id !== id);
      d.lessons = d.lessons.filter(l => l.courseId !== id);
      return d;
    });
    if (target.courseId === id) setTarget({
      kind: "class",
      classNum: activeClass,
      courseId: null
    });
  };
  const activeLesson = data.lessons.find(l => l.id === activeLessonId);
  const toggleFavoriteClass = c => {
    update(d => {
      const has = d.favorites.classes.includes(c);
      d.favorites.classes = has ? d.favorites.classes.filter(x => x !== c) : [...d.favorites.classes, c];
      return d;
    });
  };
  const toggleFavoriteCourse = id => {
    update(d => {
      const has = d.favorites.courses.includes(id);
      d.favorites.courses = has ? d.favorites.courses.filter(x => x !== id) : [...d.favorites.courses, id];
      return d;
    });
  };
  const StarBtn = ({
    active,
    onClick
  }) => /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onClick();
    },
    title: active ? "Убрать из избранного" : "Добавить в избранное",
    style: {
      cursor: "pointer",
      fontSize: 14,
      color: active ? "#d9a94e" : "#c3cfd9",
      marginLeft: 6
    }
  }, active ? "★" : "☆");
  if (activeLesson) {
    return /*#__PURE__*/React.createElement(LessonPage, {
      data: data,
      update: update,
      lesson: activeLesson,
      onBack: backToList
    });
  }
  const favClasses = CLASSES.filter(c => data.favorites.classes.includes(c));
  const favCourses = data.courses.filter(c => data.favorites.courses.includes(c.id));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      padding: 16,
      height: "fit-content"
    }
  }, (favClasses.length > 0 || favCourses.length > 0) && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 8,
      color: "#5a6b7d"
    }
  }, "\u2B50 \u0418\u0417\u0411\u0420\u0410\u041D\u041D\u041E\u0415"), favClasses.map(c => /*#__PURE__*/React.createElement("div", {
    key: "fav-class-" + c,
    onClick: () => setTarget({
      kind: "class",
      classNum: c,
      courseId: null
    }),
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 10px",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: target.kind === "class" && target.classNum === c ? 800 : 500,
      background: target.kind === "class" && target.classNum === c ? THEME.pastel : "transparent",
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", null, c, " \u043A\u043B\u0430\u0441\u0441"), /*#__PURE__*/React.createElement(StarBtn, {
    active: true,
    onClick: () => toggleFavoriteClass(c)
  }))), favCourses.map(c => /*#__PURE__*/React.createElement("div", {
    key: "fav-course-" + c.id,
    onClick: () => setTarget({
      kind: "course",
      classNum: null,
      courseId: c.id
    }),
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 10px",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: target.kind === "course" && target.courseId === c.id ? 800 : 500,
      background: target.kind === "course" && target.courseId === c.id ? THEME.pastel : "transparent",
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", null, c.name), /*#__PURE__*/React.createElement(StarBtn, {
    active: true,
    onClick: () => toggleFavoriteCourse(c.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "#d7e6f0",
      margin: "10px 0 14px"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 8,
      color: "#5a6b7d"
    }
  }, "\u041A\u041B\u0410\u0421\u0421\u042B"), CLASSES.map(c => /*#__PURE__*/React.createElement("div", {
    key: c,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 10px",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: target.kind === "class" && target.classNum === c ? 800 : 500,
      background: target.kind === "class" && target.classNum === c ? THEME.pastel : "transparent",
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => setTarget({
      kind: "class",
      classNum: c,
      courseId: null
    }),
    style: {
      flex: 1
    }
  }, c, " \u043A\u043B\u0430\u0441\u0441"), /*#__PURE__*/React.createElement(StarBtn, {
    active: data.favorites.classes.includes(c),
    onClick: () => toggleFavoriteClass(c)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      margin: "16px 0 8px",
      color: "#5a6b7d"
    }
  }, "\u041A\u0423\u0420\u0421\u042B"), data.courses.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    onClick: () => {
      if (target.kind !== "course" || target.courseId !== c.id) {
        setTarget({
          kind: "course",
          classNum: null,
          courseId: c.id
        });
      }
    },
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 10px",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: target.kind === "course" && target.courseId === c.id ? 800 : 500,
      background: target.kind === "course" && target.courseId === c.id ? THEME.pastel : "transparent"
    }
  }, editingCourseId === c.id ? /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: editingCourseName,
    onClick: e => e.stopPropagation(),
    onChange: e => setEditingCourseName(e.target.value),
    onBlur: commitCourseRename,
    onKeyDown: e => {
      if (e.key === "Enter") commitCourseRename();
      if (e.key === "Escape") setEditingCourseId(null);
    },
    style: {
      flex: 1,
      minWidth: 0,
      border: `1.5px solid ${THEME.pastelDark}`,
      background: "#fff",
      borderRadius: 6,
      padding: "3px 6px",
      font: "inherit",
      fontWeight: "inherit",
      color: "#12233a"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      setEditingCourseId(c.id);
      setEditingCourseName(c.name);
    },
    title: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u043A\u0443\u0440\u0441",
    style: {
      cursor: "pointer",
      fontSize: 13,
      marginLeft: 6,
      flexShrink: 0
    }
  }, "\u270F\uFE0F"), /*#__PURE__*/React.createElement(StarBtn, {
    active: data.favorites.courses.includes(c.id),
    onClick: () => toggleFavoriteCourse(c.id)
  }), /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      deleteCourse(c.id);
    },
    style: {
      color: THEME.red,
      fontWeight: 900,
      fontSize: 13,
      marginLeft: 6,
      flexShrink: 0
    }
  }, "\xD7"))), addingCourse ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    style: {
      ...inputStyle,
      fontSize: 12.5,
      padding: "6px 8px"
    },
    value: newCourse,
    onChange: e => setNewCourse(e.target.value),
    onKeyDown: e => e.key === "Enter" && addCourse(),
    placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043A\u0443\u0440\u0441\u0430"
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addCourse
  }, "\u041E\u041A")) : /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      marginTop: 8,
      color: "#12233a",
      border: "1.5px dashed #9bb6c9",
      width: "100%"
    },
    onClick: () => setAddingCourse(true)
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u0443\u0440\u0441")), /*#__PURE__*/React.createElement("div", {
    style: panelStyle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
      flexWrap: "wrap",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: THEME.panelText
    }
  }, target.kind === "class" ? `${target.classNum} класс` : data.courses.find(c => c.id === target.courseId)?.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12.5,
      display: "flex",
      alignItems: "center",
      gap: 5,
      color: "#5a6b7d"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: showArchived,
    onChange: e => setShowArchived(e.target.checked)
  }), "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0430\u0440\u0445\u0438\u0432"), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => addLesson(target)
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0440\u043E\u043A"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => importLessonFileRef.current?.click()
  }, "\u2B06 \u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0443\u0440\u043E\u043A (.lsnrus)"), /*#__PURE__*/React.createElement("input", {
    ref: importLessonFileRef,
    type: "file",
    accept: ".lsnrus,.urok,.json,application/json",
    style: {
      display: "none"
    },
    onChange: e => {
      const file = e.target.files?.[0];
      if (file) importLessonFile(file);
      e.target.value = "";
    }
  }))), target.kind === "class" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "#7a8a9c"
    }
  }, "\u041B\u0438\u0442\u0435\u0440\u0430 (\u0435\u0441\u043B\u0438 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E ", target.classNum, " \u043A\u043B\u0430\u0441\u0441\u043E\u0432 \u0432 \u043F\u0430\u0440\u0430\u043B\u043B\u0435\u043B\u0438):"), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u0412\u0441\u0435",
    active: letterFilter === "all",
    onClick: () => setLetterFilter("all")
  }), lettersForGrade(data, target.classNum).length > 0 && /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u0411\u0435\u0437 \u043B\u0438\u0442\u0435\u0440\u044B",
    active: letterFilter === "none",
    onClick: () => setLetterFilter("none")
  }), lettersForGrade(data, target.classNum).map(cl => /*#__PURE__*/React.createElement(LetterChip, {
    key: cl.id,
    label: `${target.classNum}${cl.name}`,
    active: letterFilter === cl.id,
    onClick: () => setLetterFilter(cl.id)
  })), lettersForGrade(data, target.classNum).length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#93a2b1"
    }
  }, "\u041B\u0438\u0442\u0435\u0440\u044B \u0441\u043E\u0437\u0434\u0430\u044E\u0442\u0441\u044F \u0432 \xAB\u041F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435\xBB \u2192 \xAB\u0421\u043F\u0438\u0441\u043A\u0438 \u043A\u043B\u0430\u0441\u0441\u043E\u0432\xBB.")), /*#__PURE__*/React.createElement(ScheduleCalculator, {
    status: computeScheduleStatus(data.lessons.filter(l => target.kind === "class" ? l.class === target.classNum && !l.courseId : l.courseId === target.courseId)),
    style: {
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, lessonsFor(target).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#8593a3"
    }
  }, "\u0423\u0440\u043E\u043A\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442."), lessonsFor(target).map((l, i, arr) => {
    const typeTags = (l.lessonTypeTagIds || []).map(id => data.tags.lessonType.find(t => t.id === id)).filter(Boolean);
    const items = l.items || [];
    const exCount = items.filter(it => it.type === "exercise").length;
    const theoryCount = items.filter(it => it.type === "theory").length;
    const previewLabels = items.map(it => ({
      it,
      obj: it.type === "exercise" ? data.examples.find(e => e.id === it.refId) : data.theory.find(t => t.id === it.refId)
    })).filter(x => x.obj).map(({
      it,
      obj
    }) => it.type === "theory" ? `📘 ${obj.title}` : stripHtml(obj.text));
    return /*#__PURE__*/React.createElement("div", {
      key: l.id,
      className: "lc-row",
      style: {
        ...cardStyle,
        cursor: "pointer",
        opacity: l.completed || l.archived ? 0.55 : 1,
        border: l.archived ? "1.5px dashed #b0bcc7" : l.needsWork ? "1px solid #e7d3a8" : cardStyle.border,
        background: l.needsWork ? "#fdf8ef" : cardStyle.background,
        borderLeft: l.needsWork ? "3px solid #d9a94e" : undefined
      },
      onClick: () => openLesson(l.id)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: !!l.completed,
      onClick: e => e.stopPropagation(),
      onChange: () => toggleCompletedInList(l.id),
      title: "\u0423\u0440\u043E\u043A \u043F\u0440\u043E\u0439\u0434\u0435\u043D",
      style: {
        marginTop: 4,
        flexShrink: 0,
        cursor: "pointer"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 13.5
      }
    }, "\u2116", i + 1, l.classLetterId ? ` (${l.class}${classLetterName(data, l.classLetterId)})` : "", ". ", l.topic || "Без темы", " ", l.archived ? " · в архиве" : "", " ", l.needsWork ? " · требует доработки" : ""), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#7a8a9c"
      }
    }, exCount, " \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0439 ", theoryCount ? `· ${theoryCount} теории` : "", " ", l.completed ? "· пройден" : "", l.plannedDate ? ` · план: ${formatDateRu(l.plannedDate)}` : "", l.actualDate ? ` · факт: ${formatDateRu(l.actualDate)}` : "", l.excludeFromSchedule ? " · не учитывается" : ""), previewLabels.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#5a6b7d",
        fontStyle: "italic",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 480
      }
    }, previewLabels.join(" · ")), typeTags.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        marginTop: 4
      }
    }, typeTags.map(t => /*#__PURE__*/React.createElement(Badge, {
      key: t.id,
      tag: t
    }))))), /*#__PURE__*/React.createElement("div", {
      className: "lc-reveal",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("span", {
      className: "lc-iconbtn",
      title: "\u0412\u044B\u0448\u0435",
      onClick: () => move(target, l.id, -1),
      style: i === 0 ? {
        opacity: 0.3,
        pointerEvents: "none"
      } : undefined
    }, "\u2191"), /*#__PURE__*/React.createElement("span", {
      className: "lc-iconbtn",
      title: "\u041D\u0438\u0436\u0435",
      onClick: () => move(target, l.id, 1),
      style: i === arr.length - 1 ? {
        opacity: 0.3,
        pointerEvents: "none"
      } : undefined
    }, "\u2193"), /*#__PURE__*/React.createElement("select", {
      defaultValue: "",
      onChange: e => {
        moveLessonTo(l.id, e.target.value);
        e.target.value = "";
      },
      style: {
        ...toolSelectStyle,
        fontSize: 11,
        padding: "4px 6px"
      },
      title: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0443\u0440\u043E\u043A \u0432 \u0434\u0440\u0443\u0433\u043E\u0439 \u043A\u043B\u0430\u0441\u0441 \u0438\u043B\u0438 \u043A\u0443\u0440\u0441"
    }, /*#__PURE__*/React.createElement("option", {
      value: "",
      disabled: true
    }, "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432\u2026"), CLASSES.map(c => /*#__PURE__*/React.createElement("option", {
      key: c,
      value: `class:${c}`,
      disabled: !l.courseId && l.class === c
    }, c, " \u043A\u043B\u0430\u0441\u0441")), data.courses.map(c => /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: `course:${c.id}`,
      disabled: l.courseId === c.id
    }, c.name))), /*#__PURE__*/React.createElement("select", {
      defaultValue: "",
      onChange: e => {
        duplicateLessonTo(l.id, e.target.value);
        e.target.value = "";
      },
      style: {
        ...toolSelectStyle,
        fontSize: 11,
        padding: "4px 6px"
      },
      title: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u0443\u044E \u043A\u043E\u043F\u0438\u044E \u0443\u0440\u043E\u043A\u0430 \u0432 \u0434\u0440\u0443\u0433\u043E\u043C \u043A\u043B\u0430\u0441\u0441\u0435 \u0438\u043B\u0438 \u043A\u0443\u0440\u0441\u0435"
    }, /*#__PURE__*/React.createElement("option", {
      value: "",
      disabled: true
    }, "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u2026"), CLASSES.map(c => /*#__PURE__*/React.createElement("option", {
      key: c,
      value: `class:${c}`
    }, c, " \u043A\u043B\u0430\u0441\u0441")), data.courses.map(c => /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: `course:${c.id}`
    }, c.name))), !l.courseId && lettersForGrade(data, l.class).length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "lc-iconbtn",
      title: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u0443\u0440\u043E\u043A \u0441\u0440\u0430\u0437\u0443 \u0432 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043B\u0438\u0442\u0435\u0440",
      onClick: () => {
        setCopyLettersId(copyLettersId === l.id ? null : l.id);
        setCopyLettersChecked([]);
      }
    }, "\u29C9"), /*#__PURE__*/React.createElement("span", {
      className: "lc-iconbtn",
      title: l.archived ? "Вернуть из архива" : "Отправить в архив",
      onClick: () => toggleArchive(l.id)
    }, l.archived ? "📤" : "🗄"), /*#__PURE__*/React.createElement("span", {
      className: "lc-iconbtn",
      title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
      onClick: () => deleteLesson(l.id),
      style: {
        color: THEME.red
      }
    }, "\uD83D\uDDD1"))), copyLettersId === l.id && /*#__PURE__*/React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        marginTop: 10,
        padding: 10,
        background: "#f6fbfe",
        borderRadius: 8,
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: "#5a6b7d"
      }
    }, "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u0443\u0440\u043E\u043A \u0432 \u043B\u0438\u0442\u0435\u0440\u044B:"), lettersForGrade(data, l.class).filter(cl => cl.id !== l.classLetterId).map(cl => /*#__PURE__*/React.createElement("label", {
      key: cl.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12.5,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: copyLettersChecked.includes(cl.id),
      onChange: e => setCopyLettersChecked(prev => e.target.checked ? [...prev, cl.id] : prev.filter(x => x !== cl.id))
    }), l.class, cl.name)), /*#__PURE__*/React.createElement(Btn, {
      kind: "pastel",
      small: true,
      disabled: copyLettersChecked.length === 0,
      onClick: () => {
        duplicateLessonToLetters(l.id, copyLettersChecked);
        setCopyLettersId(null);
        setCopyLettersChecked([]);
      }
    }, "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C")));
  })), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    style: {
      marginTop: 14
    },
    onClick: () => addLesson(target)
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0440\u043E\u043A"), /*#__PURE__*/React.createElement(ReservePool, {
    data: data,
    update: update,
    target: target,
    letterFilter: letterFilter,
    lessonsInGroup: lessonsFor(target)
  })));
}

// Запас определён на конкретный класс + конкретную литеру (или курс) — не общий список.
// Если выбрано "Все" литеры сразу, а у класса вообще есть литеры — просим уточнить, какую
// именно литеру показывать, чтобы не путать запасы разных литер друг с другом.
function ReservePool({
  data,
  update,
  target,
  letterFilter,
  lessonsInGroup
}) {
  const groupKind = target.kind === "class" ? "class" : "course";
  const groupValue = target.kind === "class" ? target.classNum : target.courseId;
  const hasLetters = target.kind === "class" && lettersForGrade(data, target.classNum).length > 0;
  const ambiguous = hasLetters && letterFilter === "all";
  const classLetterId = target.kind === "class" && letterFilter !== "all" && letterFilter !== "none" ? letterFilter : null;
  const reserveItems = ambiguous ? [] : data.reserves.filter(r => r.groupKind === groupKind && r.groupValue === groupValue && (r.classLetterId || null) === classLetterId);
  const removeFromReserve = reserveId => {
    update(d => {
      d.reserves = d.reserves.filter(r => r.id !== reserveId);
      return d;
    });
  };
  const addReservedToLesson = (reserveId, exerciseId, lessonId) => {
    if (!lessonId) return;
    update(d => {
      const l = d.lessons.find(x => x.id === lessonId);
      if (l) {
        l.items = l.items || [];
        if (!l.items.some(it => it.type === "exercise" && it.refId === exerciseId)) {
          l.items.push({
            id: uid(),
            type: "exercise",
            refId: exerciseId
          });
        }
      }
      d.reserves = d.reserves.filter(r => r.id !== reserveId);
      return d;
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 16,
    style: {
      color: THEME.panelText,
      marginBottom: 10
    }
  }, "\u0417\u0430\u043F\u0430\u0441\u043D\u044B\u0435 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F"), ambiguous ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#8593a3"
    }
  }, "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0443\u044E \u043B\u0438\u0442\u0435\u0440\u0443 \u0432\u044B\u0448\u0435, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0435\u0451 \u0437\u0430\u043F\u0430\u0441 \u2014 \u0443 \u0440\u0430\u0437\u043D\u044B\u0445 \u043B\u0438\u0442\u0435\u0440 \u043E\u043D \u0441\u0432\u043E\u0439.") : reserveItems.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#8593a3"
    }
  }, "\u041F\u0443\u0441\u0442\u043E. \u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435 \u043A\u0430\u043A \xAB\u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043E\xBB \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0443\u0440\u043E\u043A\u0430 \u2014 \u043E\u043D\u043E \u043E\u043A\u0430\u0436\u0435\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, reserveItems.map(r => {
    const ex = data.examples.find(e => e.id === r.exerciseId);
    if (!ex) return null;
    const typeTag = data.tags.type.find(t => t.id === ex.typeTagId);
    const missingIn = target.kind === "class" ? lettersMissingExercise(data, target.classNum, ex.id, classLetterId) : [];
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      style: {
        ...cardStyle,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 3,
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, typeTag && /*#__PURE__*/React.createElement(Badge, {
      tag: typeTag
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, stripHtml(ex.text))), missingIn.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: THEME.gold
      }
    }, "\u0422\u0430\u043A\u0436\u0435 \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043E \u0432 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430\u0445: ", missingIn.join(", "))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("select", {
      defaultValue: "",
      onChange: e => {
        addReservedToLesson(r.id, ex.id, e.target.value);
        e.target.value = "";
      },
      style: {
        ...toolSelectStyle,
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: "",
      disabled: true
    }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u0443\u0440\u043E\u043A\u2026"), lessonsInGroup.map(l => /*#__PURE__*/React.createElement("option", {
      key: l.id,
      value: l.id
    }, l.topic || "Без темы"))), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => removeFromReserve(r.id)
    }, "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0437\u0430\u043F\u0430\u0441\u0430")));
  })));
}

/* ============================================================
   ВКЛАДКА: КАЛЕНДАРЬ И ЖУРНАЛ
   Работает над теми же уроками (data.lessons), что и раздел "Уроки и курсы":
   когда там назначают планируемую дату — урок сразу появляется здесь,
   и наоборот, перетаскивание/создание здесь сразу меняет тот же урок.
   ============================================================ */
function CalendarTab({
  data,
  update,
  onOpenLesson,
  subTab,
  setSubTab,
  filterKey,
  setFilterKey,
  calLetterFilter,
  setCalLetterFilter,
  journalTrackKey,
  setJournalTrackKey,
  journalLetterFilter,
  setJournalLetterFilter,
  classListsTrack,
  setClassListsTrack,
  classListsSub,
  setClassListsSub,
  month,
  setMonth,
  view,
  setView
}) {
  // month и view хранятся на уровне приложения — чтобы после открытия урока и возврата «Назад»
  // календарь показывал тот же месяц и тот же режим (недели/месяц), а не сбрасывался на сегодня.
  const [vacPanelOpen, setVacPanelOpen] = useState(false);
  const [addingVac, setAddingVac] = useState(false);
  const [vacName, setVacName] = useState("");
  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");
  const [creating, setCreating] = useState(null);
  const [duplicating, setDuplicating] = useState(null); // урок, который дублируем
  const [dragLessonId, setDragLessonId] = useState(null);
  const tracks = allTracks(data);
  const tIso = todayIso();
  const addVacation = () => {
    if (!vacStart || !vacEnd) {
      alert("Укажите начало и конец каникул");
      return;
    }
    let s = vacStart,
      e = vacEnd;
    if (e < s) {
      const tmp = s;
      s = e;
      e = tmp;
    }
    update(d => {
      d.vacations.push({
        id: uid(),
        name: vacName.trim() || "Каникулы",
        start: s,
        end: e
      });
      return d;
    });
    setVacName("");
    setVacStart("");
    setVacEnd("");
    setAddingVac(false);
  };
  const deleteVacation = id => {
    if (!window.confirm("Удалить эти каникулы?")) return;
    update(d => {
      d.vacations = d.vacations.filter(v => v.id !== id);
      return d;
    });
  };
  const [filterKindPart, filterValuePart] = filterKey !== "all" ? filterKey.split(":") : [null, null];
  const calFirstRender = useRef(true);
  useEffect(() => {
    if (calFirstRender.current) {
      calFirstRender.current = false;
      return;
    }
    setCalLetterFilter("all");
  }, [filterKey]);
  const plannedLessons = data.lessons.filter(l => l.plannedDate && !l.archived);
  const visibleLessons = plannedLessons.filter(l => filterKey === "all" || trackKeyOf(l) === filterKey).filter(l => {
    if (filterKindPart !== "class" || calLetterFilter === "all") return true;
    if (calLetterFilter === "none") return !l.classLetterId;
    return l.classLetterId === calLetterFilter;
  });
  const setLessonDate = (lessonId, newDate) => {
    update(d => {
      const l = d.lessons.find(x => x.id === lessonId);
      if (!l) return d;
      l.plannedDate = newDate;
      resyncOrderForGroup(d, l);
      return d;
    });
  };
  const toggleLessonDone = lesson => {
    update(d => {
      const l = d.lessons.find(x => x.id === lesson.id);
      if (!l) return d;
      l.completed = !l.completed;
      if (l.completed && !l.actualDate) l.actualDate = lesson.plannedDate;
      return d;
    });
  };
  const openCreate = date => {
    const defaultTrackKey = filterKey !== "all" ? filterKey : tracks[0] ? trackKeyOf(tracks[0].kind, tracks[0].value) : null;
    setCreating({
      date,
      mode: "new",
      trackKey: defaultTrackKey,
      topic: "",
      existingId: ""
    });
  };
  const saveCreate = () => {
    const c = creating;
    if (!c || !c.trackKey) {
      alert("Выберите класс или курс");
      return;
    }
    const [kind, value] = c.trackKey.split(":");
    if (c.mode === "new") {
      if (!c.topic.trim()) {
        alert("Впишите тему урока");
        return;
      }
      update(d => {
        const wantLetterId = kind === "class" && calLetterFilter !== "all" && calLetterFilter !== "none" ? calLetterFilter : null;
        createSingleLesson(d, {
          kind,
          value,
          classLetterId: wantLetterId,
          topic: c.topic.trim(),
          plannedDate: c.date
        });
        return d;
      });
    } else {
      if (!c.existingId) {
        alert("Выберите урок из списка");
        return;
      }
      update(d => {
        const l = d.lessons.find(x => x.id === c.existingId);
        if (!l) return d;
        l.plannedDate = c.date;
        resyncOrderForGroup(d, l);
        return d;
      });
    }
    setCreating(null);
  };
  const onDropOnDate = date => {
    if (dragLessonId) setLessonDate(dragLessonId, date);
    setDragLessonId(null);
  };
  const saveDuplicate = ({
    kind,
    value,
    classLetterId
  }) => {
    update(d => {
      const newId = duplicateLessonInto(d, duplicating.id, {
        kind,
        value,
        classLetterId
      });
      const created = d.lessons.find(l => l.id === newId);
      if (created) resyncOrderForGroup(d, created);
      return d;
    });
    setDuplicating(null);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "#E2E7EF",
      padding: 4,
      borderRadius: 11,
      gap: 4
    }
  }, [{
    id: "journal",
    label: "Журнал"
  }, {
    id: "calendar",
    label: "Календарь"
  }, {
    id: "classlists",
    label: "Списки классов"
  }].map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    onClick: () => setSubTab(it.id),
    style: {
      padding: "9px 18px",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 13.5,
      fontFamily: BODY_FONT,
      color: subTab === it.id ? THEME.bgDark : THEME.goldDim,
      background: subTab === it.id ? "#ffffff" : "transparent",
      boxShadow: subTab === it.id ? "0 1px 2px rgba(19,44,83,.06), 0 6px 20px rgba(19,44,83,.08)" : "none"
    }
  }, it.label))), subTab === "calendar" ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(CollapsiblePanel, {
    title: "\u041A\u0430\u043D\u0438\u043A\u0443\u043B\u044B",
    count: data.vacations.length,
    open: vacPanelOpen,
    onToggle: () => setVacPanelOpen(!vacPanelOpen)
  }, data.vacations.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#7a8a9c",
      marginBottom: 10
    }
  }, "\u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u043A\u0430\u043D\u0438\u043A\u0443\u043B\u044B \u2014 \u043E\u043D\u0438 \u043F\u043E\u0434\u0441\u0432\u0435\u0442\u044F\u0442\u0441\u044F \u0432 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u0435, \u0430 \u0433\u043E\u0434 \u0440\u0430\u0437\u043E\u0431\u044C\u0451\u0442\u0441\u044F \u043D\u0430 \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0438 \u0434\u043B\u044F \u0436\u0443\u0440\u043D\u0430\u043B\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6,
      marginBottom: 10
    }
  }, sortedVacations(data).map(v => /*#__PURE__*/React.createElement("div", {
    key: v.id,
    style: {
      ...cardStyle,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700
    }
  }, v.name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#7a8a9c",
      fontSize: 12.5
    }
  }, formatDateRu(v.start), " \u2013 ", formatDateRu(v.end)), /*#__PURE__*/React.createElement("span", {
    onClick: () => deleteVacation(v.id),
    style: {
      marginLeft: "auto",
      color: THEME.red,
      cursor: "pointer",
      fontWeight: 900
    }
  }, "\xD7")))), !addingVac ? /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px dashed #9bb6c9"
    },
    onClick: () => setAddingVac(true)
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u0430\u043D\u0438\u043A\u0443\u043B\u044B") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "flex-end",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      maxWidth: 160
    },
    placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 (\u041E\u0441\u0435\u043D\u043D\u0438\u0435)",
    value: vacName,
    onChange: e => setVacName(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...inputStyle,
      maxWidth: 150
    },
    value: vacStart,
    onChange: e => setVacStart(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...inputStyle,
      maxWidth: 150
    },
    value: vacEnd,
    onChange: e => setVacEnd(e.target.value)
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addVacation
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setAddingVac(false)
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "#E2E7EF",
      padding: 4,
      borderRadius: 10,
      gap: 4
    }
  }, ["weeks", "month"].map(v => /*#__PURE__*/React.createElement("div", {
    key: v,
    onClick: () => setView(v),
    style: {
      padding: "7px 14px",
      borderRadius: 7,
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 13,
      background: view === v ? "#fff" : "transparent",
      color: "#12233a"
    }
  }, v === "weeks" ? "Недели" : "Месяц"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setMonth(addMonthsYm(month, -1))
  }, "\u2190"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 15,
      minWidth: 150,
      textAlign: "center",
      textTransform: "capitalize",
      color: THEME.gold
    }
  }, ymLabel(month)), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setMonth(addMonthsYm(month, 1))
  }, "\u2192"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setMonth(curMonthYm())
  }, "\u0421\u0435\u0433\u043E\u0434\u043D\u044F")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(TrackChip, {
    label: "\u0412\u0441\u0435",
    active: filterKey === "all",
    color: "#8593a3",
    onClick: () => setFilterKey("all")
  }), tracks.map(t => /*#__PURE__*/React.createElement(TrackChip, {
    key: trackKeyOf(t.kind, t.value),
    label: t.label,
    color: t.color,
    active: filterKey === trackKeyOf(t.kind, t.value),
    onClick: () => setFilterKey(trackKeyOf(t.kind, t.value))
  })))), filterKindPart === "class" && lettersForGrade(data, filterValuePart).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: THEME.goldDim
    }
  }, "\u041B\u0438\u0442\u0435\u0440\u0430:"), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u0412\u0441\u0435",
    active: calLetterFilter === "all",
    onClick: () => setCalLetterFilter("all")
  }), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u0411\u0435\u0437 \u043B\u0438\u0442\u0435\u0440\u044B",
    active: calLetterFilter === "none",
    onClick: () => setCalLetterFilter("none")
  }), lettersForGrade(data, filterValuePart).map(cl => /*#__PURE__*/React.createElement(LetterChip, {
    key: cl.id,
    label: `${filterValuePart}${cl.name}`,
    active: calLetterFilter === cl.id,
    onClick: () => setCalLetterFilter(cl.id)
  }))), tracks.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      textAlign: "center",
      padding: 40
    }
  }, "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043A\u043B\u0430\u0441\u0441 \u0438\u043B\u0438 \u043A\u0443\u0440\u0441 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u0423\u0440\u043E\u043A\u0438 \u0438 \u043A\u0443\u0440\u0441\u044B\xBB \u2014 \u0442\u043E\u0433\u0434\u0430 \u0437\u0434\u0435\u0441\u044C \u043C\u043E\u0436\u043D\u043E \u0431\u0443\u0434\u0435\u0442 \u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0443\u0440\u043E\u043A\u0438.") : view === "weeks" ? /*#__PURE__*/React.createElement(CalendarWeeksView, {
    month: month,
    lessons: visibleLessons,
    data: data,
    tIso: tIso,
    onAddLesson: openCreate,
    onOpenLesson: onOpenLesson,
    onToggleDone: toggleLessonDone,
    onDuplicateLesson: setDuplicating,
    dragLessonId: dragLessonId,
    setDragLessonId: setDragLessonId,
    onDropOnDate: onDropOnDate
  }) : /*#__PURE__*/React.createElement(CalendarMonthView, {
    month: month,
    lessons: visibleLessons,
    data: data,
    tIso: tIso,
    onAddLesson: openCreate,
    onOpenLesson: onOpenLesson,
    onToggleDone: toggleLessonDone,
    onDuplicateLesson: setDuplicating,
    dragLessonId: dragLessonId,
    setDragLessonId: setDragLessonId,
    onDropOnDate: onDropOnDate
  })) : subTab === "journal" ? /*#__PURE__*/React.createElement(JournalSection, {
    data: data,
    update: update,
    trackKey: journalTrackKey,
    setTrackKey: setJournalTrackKey,
    tracks: tracks,
    letterFilter: journalLetterFilter,
    setLetterFilter: setJournalLetterFilter
  }) : /*#__PURE__*/React.createElement(ClassListsSection, {
    data: data,
    update: update,
    trackSel: classListsTrack,
    setTrackSel: setClassListsTrack,
    subSel: classListsSub,
    setSubSel: setClassListsSub
  }), creating && /*#__PURE__*/React.createElement(CreateLessonModal, {
    creating: creating,
    setCreating: setCreating,
    tracks: tracks,
    data: data,
    onSave: saveCreate,
    onCancel: () => setCreating(null)
  }), duplicating && /*#__PURE__*/React.createElement(DuplicateLessonModal, {
    lesson: duplicating,
    tracks: tracks,
    data: data,
    onSave: saveDuplicate,
    onCancel: () => setDuplicating(null)
  }));
}

/* ---- Списки классов: отдельное управление ростером учеников и переводом на новый год ---- */
function ClassListsSection({
  data,
  update,
  trackSel,
  setTrackSel,
  subSel,
  setSubSel
}) {
  const [addingSub, setAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [openStudentCardId, setOpenStudentCardId] = useState(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [listViewMode, setListViewMode] = useState("seating"); // "seating" | "alphabet"

  // Литера/подгруппа запоминается на уровне приложения — не сбрасываем её при первом
  // рендере (например, при возврате на эту страницу), только при осознанной смене класса/курса.
  const clsFirstRender = useRef(true);
  useEffect(() => {
    if (clsFirstRender.current) {
      clsFirstRender.current = false;
      return;
    }
    setSubSel("none");
    setAddingSub(false);
  }, [trackSel.kind, trackSel.value]);
  const isClass = trackSel.kind === "class";
  const subs = isClass ? lettersForGrade(data, trackSel.value) : subgroupsForCourse(data, trackSel.value);
  const subLabel = isClass ? "Литера" : "Подгруппа";
  const students = sortedStudents(data.students.filter(s => isClass ? s.class === trackSel.value && !s.courseId && (subSel === "none" ? !s.classLetterId : s.classLetterId === subSel) : s.courseId === trackSel.value && (subSel === "none" ? !s.courseSubgroupId : s.courseSubgroupId === subSel)));
  const target = isClass ? nextGrade(trackSel.value) : null;
  const subIdForSettings = subSel === "none" ? null : subSel;
  const currentSettings = getClassSettings(data, trackSel.kind, trackSel.value, subIdForSettings);
  const trackLabel = isClass ? `${trackSel.value} класс` : data.courses.find(c => c.id === trackSel.value)?.name || "";
  const subName = isClass ? classLetterName(data, subSel) : courseSubgroupName(data, subSel);
  const patchClassSettings = patch => {
    update(d => {
      d.classSettings = d.classSettings || [];
      const key = classSettingsKey(trackSel.kind, trackSel.value, subIdForSettings);
      let rec = d.classSettings.find(s => classSettingsKey(s.kind, s.value, s.classLetterId) === key);
      if (!rec) {
        rec = {
          id: uid(),
          kind: trackSel.kind,
          value: trackSel.value,
          classLetterId: subIdForSettings
        };
        d.classSettings.push(rec);
      }
      Object.assign(rec, patch);
      return d;
    });
  };
  const setGradingSystem = gradingSystem => patchClassSettings({
    gradingSystem
  });
  const addSub = () => {
    if (!newSubName.trim()) return;
    const id = uid();
    update(d => {
      if (isClass) d.classLetters.push({
        id,
        grade: trackSel.value,
        name: newSubName.trim()
      });else {
        d.courseSubgroups = d.courseSubgroups || [];
        d.courseSubgroups.push({
          id,
          courseId: trackSel.value,
          name: newSubName.trim()
        });
      }
      return d;
    });
    setNewSubName("");
    setAddingSub(false);
    setSubSel(id);
  };
  const deleteSub = id => {
    if (!window.confirm(isClass ? "Удалить эту литеру? У уроков и учеников, где она была указана, литера просто снимется." : "Удалить эту подгруппу? У учеников, где она была указана, подгруппа просто снимется.")) return;
    update(d => {
      if (isClass) {
        d.classLetters = d.classLetters.filter(cl => cl.id !== id);
        d.lessons.forEach(l => {
          if (l.classLetterId === id) l.classLetterId = null;
        });
        d.students.forEach(s => {
          if (s.classLetterId === id) s.classLetterId = null;
        });
      } else {
        d.courseSubgroups = (d.courseSubgroups || []).filter(g => g.id !== id);
        d.students.forEach(s => {
          if (s.courseSubgroupId === id) s.courseSubgroupId = null;
        });
      }
      return d;
    });
    if (subSel === id) setSubSel("none");
  };
  const addStudent = () => {
    if (!newStudentName.trim()) return;
    update(d => {
      d.students.push({
        id: uid(),
        name: newStudentName.trim(),
        class: isClass ? trackSel.value : null,
        courseId: isClass ? null : trackSel.value,
        classLetterId: isClass && subSel !== "none" ? subSel : null,
        courseSubgroupId: !isClass && subSel !== "none" ? subSel : null
      });
      return d;
    });
    setNewStudentName("");
  };
  const renameStudent = (id, name) => {
    update(d => {
      const s = d.students.find(x => x.id === id);
      if (s) s.name = name.trim() || "Ученик";
      return d;
    });
  };
  const deleteStudent = id => {
    const s = data.students.find(x => x.id === id);
    if (!s || !window.confirm(`Удалить ученика «${s.name}» и все его отметки?`)) return;
    update(d => {
      d.marks = d.marks.filter(m => m.studentId !== id);
      d.students = d.students.filter(x => x.id !== id);
      (d.seatingLayouts || []).forEach(layout => {
        layout.files.forEach(file => file.forEach(desk => {
          desk.seats = desk.seats.map(sid => sid === id ? null : sid);
        }));
        layout.visionLimits = (layout.visionLimits || []).filter(v => v.studentId !== id);
        layout.seatFurther = (layout.seatFurther || []).filter(sid => sid !== id);
      });
      return d;
    });
  };

  // Переводит весь выбранный класс (литеру) на следующий год: 6 → 7 и т.д. Только для классов —
  // у курсов нет понятия "следующий год". Переносится только список учеников — прошедшие уроки
  // и отметки остаются как есть.
  const promoteClass = () => {
    if (!target) return;
    if (students.length === 0) {
      alert("В этом классе пока нет учеников для перевода.");
      return;
    }
    const letterName = subSel === "none" ? null : classLetterName(data, subSel);
    const label = subSel === "none" ? `${trackSel.value} класс` : `${trackSel.value}${letterName}`;
    if (!window.confirm(`Перевести «${label}» (${students.length} уч.) в ${target} класс? Список учеников переедет в новый класс, а уже прошедшие уроки и отметки останутся как есть — они относятся к ${trackSel.value} классу.`)) return;
    const existingTargetLetter = letterName ? lettersForGrade(data, target).find(cl => cl.name === letterName) : null;
    const targetLetterId = letterName ? existingTargetLetter?.id || uid() : null;
    const shouldCreateLetter = letterName && !existingTargetLetter;
    const movingIds = new Set(students.map(s => s.id));
    update(d => {
      if (shouldCreateLetter) {
        d.classLetters.push({
          id: targetLetterId,
          grade: target,
          name: letterName
        });
      }
      d.students.forEach(s => {
        if (movingIds.has(s.id)) {
          s.class = target;
          s.classLetterId = targetLetterId;
        }
      });
      return d;
    });
    setTrackSel({
      kind: "class",
      value: target
    });
    setSubSel(targetLetterId || "none");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.goldDim
    }
  }, "\u0417\u0434\u0435\u0441\u044C \u043C\u043E\u0436\u043D\u043E \u0432\u0435\u0441\u0442\u0438 \u0441\u043F\u0438\u0441\u043A\u0438 \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u043F\u043E \u043A\u043B\u0430\u0441\u0441\u0430\u043C \u0438 \u043A\u0443\u0440\u0441\u0430\u043C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u0442 \u0436\u0443\u0440\u043D\u0430\u043B\u0430: \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0442\u044C \u043B\u0438\u0442\u0435\u0440\u044B/\u043F\u043E\u0434\u0433\u0440\u0443\u043F\u043F\u044B, \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u0438 \u0443\u0434\u0430\u043B\u044F\u0442\u044C \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432, \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u044C \u043A\u043B\u0430\u0441\u0441 \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0433\u043E\u0434."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, CLASSES.map(c => /*#__PURE__*/React.createElement(TrackChip, {
    key: c,
    label: `${c} класс`,
    color: CLASS_COLORS[c] || "#888",
    active: isClass && trackSel.value === c,
    onClick: () => setTrackSel({
      kind: "class",
      value: c
    })
  })), data.courses.map(c => /*#__PURE__*/React.createElement(TrackChip, {
    key: c.id,
    label: c.name,
    color: c.color || "#888",
    active: !isClass && trackSel.value === c.id,
    onClick: () => setTrackSel({
      kind: "course",
      value: c.id
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: THEME.goldDim
    }
  }, subLabel, ":"), /*#__PURE__*/React.createElement(LetterChip, {
    label: isClass ? "Без литеры" : "Без подгруппы",
    active: subSel === "none",
    onClick: () => setSubSel("none")
  }), subs.map(cl => /*#__PURE__*/React.createElement(LetterChip, {
    key: cl.id,
    label: isClass ? `${trackSel.value}${cl.name}` : cl.name,
    active: subSel === cl.id,
    onClick: () => setSubSel(cl.id),
    onRemove: () => deleteSub(cl.id)
  })), !addingSub ? /*#__PURE__*/React.createElement("span", {
    onClick: () => setAddingSub(true),
    style: {
      fontSize: 11.5,
      color: THEME.gold,
      cursor: "pointer",
      textDecoration: "underline"
    }
  }, "+ \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C ", isClass ? "литеру" : "подгруппу") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    style: {
      ...inputStyle,
      maxWidth: isClass ? 60 : 140,
      padding: "4px 8px",
      fontSize: 12
    },
    placeholder: isClass ? "А" : "Группа 1",
    value: newSubName,
    onChange: e => setNewSubName(e.target.value),
    onKeyDown: e => e.key === "Enter" && addSub()
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addSub
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setAddingSub(false)
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: THEME.goldDim
    }
  }, "\u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u043E\u0446\u0435\u043D\u0438\u0432\u0430\u043D\u0438\u044F \u0434\u043B\u044F ", subSel === "none" ? trackLabel : isClass ? `${trackSel.value}${subName}` : `${trackLabel} · ${subName}`, ":"), Object.keys(GRADING_SYSTEM_LABELS).map(k => /*#__PURE__*/React.createElement(LetterChip, {
    key: k,
    label: GRADING_SYSTEM_LABELS[k],
    active: currentSettings.gradingSystem === k,
    onClick: () => setGradingSystem(k)
  }))), currentSettings.gradingSystem === "combined" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#7a8a9c",
      marginTop: -6
    }
  }, "\u041F\u0440\u0438 \u043A\u043E\u043C\u0431\u0438\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u0448\u043A\u0430\u043B\u0430 \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u0434\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E, \u043F\u0440\u0438 \u0435\u0451 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0438."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: THEME.goldDim
    }
  }, "\u0410\u0442\u0442\u0435\u0441\u0442\u0430\u0446\u0438\u044F \u043F\u043E:"), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u0427\u0435\u0442\u0432\u0435\u0440\u0442\u044F\u043C",
    active: currentSettings.periodMode !== "semester",
    onClick: () => patchClassSettings({
      periodMode: "quarter"
    })
  }), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041F\u043E\u043B\u0443\u0433\u043E\u0434\u0438\u044F\u043C",
    active: currentSettings.periodMode === "semester",
    onClick: () => patchClassSettings({
      periodMode: "semester"
    })
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: THEME.goldDim,
      marginLeft: 10
    }
  }, "\u041D\u0443\u0436\u043D\u043E \u043E\u0442\u043C\u0435\u0442\u043E\u043A \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434:"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    style: {
      ...inputStyle,
      maxWidth: 70,
      padding: "4px 8px",
      fontSize: 12
    },
    placeholder: "\u2014",
    value: currentSettings.requiredMarks || "",
    onChange: e => patchClassSettings({
      requiredMarks: e.target.value ? +e.target.value : null
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#7a8a9c",
      marginTop: -6
    }
  }, "\u0415\u0441\u043B\u0438 \u043E\u0442\u043C\u0435\u0442\u043E\u043A \u043C\u0435\u043D\u044C\u0448\u0435 \u043D\u043E\u0440\u043C\u044B, \u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0434\u043E \u043A\u043E\u043D\u0446\u0430 \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043C\u0430\u043B\u043E \u2014 \u0438\u043C\u044F \u0443\u0447\u0435\u043D\u0438\u043A\u0430 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      maxWidth: 240
    },
    placeholder: "\u0418\u043C\u044F \u0443\u0447\u0435\u043D\u0438\u043A\u0430",
    value: newStudentName,
    onChange: e => setNewStudentName(e.target.value),
    onKeyDown: e => e.key === "Enter" && addStudent()
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addStudent
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0447\u0435\u043D\u0438\u043A\u0430"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    disabled: checkingAll,
    onClick: async () => {
      setCheckingAll(true);
      const count = await runExchangeCheck(data, update, data.students);
      setCheckingAll(false);
      alert(count > 0 ? `Найдено новых файлов: ${count}.` : "Новых файлов не найдено.");
    }
  }, checkingAll ? "Проверка…" : "🔄 Проверить ответы учеников"), isClass && (target ? /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px dashed #9bb6c9",
      marginLeft: "auto"
    },
    onClick: promoteClass
  }, "\u041F\u0435\u0440\u0435\u0432\u0435\u0441\u0442\u0438 \u043A\u043B\u0430\u0441\u0441 \u0432 ", target, "-\u0439 \u2192") : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "#8593a3",
      marginLeft: "auto"
    }
  }, "11 \u043A\u043B\u0430\u0441\u0441 \u2014 \u0432\u044B\u043F\u0443\u0441\u043A\u043D\u043E\u0439, \u043F\u0435\u0440\u0435\u0432\u043E\u0434 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "#E2E7EF",
      padding: 4,
      borderRadius: 10,
      gap: 4
    }
  }, [{
    id: "seating",
    label: "По рассадке"
  }, {
    id: "alphabet",
    label: "По алфавиту"
  }].map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    onClick: () => setListViewMode(it.id),
    style: {
      padding: "7px 14px",
      borderRadius: 7,
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 13,
      background: listViewMode === it.id ? "#fff" : "transparent",
      color: "#12233a"
    }
  }, it.label))), listViewMode === "alphabet" ? students.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      textAlign: "center",
      padding: 30
    }
  }, "\u0421\u043F\u0438\u0441\u043E\u043A \u043F\u0443\u0441\u0442 \u2014 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u0432\u044B\u0448\u0435.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, students.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: {
      ...cardStyle,
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => setOpenStudentCardId(s.id),
    style: {
      cursor: "pointer",
      fontSize: 12,
      color: THEME.goldDim,
      flexShrink: 0
    },
    title: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0443\u0447\u0435\u043D\u0438\u043A\u0430"
  }, "\u24D8"), /*#__PURE__*/React.createElement("input", {
    value: s.name,
    onChange: e => renameStudent(s.id, e.target.value),
    style: {
      border: "1px solid transparent",
      background: "transparent",
      borderRadius: 7,
      padding: "5px 7px",
      fontWeight: 700,
      fontSize: 14,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    onClick: () => deleteStudent(s.id),
    style: {
      cursor: "pointer",
      color: THEME.red,
      fontWeight: 900
    }
  }, "\xD7")))) : /*#__PURE__*/React.createElement(SeatingChart, {
    data: data,
    update: update,
    kind: trackSel.kind,
    value: trackSel.value,
    classLetterId: subIdForSettings,
    students: students,
    deleteStudent: deleteStudent,
    renameStudent: renameStudent,
    groupLabel: subSel === "none" ? trackLabel : isClass ? `${trackSel.value}${subName}` : `${trackLabel} · ${subName}`,
    onOpenStudent: setOpenStudentCardId
  }), openStudentCardId && (() => {
    const student = data.students.find(s => s.id === openStudentCardId);
    if (!student) return null;
    return /*#__PURE__*/React.createElement(StudentCardModal, {
      student: student,
      data: data,
      update: update,
      deleteStudent: deleteStudent,
      renameStudent: renameStudent,
      onClose: () => setOpenStudentCardId(null)
    });
  })());
}

/* ============================================================
   РАССАДКА: визуальная схема класса — доска, 3 ряда парт, drag-and-drop,
   ограничения по зрению / "подальше от доски", случайная рассадка,
   экспорт макета в Word и экспорт/импорт списка для обмена с другими программами.
   ============================================================ */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function downloadJson(filename, obj, ext = "json") {
  const suffix = "." + ext;
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename.endsWith(suffix) ? filename : filename + suffix);
  URL.revokeObjectURL(url);
}
function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

/* ============================================================
   ЭКСПОРТ/ИМПОРТ ОТДЕЛЬНЫХ УРОКОВ И УПРАЖНЕНИЙ: перенос/бэкап одного урока или одного
   примера упражнения через обычный файл (JSON). Категории, виды упражнений, слоты и темы
   на другом компьютере (или после переустановки) сопоставляются по НАЗВАНИЮ и создаются
   заново, если их ещё нет — как и с обменом списком рассадки.
   ============================================================ */
function findOrCreateCategoryByName(d, name) {
  if (!name) return null;
  let c = d.categories.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!c) {
    c = {
      id: uid(),
      name,
      color: SWATCHES[d.categories.length % SWATCHES.length],
      order: d.categories.length
    };
    d.categories.push(c);
  }
  return c.id;
}
function findOrCreateTypeTagByName(d, name, categoryId) {
  if (!name) return null;
  let t = d.tags.type.find(x => x.name.toLowerCase() === name.toLowerCase() && (x.categoryId || null) === (categoryId || null));
  if (!t) {
    const order = d.tags.type.length ? Math.max(...d.tags.type.map(x => x.order || 0)) + 1 : 0;
    t = {
      id: uid(),
      name,
      color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)],
      categoryId: categoryId || null,
      order,
      slots: []
    };
    d.tags.type.push(t);
  }
  return t;
}
function findOrCreateSlotByName(typeTag, name) {
  if (!name || !typeTag) return null;
  typeTag.slots = typeTag.slots || [];
  let s = typeTag.slots.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!s) {
    s = {
      id: uid(),
      name,
      order: typeTag.slots.length
    };
    typeTag.slots.push(s);
  }
  return s.id;
}
function findOrCreateTopicTagByName(d, name) {
  if (!name) return null;
  let t = d.tags.topic.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!t) {
    t = {
      id: uid(),
      name,
      color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)]
    };
    d.tags.topic.push(t);
  }
  return t.id;
}
function findOrCreateLessonTypeTagByName(d, name) {
  if (!name) return null;
  let t = d.tags.lessonType.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!t) {
    t = {
      id: uid(),
      name,
      color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)]
    };
    d.tags.lessonType.push(t);
  }
  return t.id;
}

// Готовит самодостаточное описание упражнения (категория/вид/слот/темы — по названиям,
// а не по внутренним id) — годится и для отдельного файла, и для вложения в файл урока.
function exerciseExportData(ex, data) {
  const typeTag = data.tags.type.find(t => t.id === ex.typeTagId);
  const category = typeTag ? data.categories.find(c => c.id === typeTag.categoryId) : null;
  const slot = typeTag ? (typeTag.slots || []).find(s => s.id === ex.slotId) : null;
  return {
    text: ex.text || "",
    note: ex.note || "",
    redNote: ex.redNote || "",
    attachments: ex.attachments || [],
    topicTagNames: (ex.topicTagIds || []).map(id => data.tags.topic.find(t => t.id === id)?.name).filter(Boolean),
    typeTagName: typeTag?.name || null,
    categoryName: category?.name || null,
    slotName: slot?.name || null
  };
}

// Создаёт (или переиспользует по названию) категорию/вид/слот/темы и добавляет упражнение
// в d.examples. Возвращает id нового упражнения.
function importExerciseData(d, payload) {
  const categoryId = findOrCreateCategoryByName(d, payload.categoryName);
  const typeTag = findOrCreateTypeTagByName(d, payload.typeTagName, categoryId);
  const slotId = findOrCreateSlotByName(typeTag, payload.slotName);
  const topicTagIds = (payload.topicTagNames || []).map(n => findOrCreateTopicTagByName(d, n));
  const id = uid();
  d.examples.push({
    id,
    typeTagId: typeTag ? typeTag.id : null,
    text: payload.text || "",
    note: payload.note || "",
    redNote: payload.redNote || "",
    topicTagIds,
    attachments: payload.attachments || [],
    slotId: slotId || null,
    richMigrated: true
  });
  return id;
}
function theoryExportData(page, data) {
  return {
    title: page.title || "",
    html: page.html || "",
    attachments: page.attachments || [],
    diagrams: page.diagrams || [],
    topicTagNames: (page.topicTagIds || []).map(id => data.tags.topic.find(t => t.id === id)?.name).filter(Boolean)
  };
}
function importTheoryData(d, payload) {
  const topicTagIds = (payload.topicTagNames || []).map(n => findOrCreateTopicTagByName(d, n));
  const id = uid();
  d.theory.push({
    id,
    title: payload.title || "",
    html: payload.html || "",
    attachments: payload.attachments || [],
    diagrams: payload.diagrams || [],
    topicTagIds,
    classTags: [],
    courseTagIds: []
  });
  return id;
}

// Урок целиком: тема, теги, все прикреплённые упражнения/теория (со всем их содержимым —
// на случай, если на другом компьютере их ещё нет в банке) и домашнее задание.
function lessonExportPayload(lesson, data) {
  const mapItem = it => {
    if (it.type === "exercise") {
      const ex = data.examples.find(e => e.id === it.refId);
      if (!ex) return null;
      return {
        type: "exercise",
        exercise: exerciseExportData(ex, data),
        students: itemStudents(it).map(s => ({
          name: s.name || "",
          grade: s.grade || "",
          gradeScale: s.gradeScale || "",
          gradeExcused: s.gradeExcused ?? null
        }))
      };
    }
    if (it.type === "theory") {
      const p = data.theory.find(t => t.id === it.refId);
      return p ? {
        type: "theory",
        theory: theoryExportData(p, data)
      } : null;
    }
    return null;
  };
  return {
    type: "literature-constructor-lesson",
    version: 1,
    exportedAt: new Date().toISOString(),
    topic: lesson.topic || "",
    topicTagNames: (lesson.topicTagIds || []).map(id => data.tags.topic.find(t => t.id === id)?.name).filter(Boolean),
    lessonTypeTagNames: (lesson.lessonTypeTagIds || []).map(id => data.tags.lessonType.find(t => t.id === id)?.name).filter(Boolean),
    items: (lesson.items || []).map(mapItem).filter(Boolean),
    homework: lesson.homework || "",
    homeworkItems: (lesson.homeworkItems || []).map(it => {
      const ex = data.examples.find(e => e.id === it.refId);
      return ex ? {
        exercise: exerciseExportData(ex, data)
      } : null;
    }).filter(Boolean),
    homeworkAttachments: lesson.homeworkAttachments || []
  };
}

// Создаёт новый урок в текущем классе/литере (или курсе/подгруппе) из импортированного файла,
// пересоздавая вложенные упражнения/теорию в банке (по названиям категорий/тегов).
function importLessonData(d, payload, {
  kind,
  value,
  classLetterId
}) {
  const newId = createSingleLesson(d, {
    kind,
    value,
    classLetterId,
    topic: payload.topic || ""
  });
  const lesson = d.lessons.find(l => l.id === newId);
  lesson.topicTagIds = (payload.topicTagNames || []).map(n => findOrCreateTopicTagByName(d, n));
  lesson.lessonTypeTagIds = (payload.lessonTypeTagNames || []).map(n => findOrCreateLessonTypeTagByName(d, n));
  lesson.items = (payload.items || []).map(it => {
    if (it.type === "exercise" && it.exercise) {
      const refId = importExerciseData(d, it.exercise);
      const legacyStudents = Array.isArray(it.students) ? it.students : it.student ? [{
        name: it.student,
        grade: it.grade,
        gradeScale: it.gradeScale,
        gradeExcused: it.gradeExcused
      }] : [];
      const students = legacyStudents.map(s => ({
        id: uid(),
        name: s.name || "",
        grade: s.grade || "",
        gradeScale: s.gradeScale || "",
        gradeExcused: s.gradeExcused ?? null,
        markId: null
      }));
      return {
        id: uid(),
        type: "exercise",
        refId,
        students
      };
    }
    if (it.type === "theory" && it.theory) {
      const refId = importTheoryData(d, it.theory);
      return {
        id: uid(),
        type: "theory",
        refId
      };
    }
    return null;
  }).filter(Boolean);
  lesson.homework = payload.homework || "";
  lesson.homeworkItems = (payload.homeworkItems || []).map(it => it.exercise ? {
    id: uid(),
    refId: importExerciseData(d, it.exercise)
  } : null).filter(Boolean);
  lesson.homeworkAttachments = payload.homeworkAttachments || [];
  return newId;
}

// Ищет свободное место для ученика, которого потребовалось "подвинуть" (например, при
// свапе местами во время drag-and-drop) — сперва в его исходном ряду, потом в любом другом.
function placeInFirstEmptySeat(layout, studentId, preferFileIdx) {
  const order = [preferFileIdx, ...[0, 1, 2].filter(i => i !== preferFileIdx)];
  for (const fi of order) {
    for (const desk of layout.files[fi]) {
      const si = desk.seats.findIndex(s => !s);
      if (si !== -1) {
        desk.seats[si] = studentId;
        return;
      }
    }
  }
  layout.files[preferFileIdx].push({
    id: uid(),
    seats: [studentId, null]
  });
}
function buildSeatingLayoutHtml(layout, nameById, small) {
  const cols = layout.files.map((file, fi) => {
    const deskRows = file.map((desk, di) => {
      const names = desk.seats.map(s => s ? escapeHtml(nameById(s)) : "&nbsp;");
      return `<div style="border:1px solid #999;border-radius:4px;padding:${small ? "2px 4px" : "6px 10px"};margin-bottom:${small ? 2 : 6}px;font-size:${small ? 8 : 13}px;min-height:${small ? 14 : 34}px;display:flex;justify-content:space-between;">
            <span style="color:#aaa;font-size:${small ? 6 : 10}px;margin-right:4px;">${di + 1}</span>
            <span style="flex:1;">${names[0]}<br/>${names[1]}</span>
          </div>`;
    }).join("");
    return `<div style="flex:1;padding:0 ${small ? 3 : 8}px;min-width:0;">
        <div style="text-align:center;font-weight:bold;font-size:${small ? 8 : 12}px;margin-bottom:${small ? 2 : 6}px;">${escapeHtml(SEATING_FILE_LABELS[fi])}</div>
        ${deskRows}
      </div>`;
  }).join("");
  return `<div style="border:2px solid #333;padding:${small ? 6 : 16}px;${small ? "width:250px;display:inline-block;vertical-align:top;margin:6px;" : ""}">
    <div style="text-align:center;font-weight:bold;background:#333;color:#fff;padding:${small ? 4 : 10}px;border-radius:4px;margin-bottom:${small ? 6 : 14}px;font-size:${small ? 9 : 15}px;">ДОСКА</div>
    <div style="display:flex;">${cols}</div>
  </div>`;
}
function SeatingChart({
  data,
  update,
  kind,
  value,
  classLetterId,
  students,
  deleteStudent,
  renameStudent,
  groupLabel,
  onOpenStudent
}) {
  const [addingAt, setAddingAt] = useState(null); // {fi,di,si}
  const [addingName, setAddingName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renamingName, setRenamingName] = useState("");
  const [visionStudentId, setVisionStudentId] = useState("");
  const [visionMaxRow, setVisionMaxRow] = useState(1);
  const [furtherStudentId, setFurtherStudentId] = useState("");
  const importFileRef = useRef(null);
  const existingLayout = getSeatingLayout(data, kind, value, classLetterId);
  const layout = existingLayout ? JSON.parse(JSON.stringify(existingLayout)) : {
    files: [[], [], []],
    visionLimits: [],
    seatFurther: []
  };
  ensureSeatingCapacity(layout);
  const nameById = id => students.find(s => s.id === id)?.name || "";
  const seatedIds = new Set();
  layout.files.forEach(file => file.forEach(desk => desk.seats.forEach(s => s && seatedIds.add(s))));
  const unseated = students.filter(s => !seatedIds.has(s.id));
  const withLayout = fn => update(d => {
    const l = getOrCreateSeatingLayout(d, kind, value, classLetterId);
    fn(l, d);
    ensureSeatingCapacity(l);
    return d;
  });
  const moveStudentToSeat = (studentId, fileIdx, deskIdx, seatIdx) => {
    withLayout(l => {
      let sourcePos = null;
      l.files.forEach((file, fi) => file.forEach((desk, di) => desk.seats.forEach((s, si) => {
        if (s === studentId) sourcePos = {
          fi,
          di,
          si
        };
      })));
      const desk = l.files[fileIdx][deskIdx];
      if (!desk) return;
      const displaced = desk.seats[seatIdx];
      desk.seats[seatIdx] = studentId;
      if (sourcePos) {
        const isSameSeat = sourcePos.fi === fileIdx && sourcePos.di === deskIdx && sourcePos.si === seatIdx;
        if (!isSameSeat) {
          l.files[sourcePos.fi][sourcePos.di].seats[sourcePos.si] = null;
          if (displaced && displaced !== studentId) placeInFirstEmptySeat(l, displaced, sourcePos.fi);
        }
      } else if (displaced && displaced !== studentId) {
        placeInFirstEmptySeat(l, displaced, fileIdx);
      }
    });
  };
  const addStudentAtSeat = (fileIdx, deskIdx, seatIdx, name) => {
    if (!name.trim()) return;
    const newId = uid();
    update(d => {
      d.students.push({
        id: newId,
        name: name.trim(),
        class: kind === "class" ? value : null,
        courseId: kind === "course" ? value : null,
        classLetterId: kind === "class" && classLetterId ? classLetterId : null,
        courseSubgroupId: kind === "course" && classLetterId ? classLetterId : null
      });
      const l = getOrCreateSeatingLayout(d, kind, value, classLetterId);
      const desk = l.files[fileIdx][deskIdx];
      if (desk) desk.seats[seatIdx] = newId;
      ensureSeatingCapacity(l);
      return d;
    });
    setAddingAt(null);
    setAddingName("");
  };
  const seatUnseated = studentId => {
    withLayout(l => placeInFirstEmptySeat(l, studentId, 0));
  };
  const handleDrop = (e, fileIdx, deskIdx, seatIdx) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData("text/plain");
    if (studentId) moveStudentToSeat(studentId, fileIdx, deskIdx, seatIdx);
  };
  const addVisionLimit = () => {
    if (!visionStudentId) return;
    const sid = visionStudentId;
    const row = Math.max(1, +visionMaxRow || 1);
    withLayout(l => {
      l.visionLimits = (l.visionLimits || []).filter(v => v.studentId !== sid);
      l.visionLimits.push({
        studentId: sid,
        maxRow: row
      });
    });
    setVisionStudentId("");
    setVisionMaxRow(1);
  };
  const removeVisionLimit = studentId => {
    withLayout(l => {
      l.visionLimits = (l.visionLimits || []).filter(v => v.studentId !== studentId);
    });
  };
  const addSeatFurther = () => {
    if (!furtherStudentId) return;
    const sid = furtherStudentId;
    withLayout(l => {
      l.seatFurther = Array.from(new Set([...(l.seatFurther || []), sid]));
    });
    setFurtherStudentId("");
  };
  const removeSeatFurther = studentId => {
    withLayout(l => {
      l.seatFurther = (l.seatFurther || []).filter(id => id !== studentId);
    });
  };
  const randomizeSeating = () => {
    if (students.length === 0) return;
    if (!window.confirm("Рассадить учеников случайным образом? Текущая рассадка будет заменена.")) return;
    withLayout(l => {
      const allIds = students.map(s => s.id);
      const desksPerFile = Math.max(1, Math.ceil(allIds.length / 3 / 2));
      l.files = [0, 1, 2].map(() => Array.from({
        length: desksPerFile
      }, () => ({
        id: uid(),
        seats: [null, null]
      })));
      const visionMap = new Map((l.visionLimits || []).map(v => [v.studentId, v.maxRow]));
      const furtherSet = new Set(l.seatFurther || []);
      const visionStudents = shuffleArray(allIds.filter(id => visionMap.has(id)));
      const furtherStudents = shuffleArray(allIds.filter(id => !visionMap.has(id) && furtherSet.has(id)));
      const restStudents = shuffleArray(allIds.filter(id => !visionMap.has(id) && !furtherSet.has(id)));
      const freeSeats = () => {
        const arr = [];
        l.files.forEach((file, fi) => file.forEach((desk, di) => desk.seats.forEach((s, si) => {
          if (!s) arr.push({
            fi,
            di,
            si,
            depth: di + 1
          });
        })));
        return arr;
      };
      visionStudents.forEach(studentId => {
        const maxRow = visionMap.get(studentId);
        let candidates = freeSeats().filter(p => p.depth <= maxRow);
        if (candidates.length === 0) candidates = freeSeats().sort((a, b) => a.depth - b.depth);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        if (pick) l.files[pick.fi][pick.di].seats[pick.si] = studentId;
      });
      furtherStudents.forEach(studentId => {
        const free = freeSeats().sort((a, b) => b.depth - a.depth);
        if (free.length === 0) return;
        const topDepth = free[0].depth;
        const topCandidates = free.filter(p => p.depth === topDepth);
        const pick = topCandidates[Math.floor(Math.random() * topCandidates.length)];
        l.files[pick.fi][pick.di].seats[pick.si] = studentId;
      });
      restStudents.forEach(studentId => {
        const free = freeSeats();
        if (free.length === 0) return;
        const pick = free[Math.floor(Math.random() * free.length)];
        l.files[pick.fi][pick.di].seats[pick.si] = studentId;
      });
    });
  };
  const exportLayout = () => {
    const bigHtml = `<div style="page-break-after:always;">${buildSeatingLayoutHtml(layout, nameById, false)}</div>`;
    const smallCopies = Array.from({
      length: 6
    }, () => buildSeatingLayoutHtml(layout, nameById, true)).join("");
    downloadWord(`Рассадка ${groupLabel}`, `Рассадка — ${groupLabel}`, bigHtml + smallCopies);
  };
  const exportList = () => {
    const payload = {
      type: "literature-constructor-seating",
      version: 1,
      exportedAt: new Date().toISOString(),
      groupLabel,
      files: layout.files.map((file, fi) => ({
        label: SEATING_FILE_LABELS[fi],
        desks: file.map(desk => ({
          seats: desk.seats.map(id => id ? nameById(id) : null)
        }))
      })),
      visionLimits: (layout.visionLimits || []).map(v => ({
        name: nameById(v.studentId),
        maxRow: v.maxRow
      })).filter(v => v.name),
      seatFurther: (layout.seatFurther || []).map(nameById).filter(Boolean)
    };
    downloadJson(`Рассадка ${groupLabel}`, payload);
  };
  const importList = async file => {
    let payload;
    try {
      payload = JSON.parse(await readTextFile(file));
    } catch (e) {
      alert("Не удалось прочитать файл — это не корректный JSON.");
      return;
    }
    if (!payload || payload.type !== "literature-constructor-seating" || !Array.isArray(payload.files)) {
      alert("Файл не похож на экспортированный список рассадки.");
      return;
    }
    if (!window.confirm("Импортировать рассадку? Текущая рассадка для этой литеры/подгруппы будет заменена.")) return;
    update(d => {
      const findOrCreate = name => {
        if (!name) return null;
        const trimmed = String(name).trim();
        if (!trimmed) return null;
        let s = d.students.find(x => x.name.trim().toLowerCase() === trimmed.toLowerCase() && (kind === "class" ? x.class === value && !x.courseId && (x.classLetterId || null) === (classLetterId || null) : x.courseId === value && (x.courseSubgroupId || null) === (classLetterId || null)));
        if (!s) {
          s = {
            id: uid(),
            name: trimmed,
            class: kind === "class" ? value : null,
            courseId: kind === "course" ? value : null,
            classLetterId: kind === "class" && classLetterId ? classLetterId : null,
            courseSubgroupId: kind === "course" && classLetterId ? classLetterId : null
          };
          d.students.push(s);
        }
        return s.id;
      };
      const l = getOrCreateSeatingLayout(d, kind, value, classLetterId);
      l.files = [0, 1, 2].map(fi => {
        const src = payload.files[fi];
        if (!src || !Array.isArray(src.desks)) return [];
        return src.desks.map(desk => ({
          id: uid(),
          seats: [findOrCreate(desk.seats?.[0]), findOrCreate(desk.seats?.[1])]
        }));
      });
      l.visionLimits = (payload.visionLimits || []).map(v => ({
        studentId: findOrCreate(v.name),
        maxRow: Math.max(1, +v.maxRow || 1)
      })).filter(v => v.studentId);
      l.seatFurther = (payload.seatFurther || []).map(findOrCreate).filter(Boolean);
      ensureSeatingCapacity(l);
      return d;
    });
  };
  const visionCandidates = students.filter(s => !(layout.visionLimits || []).some(v => v.studentId === s.id));
  const furtherCandidates = students.filter(s => !(layout.seatFurther || []).includes(s.id));
  const seatBoxStyle = filled => ({
    border: filled ? `1.5px solid ${THEME.border}` : "1.5px dashed #b9c6d4",
    borderRadius: 7,
    background: filled ? "#fff" : "#f6f8fb",
    padding: "5px 7px",
    fontSize: 12.5,
    minHeight: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: filled ? "space-between" : "center",
    gap: 4,
    cursor: filled ? "grab" : "pointer",
    color: filled ? THEME.panelText : "#93a2b1"
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      display: "grid",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: THEME.goldDim
    }
  }, "\uD83D\uDC41 \u041E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u043F\u043E \u0437\u0440\u0435\u043D\u0438\u044E (\u043D\u0435 \u0434\u0430\u043B\u0435\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0439 \u043F\u0430\u0440\u0442\u044B \u043E\u0442 \u0434\u043E\u0441\u043A\u0438)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, (layout.visionLimits || []).map(v => /*#__PURE__*/React.createElement(LetterChip, {
    key: v.studentId,
    label: `${nameById(v.studentId)} · не далее ${v.maxRow} парты`,
    active: true,
    onRemove: () => removeVisionLimit(v.studentId)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: visionStudentId,
    onChange: e => setVisionStudentId(e.target.value),
    style: {
      ...inputStyle,
      maxWidth: 200,
      padding: "5px 8px",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0443\u0447\u0435\u043D\u0438\u043A\u0430\u2026"), visionCandidates.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: THEME.goldDim
    }
  }, "\u043D\u0435 \u0434\u0430\u043B\u0435\u0435 \u043F\u0430\u0440\u0442\u044B \u2116"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    value: visionMaxRow,
    onChange: e => setVisionMaxRow(e.target.value),
    style: {
      ...inputStyle,
      maxWidth: 60,
      padding: "5px 8px",
      fontSize: 12.5
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addVisionLimit
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: THEME.goldDim
    }
  }, "\u2194 \u0416\u0435\u043B\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u0441\u0430\u0434\u0438\u0442\u044C \u043F\u043E\u0434\u0430\u043B\u044C\u0448\u0435"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, (layout.seatFurther || []).map(sid => /*#__PURE__*/React.createElement(LetterChip, {
    key: sid,
    label: nameById(sid),
    active: true,
    onRemove: () => removeSeatFurther(sid)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: furtherStudentId,
    onChange: e => setFurtherStudentId(e.target.value),
    style: {
      ...inputStyle,
      maxWidth: 200,
      padding: "5px 8px",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0443\u0447\u0435\u043D\u0438\u043A\u0430\u2026"), furtherCandidates.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name))), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addSeatFurther
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C")))), unseated.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      padding: "10px 14px",
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: THEME.goldDim
    }
  }, "\u041D\u0435 \u0440\u0430\u0441\u0441\u0430\u0436\u0435\u043D\u044B (\u043D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0441\u0430\u0434\u0438\u0442\u044C \u043D\u0430 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0435 \u043C\u0435\u0441\u0442\u043E, \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u043D\u0430 \u043F\u0430\u0440\u0442\u0443):"), unseated.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    draggable: true,
    onDragStart: e => e.dataTransfer.setData("text/plain", s.id),
    onClick: () => seatUnseated(s.id),
    style: {
      ...cardStyle,
      cursor: "grab",
      padding: "4px 10px",
      fontSize: 12.5,
      fontWeight: 700
    }
  }, s.name))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontWeight: 900,
      letterSpacing: 1,
      background: THEME.bgDark,
      color: "#fff",
      borderRadius: 8,
      padding: "8px 0",
      fontSize: 13
    }
  }, "\u0414\u041E\u0421\u041A\u0410"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16
    }
  }, layout.files.map((file, fi) => /*#__PURE__*/React.createElement("div", {
    key: fi,
    style: {
      flex: 1,
      display: "grid",
      gap: 6,
      alignContent: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontSize: 11.5,
      fontWeight: 700,
      color: THEME.goldDim
    }
  }, SEATING_FILE_LABELS[fi]), file.map((desk, di) => /*#__PURE__*/React.createElement("div", {
    key: desk.id,
    style: {
      display: "flex",
      gap: 4,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "#b3bec9",
      width: 12,
      textAlign: "right"
    }
  }, di + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 4
    }
  }, desk.seats.map((sid, si) => {
    const isAdding = addingAt && addingAt.fi === fi && addingAt.di === di && addingAt.si === si;
    const isRenaming = sid && renamingId === sid;
    if (isAdding) {
      return /*#__PURE__*/React.createElement("input", {
        key: si,
        autoFocus: true,
        value: addingName,
        placeholder: "\u0418\u043C\u044F",
        onChange: e => setAddingName(e.target.value),
        onKeyDown: e => {
          if (e.key === "Enter") addStudentAtSeat(fi, di, si, addingName);
          if (e.key === "Escape") {
            setAddingAt(null);
            setAddingName("");
          }
        },
        onBlur: () => addingName.trim() ? addStudentAtSeat(fi, di, si, addingName) : (setAddingAt(null), setAddingName("")),
        style: {
          ...inputStyle,
          padding: "5px 7px",
          fontSize: 12.5,
          minHeight: 30,
          boxSizing: "border-box"
        }
      });
    }
    if (isRenaming) {
      return /*#__PURE__*/React.createElement("input", {
        key: si,
        autoFocus: true,
        value: renamingName,
        onChange: e => setRenamingName(e.target.value),
        onKeyDown: e => {
          if (e.key === "Enter") {
            renameStudent(sid, renamingName);
            setRenamingId(null);
          }
          if (e.key === "Escape") setRenamingId(null);
        },
        onBlur: () => {
          if (renamingName.trim()) renameStudent(sid, renamingName);
          setRenamingId(null);
        },
        style: {
          ...inputStyle,
          padding: "5px 7px",
          fontSize: 12.5,
          minHeight: 30,
          boxSizing: "border-box"
        }
      });
    }
    return /*#__PURE__*/React.createElement("div", {
      key: si,
      style: seatBoxStyle(!!sid),
      draggable: !!sid,
      onDragStart: e => sid && e.dataTransfer.setData("text/plain", sid),
      onDragOver: e => e.preventDefault(),
      onDrop: e => handleDrop(e, fi, di, si),
      onClick: () => {
        if (!sid) {
          setAddingAt({
            fi,
            di,
            si
          });
          setAddingName("");
        }
      },
      onDoubleClick: () => {
        if (sid) {
          setRenamingId(sid);
          setRenamingName(nameById(sid));
        }
      },
      title: sid ? "Клик — карточка ученика · перетащите, чтобы пересадить · двойной клик — переименовать" : "Нажмите, чтобы добавить ученика"
    }, sid ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      onClick: e => {
        e.stopPropagation();
        onOpenStudent && onOpenStudent(sid);
      },
      style: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "pointer"
      }
    }, nameById(sid)), /*#__PURE__*/React.createElement("span", {
      onClick: e => {
        e.stopPropagation();
        deleteStudent(sid);
      },
      style: {
        cursor: "pointer",
        color: THEME.red,
        fontWeight: 900,
        flexShrink: 0
      }
    }, "\xD7")) : "+");
  })))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: randomizeSeating
  }, "\uD83C\uDFB2 \u041F\u0440\u043E\u0438\u0437\u0432\u043E\u043B\u044C\u043D\u0430\u044F \u0440\u0430\u0441\u0441\u0430\u0434\u043A\u0430"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    onClick: exportLayout
  }, "\uD83D\uDDA8 \u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0430\u043A\u0435\u0442"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    onClick: exportList
  }, "\u2B07 \u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    onClick: () => importFileRef.current?.click()
  }, "\u2B06 \u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A"), /*#__PURE__*/React.createElement("input", {
    ref: importFileRef,
    type: "file",
    accept: ".json,application/json",
    style: {
      display: "none"
    },
    onChange: e => {
      const file = e.target.files?.[0];
      if (file) importList(file);
      e.target.value = "";
    }
  })));
}

// Окно «Печать / скачать»: один элемент урока (упражнение, теория, текст ДЗ) в N копиях на листе A4.
function PrintElementModal({
  data,
  lesson,
  target,
  onClose
}) {
  const cl = data.worksheetChecklist || defaultWorksheetChecklist();
  const [copies, setCopies] = useState(2);
  const [fontPx, setFontPx] = useState(14);
  const [showNote, setShowNote] = useState(!cl.hideNotes);
  const [showRed, setShowRed] = useState(!cl.hideRedFlags);
  const [showType, setShowType] = useState(!cl.hideExerciseType);
  const [overflow, setOverflow] = useState(false);
  const previewRef = useRef(null);
  const ex = target.kind === "exercise" ? data.examples.find(e => e.id === target.id) : null;
  const page = target.kind === "theory" ? data.theory.find(p => p.id === target.id) : null;
  let title = "Материал";
  let contentHtml = "";
  if (ex) {
    title = stripHtml(ex.text).slice(0, 50) || "Упражнение";
    contentHtml = exerciseWorksheetHtml(ex, data, {
      hideNotes: !showNote,
      hideRedFlags: !showRed,
      hideExerciseType: !showType,
      hideExerciseTopics: true
    });
  } else if (page) {
    title = page.title || "Теория";
    contentHtml = theoryPageToHtml(page) + (page.diagrams || []).map(dg => diagramToHtmlWithImage(dg)).join("");
  } else if (target.kind === "homeworkText") {
    title = "Домашнее задание";
    contentHtml = `<div style="font-weight:bold;">${nl2br(escapeHtml(lesson.homework || ""))}</div>`;
  }
  useEffect(() => {
    const cells = previewRef.current ? Array.from(previewRef.current.querySelectorAll(".lc-card-cell")) : [];
    setOverflow(cells.some(c => c.scrollHeight > c.clientHeight + 2));
  }, [copies, fontPx, showNote, showRed, showType, contentHtml]);
  const wordPage = () => cardsPageHtml(contentHtml, copies, fontPx, false);
  const doPrint = () => printCardsPdf(cardsPageHtml(contentHtml, copies, fontPx, false));
  const doWord = () => downloadWord(sanitizeFileName(title), title, wordPage(), {
    noTitle: true,
    pageCss: CARDS_WORD_PAGE_CSS
  });
  const chip = active => ({
    padding: "8px 14px",
    borderRadius: 10,
    border: `1.5px solid ${active ? THEME.bgDark : THEME.border}`,
    background: active ? THEME.pastel : "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13.5
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 16,
      padding: 20,
      width: "min(820px, 96vw)",
      maxHeight: "92vh",
      overflow: "auto",
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: "#12233a",
      margin: 0
    }
  }, "\u041F\u0435\u0447\u0430\u0442\u044C \u0438 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#7a8a9c",
      marginTop: 2
    }
  }, title)), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 18,
      flexWrap: "wrap",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "1 1 260px",
      display: "grid",
      gap: 12,
      minWidth: 240
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: THEME.goldDim,
      marginBottom: 6
    }
  }, "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0437 \u043D\u0430 \u043E\u0434\u043D\u043E\u043C \u043B\u0438\u0441\u0442\u0435 A4"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, Object.keys(CARD_LAYOUTS).map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: chip(copies === +n),
    onClick: () => setCopies(+n),
    title: `${CARD_LAYOUTS[n][0]} × ${CARD_LAYOUTS[n][1]}`
  }, n)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: THEME.goldDim,
      marginBottom: 6
    }
  }, "\u0420\u0430\u0437\u043C\u0435\u0440 \u0442\u0435\u043A\u0441\u0442\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, [11, 12, 14, 16, 18, 22].map(px => /*#__PURE__*/React.createElement("span", {
    key: px,
    style: chip(fontPx === px),
    onClick: () => setFontPx(px)
  }, px)))), ex && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: showNote,
    onChange: e => setShowNote(e.target.checked)
  }), " \u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: showRed,
    onChange: e => setShowRed(e.target.checked)
  }), " \u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043A\u0440\u0430\u0441\u043D\u0443\u044E \u0437\u0430\u043C\u0435\u0442\u043A\u0443 (\u2691)"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: showType,
    onChange: e => setShowType(e.target.checked)
  }), " \u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \xAB\u0422\u0438\u043F: \u2026\xBB")), overflow && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.red,
      background: THEME.redBg,
      borderRadius: 8,
      padding: "8px 10px",
      lineHeight: 1.45
    }
  }, "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B \u043D\u0435 \u043F\u043E\u043C\u0435\u0449\u0430\u0435\u0442\u0441\u044F \u0432 \u043E\u0434\u043D\u0443 \u044F\u0447\u0435\u0439\u043A\u0443: \u0447\u0430\u0441\u0442\u044C \u0442\u0435\u043A\u0441\u0442\u0430 \u043E\u0431\u0440\u0435\u0436\u0435\u0442\u0441\u044F. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 \u043A\u043E\u043F\u0438\u0439 \u043D\u0430 \u043B\u0438\u0441\u0442\u0435 \u0438\u043B\u0438 \u043C\u0435\u043D\u044C\u0448\u0438\u0439 \u0440\u0430\u0437\u043C\u0435\u0440 \u0442\u0435\u043A\u0441\u0442\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    onClick: doPrint
  }, "\uD83D\uDDA8 \u041F\u0435\u0447\u0430\u0442\u044C / PDF"), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    onClick: doWord
  }, "\uD83D\uDCC4 \u0421\u043A\u0430\u0447\u0430\u0442\u044C Word")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#7a8a9c",
      lineHeight: 1.5
    }
  }, "\u041A\u043E\u043F\u0438\u0438 \u043D\u0430 \u043B\u0438\u0441\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u0435\u043D\u044B \u043F\u0443\u043D\u043A\u0442\u0438\u0440\u043D\u044B\u043C\u0438 \u043B\u0438\u043D\u0438\u044F\u043C\u0438 \u2014 \u043F\u043E \u043D\u0438\u043C \u0443\u0434\u043E\u0431\u043D\u043E \u0440\u0435\u0437\u0430\u0442\u044C. \u0412 \u043E\u043A\u043D\u0435 \u043F\u0435\u0447\u0430\u0442\u0438 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \xAB\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A PDF\xBB, \u0435\u0441\u043B\u0438 \u043D\u0443\u0436\u0435\u043D \u0444\u0430\u0439\u043B.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: THEME.goldDim,
      marginBottom: 6
    }
  }, "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043B\u0438\u0441\u0442\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${THEME.border}`,
      background: "#fff",
      boxShadow: "0 2px 10px rgba(19,44,83,0.15)",
      width: 330,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: previewRef,
    style: {
      zoom: 0.4,
      width: "210mm",
      padding: "8mm",
      fontFamily: BODY_FONT,
      color: "#12233a"
    },
    dangerouslySetInnerHTML: {
      __html: cardsPageHtml(contentHtml, copies, fontPx, true)
    }
  }))))));
}
const WORKSHEET_CHECKLIST_ITEMS = [{
  key: "hideNotes",
  label: "Примечания к упражнениям"
}, {
  key: "hideRedFlags",
  label: "Красные заметки (⚑, «для обозначения на уроке»)"
}, {
  key: "hideExerciseType",
  label: "Строка «Тип: …» у упражнения"
}, {
  key: "hideExerciseTopics",
  label: "Темы упражнения (теги)"
}, {
  key: "hideLessonTopics",
  label: "Темы урока (теги)"
}, {
  key: "hideLessonType",
  label: "Тип урока (тег)"
}, {
  key: "hideDates",
  label: "Плановая/фактическая дата урока"
}];

// Настраивается один раз и применяется ко всем урокам при формировании черновика рабочего
// листа — но ничего не мешает потом вручную вернуть/убрать что-то прямо в редакторе.
function WorksheetChecklistModal({
  checklist,
  update,
  onClose
}) {
  const toggle = key => {
    update(d => {
      d.worksheetChecklist = {
        ...d.worksheetChecklist,
        [key]: !d.worksheetChecklist[key]
      };
      return d;
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1250,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 16,
      padding: 22,
      width: "min(460px, 95vw)",
      maxHeight: "85vh",
      overflow: "auto",
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Heading, {
    size: 17,
    style: {
      color: "#12233a",
      margin: 0
    }
  }, "\u0427\u0435\u043A-\u043B\u0438\u0441\u0442 \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u043B\u0438\u0441\u0442\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#7a8a9c",
      marginTop: 2
    }
  }, "\u041E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u043E\u0435 \u0443\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u0440\u0438 \u043D\u0430\u0436\u0430\u0442\u0438\u0438 \xAB\u0421\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u043B\u0438\u0441\u0442\xBB \u2014 \u0434\u043B\u044F \u0432\u0441\u0435\u0445 \u0443\u0440\u043E\u043A\u043E\u0432 \u0441\u0440\u0430\u0437\u0443. \u0412\u0440\u0443\u0447\u043D\u0443\u044E \u0432 \u0441\u0430\u043C\u043E\u043C \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435 \u043C\u043E\u0436\u043D\u043E \u0438 \u0432\u0435\u0440\u043D\u0443\u0442\u044C, \u0438 \u0443\u0431\u0440\u0430\u0442\u044C \u0447\u0442\u043E-\u0442\u043E \u0435\u0449\u0451.")), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, WORKSHEET_CHECKLIST_ITEMS.map(item => /*#__PURE__*/React.createElement("label", {
    key: item.key,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!checklist[item.key],
    onChange: () => toggle(item.key)
  }), "\u0423\u0431\u0438\u0440\u0430\u0442\u044C: ", item.label)))));
}

// Промежуточный шаг перед отправкой ученику: учительский конспект урока (материалы + заметки +
// ответы) открывается как редактируемый текст, чтобы убрать всё, что не для ученика, и
// поправить формулировки — и только после сохранения содержимое реально уходит в файл.
function WorksheetEditorModal({
  studentName,
  initialHtml,
  onSend,
  onClose
}) {
  const [sending, setSending] = useState(false);
  const editorRef = useRef(null);
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const exec = cmd => {
    document.execCommand(cmd, false, null);
    editorRef.current?.focus();
  };
  const send = async () => {
    setSending(true);
    const ok = await onSend(editorRef.current.innerHTML);
    setSending(false);
    if (ok) onClose();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 16,
      padding: 22,
      width: "min(760px, 95vw)",
      maxHeight: "90vh",
      overflow: "auto",
      display: "grid",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: "#12233a",
      margin: 0
    }
  }, "\u0420\u0430\u0431\u043E\u0447\u0438\u0439 \u043B\u0438\u0441\u0442 \u0434\u043B\u044F \u0443\u0447\u0435\u043D\u0438\u043A\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#7a8a9c",
      marginTop: 2
    }
  }, studentName ? `Кому: ${studentName}. ` : "", "\u0423\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0441\u0451, \u0447\u0442\u043E \u043D\u0435 \u043F\u0440\u0435\u0434\u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E \u0434\u043B\u044F \u0443\u0447\u0435\u043D\u0438\u043A\u0430 (\u043E\u0442\u0432\u0435\u0442\u044B, \u0437\u0430\u043C\u0435\u0442\u043A\u0438), \u0438 \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u043F\u043E\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0442\u0435\u043A\u0441\u0442.")), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flexWrap: "wrap",
      background: "#dfeaf3",
      padding: "5px 6px",
      borderRadius: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("bold")
  }, /*#__PURE__*/React.createElement("b", null, "\u0416")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("italic")
  }, /*#__PURE__*/React.createElement("i", null, "\u041A")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("underline")
  }, /*#__PURE__*/React.createElement("u", null, "\u0427")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("strikeThrough")
  }, /*#__PURE__*/React.createElement("s", null, "\u0417")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("insertUnorderedList")
  }, "\u2022 \u0421\u043F\u0438\u0441\u043E\u043A"), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 18,
      background: "#b9cfe0",
      margin: "0 2px"
    }
  }), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("removeFormat")
  }, "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0444\u043E\u0440\u043C\u0430\u0442")), /*#__PURE__*/React.createElement("div", {
    ref: editorRef,
    contentEditable: true,
    suppressContentEditableWarning: true,
    className: "lc-worksheet",
    style: {
      minHeight: 320,
      background: "#fff",
      border: "1.5px solid #cfe3f2",
      borderRadius: 8,
      padding: "14px 16px",
      fontSize: 14,
      lineHeight: 1.6,
      color: "#12233a",
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    disabled: sending,
    onClick: send
  }, sending ? "Отправка…" : "📤 Отправить ученику"))));
}

// Карточка ученика: переименование/удаление, папка для автообмена файлами и отправка
// материалов урока прямо в эту папку, плюс список входящих ответов от этого ученика.
function StudentCardModal({
  student,
  data,
  update,
  deleteStudent,
  renameStudent,
  onClose
}) {
  const [name, setName] = useState(student.name);
  const [lessonId, setLessonId] = useState("");
  const [checking, setChecking] = useState(false);
  const [worksheetLesson, setWorksheetLesson] = useState(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const studentGroupId = student.courseId ? student.courseSubgroupId : student.classLetterId;
  const relevantLessons = data.lessons.filter(l => (l.class || null) === (student.class || null) && (l.courseId || null) === (student.courseId || null) && (l.classLetterId || null) === (studentGroupId || null)).sort((a, b) => (b.plannedDate || "").localeCompare(a.plannedDate || "") || (b.order || 0) - (a.order || 0));
  const incoming = (data.incomingAnswers || []).filter(a => a.studentId === student.id);
  const pickFolder = async () => {
    const res = await window.lcAPI.pickExchangeFolder();
    if (!res.ok) return;
    update(d => {
      const s = d.students.find(x => x.id === student.id);
      if (s) s.exchangeFolder = res.path;
      return d;
    });
  };
  const clearFolder = () => {
    update(d => {
      const s = d.students.find(x => x.id === student.id);
      if (s) s.exchangeFolder = null;
      return d;
    });
  };
  const openWorksheet = () => {
    const lesson = data.lessons.find(l => l.id === lessonId);
    if (!lesson) return;
    setWorksheetLesson(lesson);
  };
  const sendWorksheet = async html => {
    const ok = await sendDocToStudent(update, student, worksheetLesson.topic || "Урок", html, {
      lessonId: worksheetLesson.id,
      kind: "lesson"
    });
    if (ok) alert(`Отправлено ученику «${student.name}»: ${worksheetLesson.topic || "Урок"}`);
    return ok;
  };
  const checkNow = async () => {
    setChecking(true);
    const count = await runExchangeCheck(data, update, [student]);
    setChecking(false);
    if (count === 0) alert("Новых файлов не найдено.");
  };
  const openAnswer = a => window.lcAPI.openExchangeFile(student.exchangeFolder, a.fileName);
  const markReviewed = async a => {
    await window.lcAPI.markExchangeReviewed(student.exchangeFolder, a.fileName);
    update(d => {
      d.incomingAnswers = (d.incomingAnswers || []).filter(x => x.id !== a.id);
      return d;
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 16,
      padding: 22,
      width: "min(560px, 95vw)",
      maxHeight: "88vh",
      overflow: "auto",
      display: "grid",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    onBlur: () => renameStudent(student.id, name),
    style: {
      ...inputStyle,
      fontWeight: 800,
      fontSize: 16,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: () => {
      onClose();
      deleteStudent(student.id);
    }
  }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0443\u0447\u0435\u043D\u0438\u043A\u0430"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C")), window.lcShareMode ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#7a8a9c",
      lineHeight: 1.5
    }
  }, "\uD83D\uDCC1 \u041D\u0430 \u043F\u043B\u0430\u043D\u0448\u0435\u0442\u0435 \u043F\u0430\u043F\u043E\u043A \u0430\u0432\u0442\u043E\u043E\u0431\u043C\u0435\u043D\u0430 \u043D\u0435\u0442: \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u043B\u0438\u0441\u0442 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \xAB\u041F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F\xBB (\u0414\u0438\u0441\u043A, Telegram, \u043F\u043E\u0447\u0442\u0430 \u0438 \u0442.\u0434.). \u041F\u0430\u043F\u043A\u0430 \u0443\u0447\u0435\u043D\u0438\u043A\u0430, \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u0430\u044F \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435, \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432 \u043F\u0440\u043E\u0435\u043A\u0442\u0435 \u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0442\u0430\u043C.") : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: window.lcShareMode ? "none" : "grid",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: THEME.goldDim
    }
  }, "\uD83D\uDCC1 \u041F\u0430\u043F\u043A\u0430 \u0434\u043B\u044F \u0430\u0432\u0442\u043E\u043E\u0431\u043C\u0435\u043D\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: student.exchangeFolder ? THEME.panelText : "#93a2b1",
      wordBreak: "break-all"
    }
  }, student.exchangeFolder || "не указана"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: pickFolder
  }, student.exchangeFolder ? "Изменить папку…" : "Выбрать папку…"), student.exchangeFolder && /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: clearFolder
  }, "\u0423\u0431\u0440\u0430\u0442\u044C")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#7a8a9c"
    }
  }, "\u041E\u0431\u044B\u0447\u043D\u0430\u044F \u043F\u0430\u043F\u043A\u0430 \u043D\u0430 \u044D\u0442\u043E\u043C \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0435, \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u0441 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E\u043C \u0443\u0447\u0435\u043D\u0438\u043A\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u0443\u0435\u0442 \u0441\u0442\u043E\u0440\u043E\u043D\u043D\u044F\u044F \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 (\u042F\u043D\u0434\u0435\u043A\u0441.\u0414\u0438\u0441\u043A, Google \u0414\u0438\u0441\u043A \u0438 \u0442.\u043F.).")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: THEME.goldDim
    }
  }, "\uD83D\uDCE4 \u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u0443\u0440\u043E\u043A\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: lessonId,
    onChange: e => setLessonId(e.target.value),
    style: {
      ...inputStyle,
      flex: 1,
      minWidth: 180,
      padding: "6px 8px",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0443\u0440\u043E\u043A\u2026"), relevantLessons.map(l => /*#__PURE__*/React.createElement("option", {
    key: l.id,
    value: l.id
  }, (l.plannedDate ? formatDateRu(l.plannedDate) + " — " : "") + (l.topic || "Без темы")))), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    disabled: !lessonId,
    onClick: openWorksheet
  }, "\uD83D\uDCDD \u0421\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u043B\u0438\u0441\u0442"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    title: "\u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u0447\u0435\u043A-\u043B\u0438\u0441\u0442 \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u043B\u0438\u0441\u0442\u0430",
    onClick: () => setChecklistOpen(true)
  }, "\u2699"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: THEME.goldDim
    }
  }, "\uD83D\uDCE5 \u0412\u0445\u043E\u0434\u044F\u0449\u0438\u0435 \u043E\u0442\u0432\u0435\u0442\u044B"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2",
      marginLeft: "auto"
    },
    disabled: checking,
    onClick: checkNow
  }, checking ? "Проверка…" : "🔄 Проверить ответы")), incoming.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#93a2b1"
    }
  }, "\u041F\u043E\u043A\u0430 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043F\u043E\u0441\u0442\u0443\u043F\u0430\u043B\u043E.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, incoming.map(a => {
    const lesson = data.lessons.find(l => l.id === a.lessonId);
    return /*#__PURE__*/React.createElement("div", {
      key: a.id,
      style: {
        ...cardStyle,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 140
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 12.5
      }
    }, a.fileName), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#7a8a9c"
      }
    }, lesson ? lesson.topic || "Без темы" : "Урок не определён")), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => openAnswer(a)
    }, "\u041E\u0442\u043A\u0440\u044B\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
      kind: "pastel",
      small: true,
      onClick: () => markReviewed(a)
    }, "\u2713 \u041E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E"));
  })))), worksheetLesson && /*#__PURE__*/React.createElement(WorksheetEditorModal, {
    studentName: student.name,
    initialHtml: lessonWorksheetHtml(worksheetLesson, data, data.worksheetChecklist),
    onSend: sendWorksheet,
    onClose: () => setWorksheetLesson(null)
  }), checklistOpen && /*#__PURE__*/React.createElement(WorksheetChecklistModal, {
    checklist: data.worksheetChecklist,
    update: update,
    onClose: () => setChecklistOpen(false)
  }));
}

// Окно настройки синхронизации с Яндекс.Диском: ID приложения, вход, статус, отключение.
function SyncModal({
  info,
  status,
  error,
  onClose,
  onChanged,
  onSyncNow,
  onDisconnected
}) {
  const [clientId, setClientId] = useState(info.clientId || "");
  const [manualToken, setManualToken] = useState("");
  const [proxy, setProxy] = useState(info.proxyUrl || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const connect = async () => {
    if (!clientId.trim()) {
      setMsg("Вставьте ID приложения (шаг 5 инструкции).");
      return;
    }
    setBusy(true);
    setMsg("");
    await window.lcAPI.syncSetClientId(clientId);
    const r = await window.lcAPI.syncConnect();
    setBusy(false);
    if (r.ok) await onChanged();else if (!r.cancelled) setMsg(r.error || "Не удалось войти");
  };
  const useManualToken = async () => {
    if (!manualToken.trim()) return;
    setBusy(true);
    setMsg("");
    await window.lcAPI.syncSetClientId(clientId);
    const r = await window.lcAPI.syncSetToken(manualToken);
    setBusy(false);
    if (r.ok) {
      setManualToken("");
      await onChanged();
    } else setMsg(r.error || "Токен не подошёл");
  };
  const disconnect = async () => {
    if (!window.confirm("Отключить Яндекс.Диск? Файл на Диске останется, но программа перестанет с ним синхронизироваться.")) return;
    await window.lcAPI.syncDisconnect();
    onDisconnected();
    await onChanged();
  };
  const stepStyle = {
    fontSize: 12.5,
    lineHeight: 1.55,
    marginBottom: 4
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1300,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 16,
      padding: 22,
      width: "min(620px, 95vw)",
      maxHeight: "90vh",
      overflow: "auto",
      display: "grid",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: "#12233a",
      margin: 0
    }
  }, "\u2601 \u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u0447\u0435\u0440\u0435\u0437 \u042F\u043D\u0434\u0435\u043A\u0441.\u0414\u0438\u0441\u043A"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C")), info.connected ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5
    }
  }, "\u042F\u043D\u0434\u0435\u043A\u0441.\u0414\u0438\u0441\u043A \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D.", " ", info.lastSyncAt ? `Последняя синхронизация: ${new Date(info.lastSyncAt).toLocaleString("ru-RU")}.` : "Синхронизаций ещё не было."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#7a8a9c"
    }
  }, "\u0424\u0430\u0439\u043B \u043F\u0440\u043E\u0435\u043A\u0442\u0430 \u043B\u0435\u0436\u0438\u0442 \u043D\u0430 \u0414\u0438\u0441\u043A\u0435 \u0432 \u043F\u0430\u043F\u043A\u0435 \xAB\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F\xBB \u2192 \u043F\u0430\u043F\u043A\u0430 \u0432\u0430\u0448\u0435\u0433\u043E \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F, \u0444\u0430\u0439\u043B lessons.js. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 ~20 \u0441\u0435\u043A\u0443\u043D\u0434 \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438, \u0447\u0443\u0436\u0438\u0435 \u043F\u043E\u0434\u0442\u044F\u0433\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u0440\u0438 \u0437\u0430\u043F\u0443\u0441\u043A\u0435, \u0440\u0430\u0437 \u0432 1,5 \u043C\u0438\u043D\u0443\u0442\u044B \u0438 \u043F\u0440\u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0435 \u0432 \u043E\u043A\u043D\u043E \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B."), status === "error" && error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.red
    }
  }, error), status === "paused" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.red
    }
  }, "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u0434\u043E \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430 (\u0432\u044B \u043E\u0442\u043A\u0430\u0437\u0430\u043B\u0438\u0441\u044C \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0439 \u0444\u0430\u0439\u043B)."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    disabled: status === "syncing",
    onClick: onSyncNow
  }, status === "syncing" ? "Синхронизация…" : "🔄 Синхронизировать сейчас"), /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: disconnect
  }, "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, window.lcRedirectUri && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff8e6",
      borderRadius: 10,
      padding: "12px 14px",
      fontSize: 12.5,
      lineHeight: 1.55
    }
  }, /*#__PURE__*/React.createElement("b", null, "\u0412\u0435\u0440\u0441\u0438\u044F \u0434\u043B\u044F \u043F\u043B\u0430\u043D\u0448\u0435\u0442\u0430."), " \u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0432 \u042F\u043D\u0434\u0435\u043A\u0441\u0435 \u0443\u0436\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u043E \u043D\u0430 \u043D\u043E\u0443\u0442\u0431\u0443\u043A\u0435 \u2014 \u0437\u0434\u0435\u0441\u044C \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u0442 \u0436\u0435 ID. \u041D\u043E \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u043D\u0443\u0436\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u0435\u0433\u043E \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u043D\u0430 oauth.yandex.ru \u0435\u0449\u0451 \u043E\u0434\u0438\u043D Redirect URI (\u043A\u043D\u043E\u043F\u043A\u0430 \xAB+\xBB):", /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "monospace",
      wordBreak: "break-all",
      margin: "6px 0",
      userSelect: "all",
      background: "#fff",
      padding: "6px 8px",
      borderRadius: 6
    }
  }, window.lcRedirectUri), "\u0412\u0445\u043E\u0434 \u043E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u0432 \u044D\u0442\u043E\u043C \u0436\u0435 \u043E\u043A\u043D\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u0438 \u0432\u0435\u0440\u043D\u0451\u0442 \u0432\u0430\u0441 \u043E\u0431\u0440\u0430\u0442\u043D\u043E."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#f6fbfe",
      borderRadius: 10,
      padding: "12px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 6
    }
  }, "\u041E\u0434\u0438\u043D \u0440\u0430\u0437: \u0441\u043E\u0437\u0434\u0430\u0442\u044C \xAB\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435\xBB \u0432 \u042F\u043D\u0434\u0435\u043A\u0441\u0435 (5 \u043C\u0438\u043D\u0443\u0442)"), /*#__PURE__*/React.createElement("div", {
    style: stepStyle
  }, "1. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 oauth.yandex.ru \u0438 \u0432\u043E\u0439\u0434\u0438\u0442\u0435 \u0432 \u0441\u0432\u043E\u0439 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u042F\u043D\u0434\u0435\u043A\u0441\u0430 (\u0442\u043E\u0442, \u0433\u0434\u0435 \u0414\u0438\u0441\u043A)."), /*#__PURE__*/React.createElement("div", {
    style: stepStyle
  }, "2. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435\xBB. \u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u2014 \u043B\u044E\u0431\u043E\u0435, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 \xAB\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0443\u0440\u043E\u043A\u043E\u0432\xBB."), /*#__PURE__*/React.createElement("div", {
    style: stepStyle
  }, "3. \xAB\u041F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F\xBB \u2192 \u043E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \xAB\u0412\u0435\u0431-\u0441\u0435\u0440\u0432\u0438\u0441\u044B\xBB \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u043E\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u044C URL \u0434\u043B\u044F \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0438\xBB (\u043F\u043E\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0441\u044F https://oauth.yandex.ru/verification_code)."), /*#__PURE__*/React.createElement("div", {
    style: stepStyle
  }, "4. \xAB\u0414\u043E\u0441\u0442\u0443\u043F \u043A \u0434\u0430\u043D\u043D\u044B\u043C\xBB \u2192 \u043D\u0430\u0439\u0434\u0438\u0442\u0435 \xAB\u042F\u043D\u0434\u0435\u043A\u0441.\u0414\u0438\u0441\u043A REST API\xBB \u0438 \u043E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \xAB\u0414\u043E\u0441\u0442\u0443\u043F \u043A \u043F\u0430\u043F\u043A\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F\xBB (cloud_api:disk.app_folder). \u0414\u0440\u0443\u0433\u0438\u0435 \u043F\u0440\u0430\u0432\u0430 \u043D\u0435 \u043D\u0443\u0436\u043D\u044B. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u0432\u043E\u044E \u043F\u043E\u0447\u0442\u0443 \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435\xBB."), /*#__PURE__*/React.createElement("div", {
    style: stepStyle
  }, "5. \u0421\u043A\u043E\u043F\u0438\u0440\u0443\u0439\u0442\u0435 \xABID\xBB (Client ID) \u0441\u043E\u0437\u0434\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u0438 \u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043D\u0438\u0436\u0435."), /*#__PURE__*/React.createElement("div", {
    style: stepStyle
  }, "6. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 \u042F\u043D\u0434\u0435\u043A\u0441\xBB \u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0434\u043E\u0441\u0442\u0443\u043F \u0432 \u043E\u0442\u043A\u0440\u044B\u0432\u0448\u0435\u043C\u0441\u044F \u043E\u043A\u043D\u0435.")), /*#__PURE__*/React.createElement(Field, {
    label: "ID \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F (Client ID)"
  }, /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    value: clientId,
    onChange: e => setClientId(e.target.value),
    placeholder: "\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, 3f2a\u2026"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    disabled: busy,
    onClick: connect
  }, busy ? "Подождите…" : "Войти через Яндекс")), /*#__PURE__*/React.createElement("details", null, /*#__PURE__*/React.createElement("summary", {
    style: {
      fontSize: 12,
      color: "#7a8a9c",
      cursor: "pointer"
    }
  }, "\u0415\u0441\u043B\u0438 \u043E\u043A\u043D\u043E \u0432\u0445\u043E\u0434\u0430 \u043D\u0435 \u0437\u0430\u043A\u0440\u044B\u043B\u043E\u0441\u044C \u0441\u0430\u043C\u043E \u2014 \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u043A\u0435\u043D \u0432\u0440\u0443\u0447\u043D\u0443\u044E"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    value: manualToken,
    onChange: e => setManualToken(e.target.value),
    placeholder: "\u0422\u043E\u043A\u0435\u043D \u0441\u043E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u042F\u043D\u0434\u0435\u043A\u0441\u0430"
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    disabled: busy,
    onClick: useManualToken
  }, "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C")))), window.lcShareMode && window.lcAPI.syncSetProxy && /*#__PURE__*/React.createElement("details", {
    open: !info.proxyUrl && status === "error"
  }, /*#__PURE__*/React.createElement("summary", {
    style: {
      fontSize: 12.5,
      color: "#5a6b7d",
      cursor: "pointer"
    }
  }, "\u041F\u043E\u0441\u0440\u0435\u0434\u043D\u0438\u043A \u0434\u043B\u044F \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u044F ", info.proxyUrl ? "(настроен)" : "(нужен, если Яндекс не отдаёт файл браузеру)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#7a8a9c",
      lineHeight: 1.5
    }
  }, "\u0410\u0434\u0440\u0435\u0441 \u0432\u0430\u0448\u0435\u0433\u043E \u043F\u043E\u0441\u0440\u0435\u0434\u043D\u0438\u043A\u0430 \u043D\u0430 Cloudflare Workers (\u0432\u0438\u0434\u0430 https://\u2026workers.dev). \u0427\u0435\u0440\u0435\u0437 \u043D\u0435\u0433\u043E \u043F\u0440\u043E\u0445\u043E\u0434\u0438\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0444\u0430\u0439\u043B \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u0432\u0430\u0448 \u0442\u043E\u043A\u0435\u043D \u042F\u043D\u0434\u0435\u043A\u0441\u0430 \u043E\u043D \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    value: proxy,
    onChange: e => setProxy(e.target.value),
    placeholder: "https://lessons-proxy.\u0432\u0430\u0448\u0435-\u0438\u043C\u044F.workers.dev"
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    onClick: async () => {
      await window.lcAPI.syncSetProxy(proxy);
      await onChanged();
      setMsg("Адрес посредника сохранён. Нажмите «Синхронизировать сейчас».");
    }
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C")))), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.red
    }
  }, msg)));
}

// И на Диске, и здесь есть несохранённые друг для друга изменения — выбираем, какую версию оставить.
function SyncConflictModal({
  onChoose,
  busy
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.85)",
      zIndex: 1400,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 16,
      padding: 24,
      width: "min(560px, 95vw)",
      display: "grid",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: THEME.red,
      margin: 0
    }
  }, "\u0412\u0435\u0440\u0441\u0438\u0438 \u0440\u0430\u0437\u043E\u0448\u043B\u0438\u0441\u044C"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      lineHeight: 1.55
    }
  }, "\u041D\u0430 \u042F\u043D\u0434\u0435\u043A\u0441.\u0414\u0438\u0441\u043A\u0435 \u043B\u0435\u0436\u0438\u0442 \u0432\u0435\u0440\u0441\u0438\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u043D\u0435\u0442 \u043D\u0430 \u044D\u0442\u043E\u043C \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0435, \u0430 \u0437\u0434\u0435\u0441\u044C \u0435\u0441\u0442\u044C \u043F\u0440\u0430\u0432\u043A\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043D\u0435\u0442 \u043D\u0430 \u0414\u0438\u0441\u043A\u0435. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435, \u043A\u0430\u043A\u0443\u044E \u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C. \u0412\u0442\u043E\u0440\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u043D\u0435 \u043F\u0440\u043E\u043F\u0430\u0434\u0451\u0442 \u2014 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442 \u0435\u0451 \u043A\u043E\u043F\u0438\u0435\u0439 \u0432 \u043F\u0430\u043F\u043A\u0435 \u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F (sync-conflicts)."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    disabled: busy,
    onClick: () => onChoose("remote")
  }, "\u0412\u0437\u044F\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E \u0441 \u0414\u0438\u0441\u043A\u0430 (\u043C\u043E\u0438 \u043F\u0440\u0430\u0432\u043A\u0438 \u043D\u0430 \u044D\u0442\u043E\u043C \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u0442\u0441\u044F)"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    disabled: busy,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => onChoose("local")
  }, "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043C\u043E\u044E \u0432\u0435\u0440\u0441\u0438\u044E (\u0432\u0435\u0440\u0441\u0438\u044F \u043D\u0430 \u0414\u0438\u0441\u043A\u0435 \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u043C\u0435\u043D\u0435\u043D\u0430)"))));
}
function CollapsiblePanel({
  title,
  count,
  open,
  onToggle,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      padding: 0,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onToggle,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "13px 18px",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 15,
    style: {
      margin: 0,
      color: THEME.panelText
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "#8593a3"
    }
  }, count), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      color: "#8593a3",
      transform: open ? "rotate(90deg)" : "none",
      transition: "transform .15s"
    }
  }, "\u203A")), open && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 18px 16px"
    }
  }, children));
}
function TrackChip({
  label,
  color,
  active,
  onClick
}) {
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: `1.5px solid ${active ? "#12233a" : "#cfe3f2"}`,
      background: "#fff",
      padding: "5px 11px",
      borderRadius: 20,
      fontSize: 12.5,
      fontWeight: 700,
      color: "#12233a",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: color,
      flexShrink: 0
    }
  }), label);
}
function LessonChip({
  lesson,
  data,
  onOpen,
  onToggleDone,
  onDuplicate,
  draggable,
  onDragStart
}) {
  const color = lessonTrackColor(lesson, data);
  const typeTag = (lesson.lessonTypeTagIds || []).map(id => data.tags.lessonType.find(t => t.id === id)).filter(Boolean)[0];
  return /*#__PURE__*/React.createElement("div", {
    draggable: draggable,
    onDragStart: onDragStart,
    onClick: () => onOpen(lesson),
    style: {
      borderLeft: `3px solid ${color}`,
      background: "#f7f8f7",
      borderRadius: 6,
      padding: "5px 7px",
      marginBottom: 5,
      fontSize: 12,
      lineHeight: 1.3,
      cursor: "pointer",
      opacity: lesson.completed ? 0.6 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onToggleDone(lesson);
    },
    title: "\u041F\u0440\u043E\u0432\u0435\u0434\u0451\u043D",
    style: {
      width: 14,
      height: 14,
      borderRadius: 4,
      border: "1.5px solid #9bb6c9",
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      background: lesson.completed ? color : "#fff",
      color: "#fff",
      fontSize: 9,
      fontWeight: 900
    }
  }, lesson.completed ? "✓" : ""), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      textDecoration: lesson.completed ? "line-through" : "none",
      flex: 1
    }
  }, lesson.topic || "(без темы)"), onDuplicate && /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      onDuplicate(lesson);
    },
    title: "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432 \u043A\u043B\u0430\u0441\u0441/\u043B\u0438\u0442\u0435\u0440\u0443\u2026",
    style: {
      flexShrink: 0,
      color: "#8593a3",
      fontSize: 12,
      cursor: "pointer"
    }
  }, "\u29C9")), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#7a8a9c",
      fontSize: 10.5,
      marginTop: 1
    }
  }, lessonPlaceLabel(lesson, data)), typeTag && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      fontSize: 9.5,
      background: typeTag.color + "33",
      color: typeTag.color,
      borderRadius: 5,
      padding: "0 5px",
      marginTop: 2
    }
  }, typeTag.name));
}
function CalendarWeeksView({
  month,
  lessons,
  data,
  tIso,
  onAddLesson,
  onOpenLesson,
  onToggleDone,
  onDuplicateLesson,
  dragLessonId,
  setDragLessonId,
  onDropOnDate
}) {
  const weeks = weeksOfMonthYm(month);
  const tMon = mondayOf(tIso);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 16
    }
  }, weeks.map(mon => {
    const isThis = mon === tMon;
    const weekLessons = lessons.filter(l => mondayOf(l.plannedDate) === mon);
    return /*#__PURE__*/React.createElement("div", {
      key: mon,
      style: {
        ...panelStyle,
        padding: 0,
        overflow: "hidden",
        border: isThis ? `1.5px solid ${THEME.gold}` : panelStyle.border
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid #e6eef4",
        background: "#fafbfa"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 800,
        fontSize: 13.5
      }
    }, weekLabelRange(mon)), isThis && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: THEME.gold,
        background: THEME.bgDark,
        padding: "2px 8px",
        borderRadius: 20
      }
    }, "\u0442\u0435\u043A\u0443\u0449\u0430\u044F"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 12,
        color: "#8593a3"
      }
    }, weekLessons.length, " \u0443\u0440\u043E\u043A\u043E\u0432")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7,1fr)"
      }
    }, [0, 1, 2, 3, 4, 5, 6].map(i => {
      const dIso = addDaysIso(mon, i);
      const vac = vacationAt(data, dIso);
      const dayLessons = weekLessons.filter(l => l.plannedDate === dIso);
      return /*#__PURE__*/React.createElement("div", {
        key: dIso,
        onDragOver: e => dragLessonId && e.preventDefault(),
        onDrop: e => {
          e.preventDefault();
          onDropOnDate(dIso);
        },
        style: {
          borderRight: i < 6 ? "1px solid #e6eef4" : "none",
          minHeight: 96,
          padding: "7px 7px 30px",
          position: "relative",
          background: dIso === tIso ? "#fff8e6" : vac ? "repeating-linear-gradient(45deg,#eef2f5,#eef2f5 7px,#f5f8fa 7px,#f5f8fa 14px)" : "transparent"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11,
          color: "#8593a3",
          fontWeight: 700,
          marginBottom: 5
        }
      }, WEEKDAYS_RU[i], " ", dayNum(dIso)), vac && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 9.5,
          color: "#8a7a55",
          background: "#f4efe2",
          border: "1px solid #e4d9bf",
          borderRadius: 5,
          padding: "1px 5px",
          marginBottom: 4,
          display: "inline-block"
        }
      }, vac.name), dayLessons.map(l => /*#__PURE__*/React.createElement(LessonChip, {
        key: l.id,
        lesson: l,
        data: data,
        onOpen: onOpenLesson,
        onToggleDone: onToggleDone,
        onDuplicate: onDuplicateLesson,
        draggable: true,
        onDragStart: () => setDragLessonId(l.id)
      })), /*#__PURE__*/React.createElement("div", {
        onClick: () => onAddLesson(dIso),
        style: {
          position: "absolute",
          bottom: 6,
          left: 7,
          right: 7,
          border: "1px dashed #cfe3f2",
          borderRadius: 7,
          color: "#9bb6c9",
          fontSize: 11,
          padding: 3,
          textAlign: "center",
          cursor: "pointer"
        }
      }, "+ \u0443\u0440\u043E\u043A"));
    })));
  }));
}
function CalendarMonthView({
  month,
  lessons,
  data,
  tIso,
  onAddLesson,
  onOpenLesson,
  onToggleDone,
  onDuplicateLesson,
  dragLessonId,
  setDragLessonId,
  onDropOnDate
}) {
  const cells = monthGridYm(month);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      padding: 0,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)",
      background: "#fafbfa",
      borderBottom: "1px solid #e6eef4"
    }
  }, WEEKDAYS_RU.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      padding: 8,
      textAlign: "center",
      fontSize: 11,
      color: "#8593a3",
      fontWeight: 700
    }
  }, d))), [0, 1, 2, 3, 4, 5].map(r => {
    const rowCells = cells.slice(r * 7, r * 7 + 7);
    if (r === 5 && rowCells.every(c => !c.inMonth)) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: r,
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7,1fr)",
        borderBottom: "1px solid #e6eef4"
      }
    }, rowCells.map(c => {
      const vac = vacationAt(data, c.iso);
      const dayLessons = lessons.filter(l => l.plannedDate === c.iso);
      return /*#__PURE__*/React.createElement("div", {
        key: c.iso,
        onDragOver: e => dragLessonId && e.preventDefault(),
        onDrop: e => {
          e.preventDefault();
          onDropOnDate(c.iso);
        },
        style: {
          borderRight: "1px solid #e6eef4",
          minHeight: 88,
          padding: "5px 5px 22px",
          position: "relative",
          background: c.iso === tIso ? "#fff8e6" : !c.inMonth ? "#fafaf9" : vac ? "repeating-linear-gradient(45deg,#eef2f5,#eef2f5 7px,#f5f8fa 7px,#f5f8fa 14px)" : "transparent",
          opacity: c.inMonth ? 1 : 0.6
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: "#8593a3",
          marginBottom: 4
        }
      }, dayNum(c.iso)), dayLessons.map(l => /*#__PURE__*/React.createElement(LessonChip, {
        key: l.id,
        lesson: l,
        data: data,
        onOpen: onOpenLesson,
        onToggleDone: onToggleDone,
        onDuplicate: onDuplicateLesson,
        draggable: true,
        onDragStart: () => setDragLessonId(l.id)
      })), /*#__PURE__*/React.createElement("div", {
        onClick: () => onAddLesson(c.iso),
        style: {
          position: "absolute",
          bottom: 4,
          left: 5,
          right: 5,
          textAlign: "center",
          color: "#9bb6c9",
          fontSize: 13,
          cursor: "pointer"
        }
      }, "+"));
    }));
  }));
}

// Дублирование прямо из календаря: выбираем класс/курс и (если есть) литеру — получится
// независимая копия урока (материалы и ДЗ клонируются, дата/статус "пройден" — нет).
function DuplicateLessonModal({
  lesson,
  tracks,
  data,
  onSave,
  onCancel
}) {
  const [trackKey, setTrackKey] = useState(trackKeyOf(lesson));
  const [letterId, setLetterId] = useState(lesson.classLetterId || "");
  const [kind, value] = trackKey.split(":");
  const letters = kind === "class" ? lettersForGrade(data, value) : [];
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setLetterId("");
  }, [trackKey]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onCancel()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 14,
      padding: 20,
      width: "min(420px, 95vw)"
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: "#12233a",
      marginBottom: 4
    }
  }, "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0443\u0440\u043E\u043A"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#7a8a9c",
      marginBottom: 14
    }
  }, "\xAB", lesson.topic || "Без темы", "\xBB"), /*#__PURE__*/React.createElement(Field, {
    label: "\u041A\u043B\u0430\u0441\u0441 / \u043A\u0443\u0440\u0441"
  }, /*#__PURE__*/React.createElement("select", {
    style: inputStyle,
    value: trackKey,
    onChange: e => setTrackKey(e.target.value)
  }, tracks.map(t => /*#__PURE__*/React.createElement("option", {
    key: trackKeyOf(t.kind, t.value),
    value: trackKeyOf(t.kind, t.value)
  }, t.label)))), letters.length > 0 && /*#__PURE__*/React.createElement(Field, {
    label: "\u041B\u0438\u0442\u0435\u0440\u0430"
  }, /*#__PURE__*/React.createElement("select", {
    style: inputStyle,
    value: letterId,
    onChange: e => setLetterId(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u0411\u0435\u0437 \u043B\u0438\u0442\u0435\u0440\u044B"), letters.map(cl => /*#__PURE__*/React.createElement("option", {
    key: cl.id,
    value: cl.id
  }, value, cl.name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    onClick: () => onSave({
      kind,
      value,
      classLetterId: letterId || null
    })
  }, "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onCancel
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))));
}
function CreateLessonModal({
  creating,
  setCreating,
  tracks,
  data,
  onSave,
  onCancel
}) {
  const [kind, value] = (creating.trackKey || "").split(":");
  const availableExisting = creating.trackKey ? data.lessons.filter(l => !l.plannedDate && !l.archived && (kind === "course" ? l.courseId === value : l.class === value && !l.courseId)) : [];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onCancel()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 14,
      padding: 20,
      width: "min(480px, 95vw)"
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: "#12233a",
      marginBottom: 14
    }
  }, "\u0423\u0440\u043E\u043A \u043D\u0430 ", formatDateRu(creating.date)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: creating.mode === "new" ? "pastel" : "ghost",
    small: true,
    style: creating.mode !== "new" ? {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    } : {},
    onClick: () => setCreating({
      ...creating,
      mode: "new"
    })
  }, "\u041D\u043E\u0432\u044B\u0439 \u0443\u0440\u043E\u043A"), /*#__PURE__*/React.createElement(Btn, {
    kind: creating.mode === "existing" ? "pastel" : "ghost",
    small: true,
    style: creating.mode !== "existing" ? {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    } : {},
    onClick: () => setCreating({
      ...creating,
      mode: "existing"
    })
  }, "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439")), /*#__PURE__*/React.createElement(Field, {
    label: "\u041A\u043B\u0430\u0441\u0441 / \u043A\u0443\u0440\u0441"
  }, /*#__PURE__*/React.createElement("select", {
    style: inputStyle,
    value: creating.trackKey || "",
    onChange: e => setCreating({
      ...creating,
      trackKey: e.target.value,
      existingId: ""
    })
  }, tracks.map(t => /*#__PURE__*/React.createElement("option", {
    key: trackKeyOf(t.kind, t.value),
    value: trackKeyOf(t.kind, t.value)
  }, t.label)))), creating.mode === "new" ? /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0435\u043C\u0430 \u0443\u0440\u043E\u043A\u0430"
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    style: inputStyle,
    value: creating.topic,
    onChange: e => setCreating({
      ...creating,
      topic: e.target.value
    }),
    placeholder: "\u0422\u0435\u043C\u0430 \u0443\u0440\u043E\u043A\u0430"
  })) : /*#__PURE__*/React.createElement(Field, {
    label: "\u0423\u0440\u043E\u043A \u0431\u0435\u0437 \u0434\u0430\u0442\u044B"
  }, availableExisting.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#8593a3"
    }
  }, "\u041D\u0435\u0442 \u0443\u0440\u043E\u043A\u043E\u0432 \u0431\u0435\u0437 \u0434\u0430\u0442\u044B \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043A\u043B\u0430\u0441\u0441\u0430/\u043A\u0443\u0440\u0441\u0430.") : /*#__PURE__*/React.createElement("select", {
    style: inputStyle,
    value: creating.existingId,
    onChange: e => setCreating({
      ...creating,
      existingId: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0440\u043E\u043A \u2014"), availableExisting.map(l => /*#__PURE__*/React.createElement("option", {
    key: l.id,
    value: l.id
  }, l.topic || "(без темы)")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    onClick: onSave
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onCancel
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))));
}

/* ---- Журнал ---- */
// Строит HTML отчёта (используется и для показа на экране, и для экспорта в Word/PDF).
// Проценты успеваемости/качества считаются только по 5-балльной шкале — у 100-балльной
// нет смысловых порогов "3/4/5". Знаменатель для класса/даты — весь список класса,
// а не только те, у кого есть отметки: так неаттестованные ученики тоже видны в проценте.
function journalReportHtml(mode, data, students, {
  studentId,
  date,
  qc,
  groupLabel
}) {
  const bar = (label, pct, color) => `<div style="margin:10px 0;"><b>${escapeHtml(label)}:</b> ${pctBarHtml(pct, color)}</div>`;
  if (mode === "student") {
    const student = data.students.find(s => s.id === studentId);
    if (!student) return "<div>Ученик не найден</div>";
    const place = student.courseId ? (data.courses.find(c => c.id === student.courseId)?.name || "") + (student.courseSubgroupId ? ` · ${courseSubgroupName(data, student.courseSubgroupId)}` : "") : `${student.class}${student.classLetterId ? classLetterName(data, student.classLetterId) : ""} класс`;
    let html = `<div class="muted">${escapeHtml(place)}</div><h2>${escapeHtml(student.name)}</h2>`;
    let any = false;
    for (let q = 0; q < qc; q++) {
      const ms = studentMarksOf(data, student.id, "5").filter(m => quarterOfDate(data, m.date) === q).sort((a, b) => a.date < b.date ? -1 : 1);
      if (!ms.length) continue;
      any = true;
      const grades = ms.filter(m => m.value !== "Н").map(m => +m.value);
      const nCount = ms.filter(m => m.value === "Н").length;
      html += `<h3>Четверть ${q + 1}</h3><div>Отметки: ${ms.map(m => m.value).join(", ")}${nCount ? ` (из них Н: ${nCount})` : ""} (средняя: ${fmtAvgNum(quarterAvgOf(data, student.id, q, "5"))})</div>`;
      html += bar("Успеваемость", performancePct(grades), "#2678b3");
      html += bar("Качество", qualityPct(grades), "#1b7a4a");
    }
    const yearMarks = numericMarksOf(data, student.id, "5");
    if (yearMarks.length) {
      html += `<h3>Итого за год</h3><div>Средняя по четвертям: ${fmtAvgNum(yearAvgFromQuarters(data, student.id, "5", qc))}, отметок за год: ${yearMarks.length}</div>`;
      html += bar("Успеваемость за год", performancePct(yearMarks.map(m => +m.value)), "#2678b3");
      html += bar("Качество за год", qualityPct(yearMarks.map(m => +m.value)), "#1b7a4a");
    }
    const hundred = numericMarksOf(data, student.id, "100");
    if (hundred.length) {
      html += `<h3>По 100-балльной шкале</h3><div>Отметок: ${hundred.length}, средняя: ${fmtAvgNum(yearAvgOf(data, student.id, "100"))}</div>`;
    }
    if (!any && !hundred.length) html += "<div>Отметок пока нет.</div>";
    return html;
  }
  if (mode === "class") {
    let html = `<h2>${escapeHtml(groupLabel)}</h2>`;
    html += `<table style="border-collapse:collapse;width:100%;margin-bottom:14px;"><tr><th style="text-align:left;border-bottom:1px solid #ccc;padding:4px 8px;">Ученик</th><th style="border-bottom:1px solid #ccc;padding:4px 8px;">Отметок (5-б)</th><th style="border-bottom:1px solid #ccc;padding:4px 8px;">Средняя за год</th></tr>`;
    students.forEach(s => {
      const ms = numericMarksOf(data, s.id, "5");
      html += `<tr><td style="padding:4px 8px;">${escapeHtml(s.name)}</td><td style="text-align:center;padding:4px 8px;">${ms.length}</td><td style="text-align:center;padding:4px 8px;">${fmtAvgNum(yearAvgFromQuarters(data, s.id, "5", qc))}</td></tr>`;
    });
    html += `</table>`;
    for (let q = 0; q < qc; q++) {
      const grades = students.map(s => roundToGrade(quarterAvgOf(data, s.id, q, "5")));
      if (grades.every(g => g == null)) continue;
      html += `<h3>Четверть ${q + 1}</h3>`;
      html += bar("Успеваемость класса", performancePct(grades), "#2678b3");
      html += bar("Качество класса", qualityPct(grades), "#1b7a4a");
    }
    const yearGrades = students.map(s => roundToGrade(yearAvgFromQuarters(data, s.id, "5", qc)));
    html += `<h3>Итого за год</h3>`;
    html += bar("Успеваемость класса за год", performancePct(yearGrades), "#2678b3");
    html += bar("Качество класса за год", qualityPct(yearGrades), "#1b7a4a");
    return html;
  }

  // mode === "date": знаменатель — список класса БЕЗ отмеченных "Н" (пропуск не учитывается вообще,
  // а не просто как "0" — как и попросили). Ученики без отметки в этот день всё ещё считаются в знаменателе.
  let html = `<h2>${escapeHtml(groupLabel)} — отчёт за ${formatDateRu(date)}</h2>`;
  const absentCount = students.filter(s => {
    const m = studentMarksOf(data, s.id, "5").find(mm => mm.date === date);
    return m && m.value === "Н";
  }).length;
  html += `<div>Количество детей в классе: ${students.length}</div>`;
  html += `<div>Присутствовало на уроке: ${students.length - absentCount}</div>`;
  const gradeCounts = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  };
  students.forEach(s => {
    const m = studentMarksOf(data, s.id, "5").find(mm => mm.date === date);
    if (m && m.value !== "Н" && gradeCounts[+m.value] !== undefined) gradeCounts[+m.value]++;
  });
  html += `<div style="margin-bottom:14px;">Отметок «5»: ${gradeCounts[5]}, «4»: ${gradeCounts[4]}, «3»: ${gradeCounts[3]}, «2»: ${gradeCounts[2]}, «1»: ${gradeCounts[1]}</div>`;
  html += `<table style="border-collapse:collapse;width:100%;margin-bottom:14px;"><tr><th style="text-align:left;border-bottom:1px solid #ccc;padding:4px 8px;">Ученик</th><th style="border-bottom:1px solid #ccc;padding:4px 8px;">Отметка</th></tr>`;
  const repGrades = [];
  students.forEach(s => {
    const m = studentMarksOf(data, s.id, "5").find(mm => mm.date === date);
    html += `<tr><td style="padding:4px 8px;">${escapeHtml(s.name)}</td><td style="text-align:center;padding:4px 8px;">${m ? m.value : "—"}</td></tr>`;
    if (m && m.value === "Н") return; // не учитывается ни в числителе, ни в знаменателе
    repGrades.push(m ? +m.value : null);
  });
  html += `</table>`;
  html += bar("Успеваемость класса", performancePct(repGrades), "#2678b3");
  html += bar("Качество класса", qualityPct(repGrades), "#1b7a4a");
  return html;
}
function JournalReportModal({
  mode,
  data,
  students,
  groupLabel,
  studentId,
  date,
  qc,
  onClose
}) {
  const student = studentId ? data.students.find(s => s.id === studentId) : null;
  const title = mode === "student" ? `Отчёт: ${student?.name || "ученик"}` : mode === "class" ? `Отчёт по классу: ${groupLabel}` : `Отчёт за ${formatDateRu(date)}`;
  const bodyHtml = journalReportHtml(mode, data, students, {
    studentId,
    date,
    qc,
    groupLabel
  });
  const filenameBase = mode === "student" ? student?.name || "otchet" : mode === "class" ? groupLabel || "klass" : `otchet-${date}`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 16,
      padding: 22,
      width: "min(640px, 95vw)",
      maxHeight: "88vh",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 19,
    style: {
      color: "#12233a"
    }
  }, title), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(ExportButtons, {
    labeled: true,
    onWord: () => downloadWord(filenameBase, title, bodyHtml),
    onPdf: () => printAsPdf(title, bodyHtml)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      lineHeight: 1.6
    },
    dangerouslySetInnerHTML: {
      __html: bodyHtml
    }
  })));
}

// Клик по клетке пересечения ученик×дата: поставить/изменить отметку, отметить "Н"
// (с причиной — уважительная/неуважительная) или удалить отметку.
function MarkCellModal({
  student,
  date,
  lesson,
  existingMark,
  scale,
  onSave,
  onClear,
  onClose,
  onNavigate
}) {
  const [isAbsent, setIsAbsent] = useState(existingMark?.value === "Н");
  const [val, setVal] = useState(existingMark && existingMark.value !== "Н" ? String(existingMark.value) : "");
  const [excused, setExcused] = useState(existingMark?.excused !== false);
  const [reason, setReason] = useState(existingMark?.reason || "");
  const min = scale === "100" ? 0 : 1;
  const max = scale === "100" ? 100 : 5;
  const buildPatch = () => {
    if (isAbsent) return {
      value: "Н",
      excused,
      reason,
      scale
    };
    if (val === "" || isNaN(+val) || +val < min || +val > max) return null;
    return {
      value: +val,
      excused: null,
      reason,
      scale
    };
  };
  const save = () => {
    const patch = buildPatch();
    if (!patch) {
      alert(`Отметка должна быть числом от ${min} до ${max}, либо отметьте «Н»`);
      return;
    }
    onSave(patch);
  };

  // Стрелки на клавиатуре — переход к соседней клетке (вниз/вверх — следующий/предыдущий
  // ученик, влево/вправо — соседняя дата), с сохранением уже введённой отметки, если она есть.
  const handleArrowKey = e => {
    if (!onNavigate) return;
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right"
    };
    const direction = map[e.key];
    if (!direction) return;
    e.preventDefault();
    onNavigate(direction, buildPatch());
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 14,
      padding: 20,
      width: "min(360px, 92vw)"
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 17,
    style: {
      color: "#12233a",
      marginBottom: 3
    }
  }, student.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#7a8a9c",
      marginBottom: 14
    }
  }, formatDateRu(date), lesson ? " · " + (lesson.topic || "без темы") : "", onNavigate && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      marginTop: 2
    }
  }, "\u0421\u0442\u0440\u0435\u043B\u043A\u0430\u043C\u0438 \u2191\u2193\u2190\u2192 \u0432 \u043F\u043E\u043B\u0435 \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u2014 \u043A \u0441\u043E\u0441\u0435\u0434\u043D\u0435\u0439 \u043A\u043B\u0435\u0442\u043A\u0435")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041E\u0442\u043C\u0435\u0442\u043A\u0430",
    active: !isAbsent,
    onClick: () => setIsAbsent(false)
  }), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041D \u2014 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u043E\u0432\u0430\u043B",
    active: isAbsent,
    onClick: () => setIsAbsent(true)
  })), !isAbsent ? /*#__PURE__*/React.createElement(Field, {
    label: `Отметка (${min}–${max})`
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    type: "number",
    min: min,
    max: max,
    style: inputStyle,
    value: val,
    onChange: e => setVal(e.target.value),
    onKeyDown: handleArrowKey
  })) : /*#__PURE__*/React.createElement(Field, {
    label: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u0423\u0432\u0430\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F",
    active: excused,
    onClick: () => setExcused(true)
  }), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041D\u0435\u0443\u0432\u0430\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F",
    active: !excused,
    onClick: () => setExcused(false)
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)"
  }, /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    value: reason,
    onChange: e => setReason(e.target.value),
    placeholder: "\u0434\u0438\u043A\u0442\u0430\u043D\u0442, \u0443\u0441\u0442\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: save
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"), existingMark && /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: onClear
  }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043E\u0442\u043C\u0435\u0442\u043A\u0443"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))));
}

// Массовое выставление отметок всем ученикам сразу на одну дату — быстрее, чем по одной клетке.
function BulkMarkModal({
  students,
  date,
  data,
  gridScale,
  onSave,
  onClose
}) {
  const min = gridScale === "100" ? 0 : 1;
  const max = gridScale === "100" ? 100 : 5;
  const [entries, setEntries] = useState(() => students.map(s => {
    const existing = studentMarksOf(data, s.id, gridScale).find(m => m.date === date);
    return {
      studentId: s.id,
      name: s.name,
      value: existing && existing.value !== "Н" ? String(existing.value) : "",
      isAbsent: existing?.value === "Н",
      excused: existing?.excused !== false
    };
  }));
  const setEntry = (studentId, patch) => setEntries(prev => prev.map(e => e.studentId === studentId ? {
    ...e,
    ...patch
  } : e));
  const save = () => {
    const results = entries.filter(e => e.isAbsent || e.value !== "").map(e => ({
      studentId: e.studentId,
      value: e.isAbsent ? "Н" : +e.value,
      excused: e.isAbsent ? e.excused !== false : null
    }));
    onSave(results);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 14,
      padding: 20,
      width: "min(420px, 92vw)"
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 17,
    style: {
      color: "#12233a",
      marginBottom: 4
    }
  }, "\u041E\u0442\u043C\u0435\u0442\u043A\u0438 \u043D\u0430 ", formatDateRu(date)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#7a8a9c",
      marginBottom: 12
    }
  }, "\u0412\u043F\u0438\u0448\u0438\u0442\u0435 \u043E\u0442\u043C\u0435\u0442\u043A\u0443 \u043A\u0430\u0436\u0434\u043E\u043C\u0443 (\u0438\u043B\u0438 \u043E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \xAB\u041D\xBB) \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0432\u0441\u0435\u0445 \u0440\u0430\u0437\u043E\u043C. \u041F\u0443\u0441\u0442\u043E\u0435 \u043F\u043E\u043B\u0435 \u2014 \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439."), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: "48vh",
      overflowY: "auto",
      display: "grid",
      gap: 7
    }
  }, entries.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.studentId,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 13,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, e.name), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041D",
    active: e.isAbsent,
    onClick: () => setEntry(e.studentId, {
      isAbsent: !e.isAbsent
    })
  }), e.isAbsent ? /*#__PURE__*/React.createElement("select", {
    value: e.excused ? "1" : "0",
    onChange: ev => setEntry(e.studentId, {
      excused: ev.target.value === "1"
    }),
    style: {
      ...inputStyle,
      maxWidth: 112,
      padding: "4px 6px",
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "1"
  }, "\u0423\u0432\u0430\u0436."), /*#__PURE__*/React.createElement("option", {
    value: "0"
  }, "\u041D\u0435\u0443\u0432\u0430\u0436.")) : /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: min,
    max: max,
    value: e.value,
    onChange: ev => setEntry(e.studentId, {
      value: ev.target.value
    }),
    style: {
      ...inputStyle,
      maxWidth: 64,
      padding: "4px 6px"
    },
    placeholder: "\u2014"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: save
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432\u0441\u0435\u043C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))));
}

// Отметка в журнале сама по себе, без привязки к конкретному упражнению урока — например,
// за самостоятельную/контрольную работу, устный опрос и т.п. Появится в сетке своей колонкой.
function AddJournalMarkModal({
  students,
  gridScale,
  onSave,
  onClose
}) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [date, setDate] = useState(todayIso());
  const [isAbsent, setIsAbsent] = useState(false);
  const [val, setVal] = useState("");
  const [excused, setExcused] = useState(true);
  const [reason, setReason] = useState("");
  const min = gridScale === "100" ? 0 : 1;
  const max = gridScale === "100" ? 100 : 5;
  const save = () => {
    if (!studentId) {
      alert("Выберите ученика");
      return;
    }
    if (isAbsent) {
      onSave({
        studentId,
        date,
        value: "Н",
        excused,
        reason,
        scale: gridScale
      });
      return;
    }
    if (val === "" || isNaN(+val) || +val < min || +val > max) {
      alert(`Отметка должна быть числом от ${min} до ${max}, либо отметьте «Н»`);
      return;
    }
    onSave({
      studentId,
      date,
      value: +val,
      excused: null,
      reason,
      scale: gridScale
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => e.target === e.currentTarget && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 14,
      padding: 20,
      width: "min(380px, 92vw)"
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 17,
    style: {
      color: "#12233a",
      marginBottom: 14
    }
  }, "\u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u0431\u0435\u0437 \u0443\u0440\u043E\u043A\u0430"), /*#__PURE__*/React.createElement(Field, {
    label: "\u0423\u0447\u0435\u043D\u0438\u043A"
  }, /*#__PURE__*/React.createElement("select", {
    style: inputStyle,
    value: studentId,
    onChange: e => setStudentId(e.target.value)
  }, students.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name)))), /*#__PURE__*/React.createElement(Field, {
    label: "\u0414\u0430\u0442\u0430"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: inputStyle,
    value: date,
    onChange: e => setDate(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041E\u0442\u043C\u0435\u0442\u043A\u0430",
    active: !isAbsent,
    onClick: () => setIsAbsent(false)
  }), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041D \u2014 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u043E\u0432\u0430\u043B",
    active: isAbsent,
    onClick: () => setIsAbsent(true)
  })), !isAbsent ? /*#__PURE__*/React.createElement(Field, {
    label: `Отметка (${min}–${max})`
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: min,
    max: max,
    style: inputStyle,
    value: val,
    onChange: e => setVal(e.target.value)
  })) : /*#__PURE__*/React.createElement(Field, {
    label: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u0423\u0432\u0430\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F",
    active: excused,
    onClick: () => setExcused(true)
  }), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041D\u0435\u0443\u0432\u0430\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F",
    active: !excused,
    onClick: () => setExcused(false)
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "\u0417\u0430 \u0447\u0442\u043E (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)"
  }, /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    value: reason,
    onChange: e => setReason(e.target.value),
    placeholder: "\u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0440\u0430\u0431\u043E\u0442\u0430, \u0443\u0441\u0442\u043D\u044B\u0439 \u043E\u043F\u0440\u043E\u0441\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: save
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))));
}

/* ============================================================
   ИМПОРТ ОТМЕТОК ИЗ ТАБЛИЦЫ ШКОЛЬНОГО ЭЛЕКТРОННОГО ЖУРНАЛА (.xlsx) — тот же разбор таблицы, что в журнале по
   литературе. Лист: в строке 1 заголовок («6Б: Русский язык (…) - I четверть»), в строке-шапке даты («1сен»),
   ниже строки учеников: № | Ф.И. | отметки по датам (1–5, «Н»).
   Сравнение — по КОЛИЧЕСТВУ отметок каждого значения (1, 2, 3, 4, 5, Н) у каждого ученика в пределах дат таблицы:
   • количества совпали (даты могут быть другие) — ничего не добавляется;
   • в таблице отметок больше — недостающие добавляются с датами из таблицы;
   • в журнале отметок больше — программа показывает предупреждение: оставить или удалить каждую лишнюю.
   ============================================================ */
async function inflateRawBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZipEntryBytes(buf, wanted) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("это не файл Excel (не найден архив)");
  const total = dv.getUint16(eocd + 10, true);
  let pos = dv.getUint32(eocd + 16, true);
  for (let i = 0; i < total; i++) {
    if (dv.getUint32(pos, true) !== 0x02014b50) break;
    const method = dv.getUint16(pos + 10, true);
    const compSize = dv.getUint32(pos + 20, true);
    const nameLen = dv.getUint16(pos + 28, true);
    const extraLen = dv.getUint16(pos + 30, true);
    const commentLen = dv.getUint16(pos + 32, true);
    const local = dv.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(u8.subarray(pos + 46, pos + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const raw = u8.subarray(start, start + compSize);
      return method === 0 ? raw : await inflateRawBytes(raw);
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("в архиве нет нужного файла: " + wanted);
}
function xmlAll(root, name) {
  return Array.from(root.getElementsByTagName("*")).filter(e => e.localName === name);
}
async function xlsxToSheets(buf) {
  const dec = b => new TextDecoder("utf-8").decode(b);
  const xml = t => new DOMParser().parseFromString(t, "application/xml");
  let wb, rels;
  try {
    wb = xml(dec(await readZipEntryBytes(buf, "xl/workbook.xml")));
    rels = xml(dec(await readZipEntryBytes(buf, "xl/_rels/workbook.xml.rels")));
  } catch (e) {
    throw new Error("это не файл Excel (.xlsx)");
  }
  let ss = [];
  try {
    const sx = xml(dec(await readZipEntryBytes(buf, "xl/sharedStrings.xml")));
    ss = xmlAll(sx, "si").map(si => xmlAll(si, "t").filter(t => !t.parentNode || t.parentNode.localName !== "rPh").map(t => t.textContent).join(""));
  } catch (e) {
    /* без общих строк */
  }
  const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const out = [];
  for (const sh of xmlAll(wb, "sheet")) {
    const rid = sh.getAttributeNS(NS_R, "id") || sh.getAttribute("r:id");
    const rel = xmlAll(rels, "Relationship").find(r => r.getAttribute("Id") === rid);
    if (!rel) continue;
    let target = (rel.getAttribute("Target") || "").replace(/^\//, "");
    if (!/^xl\//.test(target)) target = "xl/" + target;
    let sdoc;
    try {
      sdoc = xml(dec(await readZipEntryBytes(buf, target)));
    } catch (e) {
      continue;
    }
    const rows = {};
    xmlAll(sdoc, "c").forEach(c => {
      const m = (c.getAttribute("r") || "").match(/^([A-Z]+)(\d+)$/);
      if (!m) return;
      const t = c.getAttribute("t");
      const v = Array.from(c.children).find(k => k.localName === "v");
      const is = Array.from(c.children).find(k => k.localName === "is");
      let val = null;
      if (t === "s" && v) val = ss[+v.textContent];else if (t === "inlineStr" && is) val = xmlAll(is, "t").map(x => x.textContent).join("");else if (v) val = t === "str" || t === "e" || t === "b" ? v.textContent : isNaN(+v.textContent) ? v.textContent : +v.textContent;
      if (val === null || val === undefined || val === "") return;
      (rows[+m[2]] = rows[+m[2]] || {})[m[1]] = val;
    });
    out.push({
      name: sh.getAttribute("name") || "",
      rows
    });
  }
  return out;
}
const JR_MONTHS = {
  янв: 1,
  фев: 2,
  мар: 3,
  апр: 4,
  май: 5,
  мая: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сен: 9,
  окт: 10,
  ноя: 11,
  дек: 12
};
function jrParseDate(text, startYear) {
  const s = String(text).trim().toLowerCase();
  let day = null,
    mon = null;
  let m = s.match(/^(\d{1,2})\s*([а-яё]{3,})\.?$/);
  if (m) {
    day = +m[1];
    mon = JR_MONTHS[m[2].slice(0, 3)] || null;
  } else if (m = s.match(/^(\d{1,2})[./](\d{1,2})(?:[./]\d{2,4})?$/)) {
    day = +m[1];
    mon = +m[2];
  }
  if (!day || !mon || day > 31 || mon > 12) return null;
  const year = mon >= 9 ? startYear : startYear + 1;
  return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
// Ключ имени: регистр, «ё» и порядок слов не важны.
function jrNameKey(n) {
  return String(n || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9 ]+/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
}
// Листы одного файла → группа, даты-столбцы, ученики и их отметки.
function parseJournalSheets(fileName, sheets) {
  const fy = fileName.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  const now = new Date();
  const startYear = fy ? +fy[1] : now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const fnClass = fileName.replace(/^.*?\d{4}\s*[-–]\s*\d{4}_/, "").match(/^(\d{1,2})\s*([А-Яа-яA-Za-z])?(?=[_\s.])/);
  const res = [];
  sheets.forEach(sh => {
    const rowNums = Object.keys(sh.rows).map(Number).sort((a, b) => a - b);
    if (!rowNums.length) return;
    const title = String(Object.values(sh.rows[rowNums[0]])[0] || "");
    const hdrRow = rowNums.find(r => Object.values(sh.rows[r]).filter(v => typeof v === "string" && jrParseDate(v, startYear)).length >= 2);
    if (!hdrRow) return;
    const columns = [];
    Object.entries(sh.rows[hdrRow]).forEach(([col, v]) => {
      const dt = typeof v === "string" ? jrParseDate(v, startYear) : null;
      if (dt) columns.push({
        col,
        date: dt,
        label: v
      });
    });
    const students = [];
    rowNums.filter(r => r > hdrRow).forEach(r => {
      const row = sh.rows[r];
      if (typeof row.A !== "number" || typeof row.B !== "string") return;
      const cells = {};
      columns.forEach(c => {
        const raw = row[c.col];
        if (raw === undefined) return;
        const toks = String(raw).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
        const nums = toks.filter(t => /^[1-5]$/.test(t));
        const abs = toks.some(t => /^[НHнh]$/.test(t));
        const bad = toks.filter(t => !/^[1-5]$/.test(t) && !/^[НHнh]$/.test(t));
        // ячейка «5 Н» (оценка и Н сразу) — берётся оценка, как в журнале по литературе
        if (nums.length || abs) cells[c.col] = {
          value: nums.length ? +nums[nums.length - 1] : "Н",
          both: nums.length > 0 && abs,
          bad
        };else if (bad.length) cells[c.col] = {
          value: null,
          bad
        };
      });
      students.push({
        name: row.B.trim().replace(/\s+/g, " "),
        cells
      });
    });
    const tm = title.match(/^\s*(\d{1,2})\s*([А-Яа-яA-Za-z])?\s*:/);
    const grade = tm ? tm[1] : fnClass ? fnClass[1] : "";
    const letterName = tm && tm[2] || fnClass && fnClass[2] || "";
    const teacher = ((title.match(/\(([^)]+)\)/) || [])[1] || "").trim();
    const groupTag = ((title.match(/\/\s*([^(]+?)\s*\(/) || [])[1] || "").trim();
    res.push({
      sheetName: sh.name,
      title,
      grade,
      letterName,
      teacher,
      groupTag,
      columns,
      students
    });
  });
  return res;
}
const JR_VALUES = [1, 2, 3, 4, 5, "Н"];
const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

// Описание «вида работы» отметки журнала для окна предупреждения: тип урока, тема, упражнение, комментарий.
function describeMarkWork(data, m) {
  const parts = [];
  const lesson = m.lessonId ? data.lessons.find(l => l.id === m.lessonId) : null;
  if (lesson) {
    const types = (lesson.lessonTypeTagIds || []).map(id => data.tags.lessonType.find(t => t.id === id)?.name).filter(Boolean);
    if (types.length) parts.push(types.join(", "));
    if (lesson.topic) parts.push(lesson.topic);
  }
  if (m.exerciseId) {
    const ex = data.examples.find(e => e.id === m.exerciseId);
    if (ex) parts.push("упражнение: " + stripHtml(ex.text).slice(0, 60));
  }
  if (m.reason && !(m.exerciseId && parts.some(p => p.includes(m.reason)))) parts.push(m.reason);
  return parts.join(" · ");
}

// Разбор отметок одного ученика: сопоставляет отметки таблицы и журнала по значению (сначала точное совпадение
// даты, затем ближайшие даты) и возвращает, что надо добавить (остаток таблицы) и что лишнее в журнале (остаток журнала).
function planStudentMarks(d, student, st, sheet) {
  const dates = sheet.columns.map(c => c.date).sort();
  const minD = dates[0];
  const maxD = dates[dates.length - 1];
  const excel = [];
  sheet.columns.forEach(c => {
    const cell = st.cells[c.col];
    if (cell && cell.value !== null) excel.push({
      date: c.date,
      value: cell.value,
      label: c.label
    });
  });
  const journal = d.marks.filter(m => m.studentId === student.id && (m.scale || "5") === "5" && m.date >= minD && m.date <= maxD).map(m => ({
    id: m.id,
    date: m.date,
    value: m.value === "Н" ? "Н" : +m.value,
    mark: m
  }));
  const toAdd = [];
  const surplus = [];
  JR_VALUES.forEach(v => {
    let X = excel.filter(e => e.value === v);
    let Y = journal.filter(j => j.value === v);
    // 1) точные совпадения даты
    X = X.filter(e => {
      const i = Y.findIndex(j => j.date === e.date);
      if (i === -1) return true;
      Y.splice(i, 1);
      return false;
    });
    // 2) оставшиеся — парами по ближайшим датам (даты не совпали, но отметка в журнале уже есть)
    while (X.length && Y.length) {
      let best = null;
      X.forEach((e, xi) => Y.forEach((j, yi) => {
        const diff = dayDiff(e.date, j.date);
        if (!best || diff < best.diff) best = {
          xi,
          yi,
          diff
        };
      }));
      X.splice(best.xi, 1);
      Y.splice(best.yi, 1);
    }
    toAdd.push(...X);
    surplus.push(...Y);
  });
  return {
    toAdd,
    surplus
  };
}

// План импорта (без изменения данных): по каждому выбранному листу — найденные ученики, что добавить, что лишнее.
function planJournalImport(d, items) {
  return items.map(it => {
    const sh = it.sheet;
    const grade = it.grade;
    const letterId = it.letterId || null;
    const rep = {
      label: `${grade}${it.letterLabel || ""}${sh.groupTag ? " · " + sh.groupTag : ""}`,
      grade,
      letterId,
      sheet: sh,
      studentsTotal: sh.students.length,
      matched: 0,
      unmatched: [],
      people: [],
      bad: [],
      doubles: 0
    };
    const pool = d.students.filter(s => s.class === grade && !s.courseId);
    const pref = pool.filter(s => letterId ? s.classLetterId === letterId : !s.classLetterId);
    const fallback = letterId ? pool.filter(s => !s.classLetterId) : [];
    sh.students.forEach(st => {
      const key = jrNameKey(st.name);
      const s = pref.find(x => jrNameKey(x.name) === key) || fallback.find(x => jrNameKey(x.name) === key) || null;
      Object.entries(st.cells).forEach(([col, cell]) => {
        const c = sh.columns.find(x => x.col === col);
        if (cell.bad && cell.bad.length) rep.bad.push(`${st.name}, ${c ? c.label : col}: «${cell.bad.join(" ")}»`);
        if (cell.both) rep.doubles++;
      });
      if (!s) {
        rep.unmatched.push(st.name);
        return;
      }
      rep.matched++;
      const p = planStudentMarks(d, s, st, sh);
      if (p.toAdd.length || p.surplus.length) rep.people.push({
        student: s,
        toAdd: p.toAdd,
        surplus: p.surplus
      });
    });
    rep.addCount = rep.people.reduce((n, p) => n + p.toAdd.filter(x => x.value !== "Н").length, 0);
    rep.absCount = rep.people.reduce((n, p) => n + p.toAdd.filter(x => x.value === "Н").length, 0);
    rep.surplusCount = rep.people.reduce((n, p) => n + p.surplus.length, 0);
    rep.skipped = rep.matched === 0;
    return rep;
  });
}

// Записывает план в данные: удаляет выбранные лишние отметки (deleteIds), добавляет недостающие (если на эту дату у
// ученика уже стоит другая отметка — пропускает и сообщает), заводит/находит урок на дату. Возвращает отчёт.
function applyJournalPlan(d, plans, deleteIds) {
  const del = new Set(deleteIds);
  const result = {
    added: 0,
    absAdded: 0,
    deleted: 0,
    lessonsCreated: 0,
    blocked: []
  };
  if (del.size) {
    d.marks = d.marks.filter(m => !del.has(m.id));
    d.lessons.forEach(l => (l.items || []).forEach(it => itemStudents(it).forEach(en => {
      if (en.markId && del.has(en.markId)) {
        en.markId = null;
        en.grade = "";
      }
    })));
    result.deleted = del.size;
  }
  plans.forEach(rep => {
    const group = {
      class: rep.grade,
      courseId: null,
      classLetterId: rep.letterId
    };
    const lessonByDate = {};
    rep.people.forEach(p => {
      p.toAdd.forEach(e => {
        if (d.marks.some(m => m.studentId === p.student.id && m.date === e.date && (m.scale || "5") === "5")) {
          result.blocked.push(`${p.student.name}: ${e.value} за ${formatDateRu(e.date)} — на эту дату в журнале уже стоит другая отметка`);
          return;
        }
        let lesson = lessonByDate[e.date];
        if (!lesson) {
          lesson = d.lessons.find(l => sameLessonGroup(l, group) && !l.archived && (l.actualDate || l.plannedDate) === e.date);
          if (!lesson) {
            const id = createSingleLesson(d, {
              kind: "class",
              value: rep.grade,
              classLetterId: rep.letterId,
              topic: "",
              plannedDate: e.date
            });
            lesson = d.lessons.find(l => l.id === id);
            lesson.needsWork = true;
            result.lessonsCreated++;
          }
          lessonByDate[e.date] = lesson;
        }
        d.marks.push({
          id: uid(),
          studentId: p.student.id,
          value: e.value,
          date: e.date,
          reason: "",
          scale: "5",
          excused: e.value === "Н" ? true : null,
          lessonId: lesson.id,
          exerciseId: null
        });
        if (e.value === "Н") result.absAdded++;else result.added++;
      });
    });
  });
  return result;
}
function JournalXlsxImportModal({
  data,
  update,
  onClose
}) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("pick"); // pick | warn | done
  const [plans, setPlans] = useState([]);
  const [decisions, setDecisions] = useState({}); // markId -> "delete" | "keep"
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  const sheetsFlat = files.flatMap((f, fi) => f.sheets.map((s, si) => ({
    fi,
    si,
    s
  })));
  const patchSheet = (fi, si, patch) => setFiles(prev => prev.map((f, i) => i !== fi ? f : {
    ...f,
    sheets: f.sheets.map((s, j) => j !== si ? s : {
      ...s,
      ...patch
    })
  }));
  const onPick = async e => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;
    setBusy(true);
    setErr("");
    const added = [];
    for (const f of list) {
      try {
        const parsed = parseJournalSheets(f.name, await xlsxToSheets(await f.arrayBuffer()));
        if (!parsed.length) {
          setErr("В файле «" + f.name + "» не найдена таблица с датами и отметками");
          continue;
        }
        added.push({
          name: f.name,
          sheets: parsed
        });
      } catch (ex) {
        setErr("Не удалось прочитать «" + f.name + "»: " + (ex && ex.message || ex));
      }
    }
    setFiles(prev => {
      const all = [...prev, ...added];
      const freq = {};
      all.forEach(f => f.sheets.forEach(s => {
        freq[s.teacher] = (freq[s.teacher] || 0) + 1;
      }));
      const top = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
      return all.map(f => added.includes(f) ? {
        ...f,
        sheets: f.sheets.map(s => {
          const letter = lettersForGrade(data, s.grade).find(cl => cl.name.toLowerCase() === (s.letterName || "").toLowerCase());
          return {
            ...s,
            checked: s.teacher === top,
            letterId: letter ? letter.id : ""
          };
        })
      } : f);
    });
    setBusy(false);
  };
  const chosen = sheetsFlat.filter(x => x.s.checked).map(x => ({
    sheet: x.s,
    grade: x.s.grade,
    letterId: x.s.letterId,
    letterLabel: x.s.letterId ? classLetterName(data, x.s.letterId) : ""
  }));
  const preview = useMemo(() => planJournalImport(data, chosen), [data, files]);
  const totalAdd = preview.reduce((n, r) => n + r.addCount + r.absCount, 0);
  const totalSurplus = preview.reduce((n, r) => n + r.surplusCount, 0);
  const finish = async (plansArg, deleteIds) => {
    // страховка: копия проекта до изменений (папка данных приложения / хранилище планшета)
    try {
      if (window.lcAPI.snapshot) await window.lcAPI.snapshot("до-импорта-журнала", JSON.stringify(data));
    } catch (e) {}
    // отчёт считаем на копии (update выполняется позже, результат из него сразу не получить)
    const res = applyJournalPlan(structuredClone(data), plansArg, deleteIds);
    update(d => {
      applyJournalPlan(d, plansArg, deleteIds);
      return d;
    });
    setResult(res);
    setStep("done");
  };
  const start = () => {
    if (totalSurplus > 0) {
      setPlans(preview);
      const dec = {};
      preview.forEach(r => r.people.forEach(p => p.surplus.forEach(s => {
        dec[s.id] = "keep";
      })));
      setDecisions(dec);
      setStep("warn");
    } else {
      setPlans(preview);
      finish(preview, []);
    }
  };
  const applyWithDecisions = () => finish(plans, Object.keys(decisions).filter(id => decisions[id] === "delete"));
  const modalBox = {
    background: THEME.panel,
    color: "#12233a",
    borderRadius: 16,
    padding: 22,
    width: "min(900px, 96vw)",
    maxHeight: "92vh",
    overflow: "auto",
    display: "grid",
    gap: 12
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    },
    onClick: e => e.target === e.currentTarget && step === "pick" && onClose()
  }, /*#__PURE__*/React.createElement("div", {
    style: modalBox
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 18,
    style: {
      color: "#12233a",
      margin: 0
    }
  }, "\u0418\u043C\u043F\u043E\u0440\u0442 \u043E\u0442\u043C\u0435\u0442\u043E\u043A \u0438\u0437 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0433\u043E \u0436\u0443\u0440\u043D\u0430\u043B\u0430"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, step === "done" ? "Закрыть" : "Отмена")), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    multiple: true,
    accept: ".xlsx",
    style: {
      display: "none"
    },
    onChange: onPick
  }), step === "pick" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.55
    }
  }, "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043A\u0430\u0447\u0430\u043D\u043D\u044B\u0435 \u0438\u0437 \u0448\u043A\u043E\u043B\u044C\u043D\u043E\u0433\u043E \u0436\u0443\u0440\u043D\u0430\u043B\u0430 \u0442\u0430\u0431\u043B\u0438\u0446\u044B (\u043C\u043E\u0436\u043D\u043E \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0440\u0430\u0437\u0443). \u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043D\u0430\u0439\u0434\u0451\u0442 \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u043F\u043E \u0444\u0430\u043C\u0438\u043B\u0438\u0438 \u0438 \u0438\u043C\u0435\u043D\u0438 \u0438 ", /*#__PURE__*/React.createElement("b", null, "\u0441\u0440\u0430\u0432\u043D\u0438\u0442 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0446\u0435\u043D\u043E\u043A \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F (1, 2, 3, 4, 5, \xAB\u041D\xBB)"), " \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435 \u0438 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u0437\u0430 \u0434\u0430\u0442\u044B \u0442\u0430\u0431\u043B\u0438\u0446\u044B. \u0415\u0441\u043B\u0438 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0441\u043E\u0432\u043F\u0430\u043B\u043E, \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u0441\u044F, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u0434\u0430\u0442\u044B \u0440\u0430\u0437\u043D\u044B\u0435. \u0415\u0441\u043B\u0438 \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435 \u043E\u0446\u0435\u043D\u043E\u043A \u0431\u043E\u043B\u044C\u0448\u0435, \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u044E\u0449\u0438\u0435 \u0434\u043E\u0431\u0430\u0432\u044F\u0442\u0441\u044F. \u0415\u0441\u043B\u0438 \u0431\u043E\u043B\u044C\u0448\u0435 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435, \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0434\u0438\u0442 \u0438 \u0441\u043F\u0440\u043E\u0441\u0438\u0442, \u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    disabled: busy,
    onClick: () => inputRef.current && inputRef.current.click()
  }, busy ? "Читаю…" : files.length ? "Добавить ещё файлы…" : "Выбрать файлы (.xlsx)…")), err && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.red
    }
  }, err), sheetsFlat.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${THEME.border}`,
      borderRadius: 10,
      overflow: "auto",
      maxHeight: "44vh"
    }
  }, sheetsFlat.map(({
    fi,
    si,
    s
  }) => {
    const rep = s.checked ? preview[chosen.findIndex(c => c.sheet === s)] : null;
    const letters = lettersForGrade(data, s.grade);
    return /*#__PURE__*/React.createElement("div", {
      key: fi + "-" + si,
      style: {
        padding: "10px 12px",
        borderBottom: `1px solid ${THEME.border}`,
        opacity: s.checked ? 1 : 0.6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: !!s.checked,
      onChange: e => patchSheet(fi, si, {
        checked: e.target.checked
      })
    }), /*#__PURE__*/React.createElement("b", {
      style: {
        flex: 1,
        minWidth: 200
      }
    }, s.title || s.sheetName), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: THEME.goldDim
      }
    }, "\u043A\u043B\u0430\u0441\u0441:"), /*#__PURE__*/React.createElement("b", null, s.grade || "?"), /*#__PURE__*/React.createElement("select", {
      style: {
        ...inputStyle,
        width: "auto",
        padding: "4px 8px",
        fontSize: 12.5
      },
      value: s.letterId || "",
      onChange: e => patchSheet(fi, si, {
        letterId: e.target.value
      })
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "\u0431\u0435\u0437 \u043B\u0438\u0442\u0435\u0440\u044B"), letters.map(cl => /*#__PURE__*/React.createElement("option", {
      key: cl.id,
      value: cl.id
    }, s.grade, cl.name)))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "#7a8a9c",
        marginLeft: 26
      }
    }, "\u0424\u0430\u0439\u043B: ", files[fi].name, " \xB7 \u0434\u0430\u0442: ", s.columns.length, " \xB7 \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435: ", s.students.length), rep && /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 26,
        fontSize: 13,
        lineHeight: 1.5
      }
    }, "\u041D\u0430\u0439\u0434\u0435\u043D\u043E \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B: ", /*#__PURE__*/React.createElement("b", null, rep.matched), " \u0438\u0437 ", rep.studentsTotal, " \xB7 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043E\u0442\u043C\u0435\u0442\u043E\u043A: ", /*#__PURE__*/React.createElement("b", null, rep.addCount), ", \xAB\u041D\xBB: ", /*#__PURE__*/React.createElement("b", null, rep.absCount), rep.surplusCount > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: THEME.red
      }
    }, " \xB7 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u0431\u043E\u043B\u044C\u0448\u0435, \u0447\u0435\u043C \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435: ", rep.surplusCount), rep.doubles > 0 && ` · в ячейке и оценка, и «Н» (взята оценка): ${rep.doubles}`, rep.skipped && /*#__PURE__*/React.createElement("div", {
      style: {
        color: THEME.red
      }
    }, "\u041D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0443\u0447\u0435\u043D\u0438\u043A\u0430 \u0438\u0437 \u044D\u0442\u043E\u0433\u043E \u043B\u0438\u0441\u0442\u0430 \u043D\u0435\u0442 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B (\u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043B\u0438\u0442\u0435\u0440\u044B) \u2014 \u043B\u0438\u0441\u0442 \u0431\u0443\u0434\u0435\u0442 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u0432\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \xAB\u0421\u043F\u0438\u0441\u043A\u0438 \u043A\u043B\u0430\u0441\u0441\u043E\u0432\xBB."), rep.unmatched.length > 0 && rep.matched > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "#7a8a9c"
      }
    }, "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B (\u043D\u0435 \u0431\u0443\u0434\u0443\u0442 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u044B): ", rep.unmatched.join(", ")), rep.bad.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "#7a8a9c"
      }
    }, "\u041D\u0435\u043F\u043E\u043D\u044F\u0442\u043D\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0432 \u044F\u0447\u0435\u0439\u043A\u0430\u0445 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u044B: ", rep.bad.slice(0, 5).join("; "), rep.bad.length > 5 ? "…" : "")));
  })), sheetsFlat.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#7a8a9c"
    }
  }, "\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u044B \u043B\u0438\u0441\u0442\u044B \u0441\u0430\u043C\u043E\u0433\u043E \u0447\u0430\u0441\u0442\u043E\u0433\u043E \u0443\u0447\u0438\u0442\u0435\u043B\u044F \u0432 \u0444\u0430\u0439\u043B\u0430\u0445 (\u044D\u0442\u043E \u0432\u0430\u0448\u0438 \u0433\u0440\u0443\u043F\u043F\u044B); \u043B\u0438\u0441\u0442\u044B \u0434\u0440\u0443\u0433\u0438\u0445 \u0443\u0447\u0438\u0442\u0435\u043B\u0435\u0439 \u043C\u043E\u0436\u043D\u043E \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0433\u0430\u043B\u043E\u0447\u043A\u043E\u0439. \u041F\u0435\u0440\u0435\u0434 \u0437\u0430\u043F\u0438\u0441\u044C\u044E \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442 \u043A\u043E\u043F\u0438\u044E \u043F\u0440\u043E\u0435\u043A\u0442\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    disabled: !chosen.length || totalAdd === 0 && totalSurplus === 0,
    onClick: start
  }, totalAdd === 0 && totalSurplus === 0 && chosen.length ? "Расхождений нет — добавлять нечего" : `Продолжить (добавить: ${totalAdd}${totalSurplus ? `, лишних в журнале: ${totalSurplus}` : ""})`))), step === "warn" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.55
    }
  }, /*#__PURE__*/React.createElement("b", null, "\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435!"), " \u0423 \u043D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u043E\u0442\u043C\u0435\u0442\u043E\u043A \u0431\u043E\u043B\u044C\u0448\u0435, \u0447\u0435\u043C \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435. \u041D\u0438\u0436\u0435 \u044D\u0442\u0438 \u043E\u0442\u043C\u0435\u0442\u043A\u0438: \u043E\u0446\u0435\u043D\u043A\u0430, \u0434\u0430\u0442\u0430 \u0438 \u0432\u0438\u0434 \u0440\u0430\u0431\u043E\u0442\u044B (\u0435\u0441\u043B\u0438 \u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D). \u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \xAB\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C\xBB \u0438\u043B\u0438 \xAB\u0423\u0434\u0430\u043B\u0438\u0442\u044C\xBB. \u041D\u0435\u0434\u043E\u0441\u0442\u0430\u044E\u0449\u0438\u0435 \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B (", totalAdd, ") \u0431\u0443\u0434\u0443\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B \u0432 \u043B\u044E\u0431\u043E\u043C \u0441\u043B\u0443\u0447\u0430\u0435."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setDecisions(d0 => Object.fromEntries(Object.keys(d0).map(k => [k, "keep"])))
  }, "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0432\u0441\u0435"), /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: () => setDecisions(d0 => Object.fromEntries(Object.keys(d0).map(k => [k, "delete"])))
  }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0441\u0435")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10,
      maxHeight: "50vh",
      overflow: "auto"
    }
  }, plans.flatMap(rep => rep.people.filter(p => p.surplus.length)).map(p => /*#__PURE__*/React.createElement("div", {
    key: p.student.id,
    style: {
      border: `1px solid ${THEME.border}`,
      borderRadius: 10,
      padding: "10px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      marginBottom: 6
    }
  }, "\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435! \u0423 \u0443\u0447\u0435\u043D\u0438\u043A\u0430 ", p.student.name, " \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435 \u043E\u0442\u043C\u0435\u0442\u043E\u043A \u0431\u043E\u043B\u044C\u0448\u0435"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, p.surplus.map(s => {
    const work = describeMarkWork(data, s.mark);
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        flex: 1,
        minWidth: 200
      }
    }, "(", s.value, ", ", formatDateRu(s.date), work ? `, ${work}` : "", ")"), /*#__PURE__*/React.createElement("span", {
      style: {
        padding: "5px 12px",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 12.5,
        border: `1.5px solid ${decisions[s.id] === "keep" ? THEME.bgDark : THEME.border}`,
        background: decisions[s.id] === "keep" ? THEME.pastel : "#fff"
      },
      onClick: () => setDecisions(d0 => ({
        ...d0,
        [s.id]: "keep"
      }))
    }, "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C"), /*#__PURE__*/React.createElement("span", {
      style: {
        padding: "5px 12px",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 12.5,
        color: decisions[s.id] === "delete" ? "#fff" : THEME.red,
        border: `1.5px solid ${THEME.red}`,
        background: decisions[s.id] === "delete" ? THEME.red : "#fff"
      },
      onClick: () => setDecisions(d0 => ({
        ...d0,
        [s.id]: "delete"
      }))
    }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C"));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    onClick: () => setStep("pick"),
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    }
  }, "\u2190 \u041D\u0430\u0437\u0430\u0434"), /*#__PURE__*/React.createElement(Btn, {
    kind: "primary",
    onClick: applyWithDecisions
  }, "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C (\u0443\u0434\u0430\u043B\u0438\u0442\u044C: ", Object.values(decisions).filter(v => v === "delete").length, ")"))), step === "done" && result && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8,
      fontSize: 13.5,
      lineHeight: 1.55
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "\u0413\u043E\u0442\u043E\u0432\u043E."), " \u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u043E\u0442\u043C\u0435\u0442\u043E\u043A: ", result.added, ", \xAB\u041D\xBB: ", result.absAdded, ". \u0423\u0434\u0430\u043B\u0435\u043D\u043E \u043B\u0438\u0448\u043D\u0438\u0445: ", result.deleted, ". \u0421\u043E\u0437\u0434\u0430\u043D\u043E \u0443\u0440\u043E\u043A\u043E\u0432: ", result.lessonsCreated, "."), result.lessonsCreated > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#7a8a9c"
    }
  }, "\u0421\u043E\u0437\u0434\u0430\u043D\u043D\u044B\u0435 \u0443\u0440\u043E\u043A\u0438 \u043F\u0443\u0441\u0442\u044B\u0435 (\u0431\u0435\u0437 \u0442\u0435\u043C\u044B) \u0438 \u043F\u043E\u043C\u0435\u0447\u0435\u043D\u044B \xAB\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438\xBB: \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0438\u0445 \u0438 \u0437\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435."), result.blocked.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.red
    }
  }, "\u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E (", result.blocked.length, "):", /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: "4px 0 0 18px"
    }
  }, result.blocked.slice(0, 20).map((b, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, b)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#7a8a9c"
    }
  }, "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u0441 \u0442\u0435\u043C\u0438 \u0436\u0435 \u0444\u0430\u0439\u043B\u0430\u043C\u0438 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u0438\u0442 \u2014 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0430 \u0443\u0436\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442."))));
}

// Светло-серый фон для столбца даты, отмеченной как "отметки выставлены".
const JOURNAL_MARKED_BG = "#e3e5e8";
function JournalSection({
  data,
  update,
  trackKey,
  setTrackKey,
  tracks,
  letterFilter,
  setLetterFilter
}) {
  const [reportModal, setReportModal] = useState(null); // { mode, studentId, date }
  const [cellModal, setCellModal] = useState(null); // { studentId, date }
  const [addMarkOpen, setAddMarkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(null);
  const [hoverCell, setHoverCell] = useState(null); // { studentId, date } — для перекрёстного выделения строки/столбца
  const [xlsxOpen, setXlsxOpen] = useState(false);
  const effectiveKey = trackKey && tracks.some(t => trackKeyOf(t.kind, t.value) === trackKey) ? trackKey : tracks[0] ? trackKeyOf(tracks[0].kind, tracks[0].value) : null;
  useEffect(() => {
    if (trackKey !== effectiveKey) setTrackKey(effectiveKey);
  }, [trackKey, effectiveKey]);
  // Литера запоминается на уровне приложения — сбрасываем её только при осознанной смене
  // класса/курса, а не при каждом возврате на эту страницу (иначе выбор терялся бы всякий раз).
  const journalFirstRender = useRef(true);
  useEffect(() => {
    if (journalFirstRender.current) {
      journalFirstRender.current = false;
      return;
    }
    setLetterFilter("all");
  }, [effectiveKey]);
  const [kind, value] = (effectiveKey || "").split(":");
  if (tracks.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...panelStyle,
        textAlign: "center",
        padding: 40
      }
    }, "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043A\u043B\u0430\u0441\u0441 \u0438\u043B\u0438 \u043A\u0443\u0440\u0441 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u0423\u0440\u043E\u043A\u0438 \u0438 \u043A\u0443\u0440\u0441\u044B\xBB.");
  }
  const students = sortedStudents(data.students.filter(s => kind === "course" ? s.courseId === value : s.class === value && !s.courseId).filter(s => {
    if (letterFilter === "all") return true;
    if (kind === "course") return letterFilter === "none" ? !s.courseSubgroupId : s.courseSubgroupId === letterFilter;
    return letterFilter === "none" ? !s.classLetterId : s.classLetterId === letterFilter;
  }));
  const qc = quarterCountOf(data);
  const subName = kind === "course" ? courseSubgroupName(data, letterFilter) : classLetterName(data, letterFilter);
  const baseLabel = kind === "course" ? tracks.find(t => trackKeyOf(t.kind, t.value) === effectiveKey)?.label || "" : `${value} класс`;
  const groupLabel = letterFilter !== "all" && letterFilter !== "none" ? kind === "course" ? `${baseLabel} · ${subName}` : `${value}${subName} класс` : baseLabel;

  // Шкалы, реально используемые хоть у кого-то в текущем списке (у разных литер может
  // быть настроена разная система оценивания — настройки заданы на уровне литеры).
  const scalesHere = Array.from(new Set(students.flatMap(s => scalesInUse(settingsForStudent(data, s).gradingSystem))));
  // Основная сетка показывает одну шкалу за раз (как в обычном бумажном журнале) — 5-балльную,
  // если она вообще используется, иначе то, что настроено (100-балльную).
  const gridScale = scalesHere.includes("5") ? "5" : scalesHere[0] || "5";

  // Уроки этой группы (класс/литера или курс) — по ним появляются колонки-даты в сетке.
  const groupLessons = data.lessons.filter(l => {
    if (l.archived) return false;
    if (kind === "course") return l.courseId === value;
    if (l.class !== value || l.courseId) return false;
    if (letterFilter === "all") return true;
    if (letterFilter === "none") return !l.classLetterId;
    return l.classLetterId === letterFilter;
  });
  const lessonForDate = d => groupLessons.find(l => (l.actualDate || l.plannedDate) === d) || null;
  const datesForQuarter = q => {
    const lessonDates = groupLessons.map(l => l.actualDate || l.plannedDate).filter(Boolean);
    const markDates = students.flatMap(s => studentMarksOf(data, s.id, gridScale).map(m => m.date));
    return Array.from(new Set([...lessonDates, ...markDates])).filter(d => quarterOfDate(data, d) === q).sort();
  };

  // "Отметки выставлены" по дате — чисто визуальная пометка (закрашивает весь столбец),
  // никак не связана с самими отметками, только напоминает, что этот день уже обработан.
  const isDateMarked = d => (data.journalMarkedDates || []).includes(journalMarkedKey(kind, value, letterFilter, d));
  const toggleDateMarked = d => {
    const key = journalMarkedKey(kind, value, letterFilter, d);
    update(dd => {
      dd.journalMarkedDates = (dd.journalMarkedDates || []).includes(key) ? dd.journalMarkedDates.filter(k => k !== key) : [...(dd.journalMarkedDates || []), key];
      return dd;
    });
  };

  // Сохраняет отметку конкретной клетки (используется и обычным "Сохранить", и при переходе
  // стрелками — тогда введённое значение сохраняется перед переходом к соседней клетке).
  const saveCellMark = (target, patch) => {
    update(d => {
      let mark = d.marks.find(m => m.studentId === target.studentId && m.date === target.date && (m.scale || "5") === gridScale);
      if (mark) {
        Object.assign(mark, patch);
        d.lessons.forEach(l => {
          (l.items || []).forEach(it => {
            itemStudents(it).forEach(entry => {
              if (entry.markId === mark.id) {
                entry.grade = String(patch.value);
                entry.gradeScale = patch.scale || "5";
                entry.gradeExcused = patch.value === "Н" ? patch.excused !== false : null;
              }
            });
          });
        });
      } else {
        const l = lessonForDate(target.date);
        d.marks.push({
          id: uid(),
          studentId: target.studentId,
          date: target.date,
          lessonId: l?.id || null,
          exerciseId: null,
          ...patch
        });
      }
      return d;
    });
  };
  // Переход стрелками: вниз/вверх — следующий/предыдущий ученик в списке (в его же дату),
  // влево/вправо — соседняя дата в пределах той же четверти.
  const navigateCell = direction => {
    if (!cellModal) return;
    const dates = datesForQuarter(quarterOfDate(data, cellModal.date));
    const studentIdx = students.findIndex(s => s.id === cellModal.studentId);
    const dateIdx = dates.indexOf(cellModal.date);
    let newStudentIdx = studentIdx;
    let newDateIdx = dateIdx;
    if (direction === "down") newStudentIdx = Math.min(students.length - 1, studentIdx + 1);
    if (direction === "up") newStudentIdx = Math.max(0, studentIdx - 1);
    if (direction === "right") newDateIdx = Math.min(dates.length - 1, dateIdx + 1);
    if (direction === "left") newDateIdx = Math.max(0, dateIdx - 1);
    const newStudent = students[newStudentIdx];
    const newDate = dates[newDateIdx];
    if (!newStudent || !newDate) return;
    setCellModal({
      studentId: newStudent.id,
      date: newDate
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, tracks.map(t => /*#__PURE__*/React.createElement(TrackChip, {
    key: trackKeyOf(t.kind, t.value),
    label: t.label,
    color: t.color,
    active: effectiveKey === trackKeyOf(t.kind, t.value),
    onClick: () => setTrackKey(trackKeyOf(t.kind, t.value))
  }))), (() => {
    const subs = kind === "course" ? subgroupsForCourse(data, value) : lettersForGrade(data, value);
    const subLabel = kind === "course" ? "Подгруппа" : "Литера";
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11.5,
        color: THEME.goldDim
      }
    }, subLabel, ":"), /*#__PURE__*/React.createElement(LetterChip, {
      label: "\u0412\u0441\u0435",
      active: letterFilter === "all",
      onClick: () => setLetterFilter("all")
    }), subs.length > 0 && /*#__PURE__*/React.createElement(LetterChip, {
      label: kind === "course" ? "Без подгруппы" : "Без литеры",
      active: letterFilter === "none",
      onClick: () => setLetterFilter("none")
    }), subs.map(cl => /*#__PURE__*/React.createElement(LetterChip, {
      key: cl.id,
      label: kind === "course" ? cl.name : `${value}${cl.name}`,
      active: letterFilter === cl.id,
      onClick: () => setLetterFilter(cl.id)
    })));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: THEME.goldDim
    }
  }, "\u0427\u0435\u0442\u0432\u0435\u0440\u0442\u0435\u0439: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: THEME.gold
    }
  }, qc), " ", data.vacations.length ? "(по датам каникул)" : "(добавьте каникулы в календаре, чтобы разделить год на четверти)", ". \u0421\u043F\u0438\u0441\u043E\u043A \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u2014 \u0432\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \xAB\u0421\u043F\u0438\u0441\u043A\u0438 \u043A\u043B\u0430\u0441\u0441\u043E\u0432\xBB."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    disabled: students.length === 0,
    onClick: () => setReportModal({
      mode: "class"
    })
  }, "\uD83D\uDCC4 \u041E\u0442\u0447\u0451\u0442 \u043F\u043E \u043A\u043B\u0430\u0441\u0441\u0443"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    disabled: students.length === 0,
    onClick: () => setAddMarkOpen(true)
  }, "+ \u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u0431\u0435\u0437 \u0443\u0440\u043E\u043A\u0430"), kind === "class" && /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setXlsxOpen(true),
    title: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043E\u0446\u0435\u043D\u043A\u0438 \u0438\u0437 \u0442\u0430\u0431\u043B\u0438\u0446\u044B Excel, \u0432\u044B\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u043E\u0439 \u0438\u0437 \u0448\u043A\u043E\u043B\u044C\u043D\u043E\u0433\u043E \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0433\u043E \u0436\u0443\u0440\u043D\u0430\u043B\u0430"
  }, "\uD83D\uDCE5 \u0418\u043C\u043F\u043E\u0440\u0442 \u0438\u0437 \u044D\u043B. \u0436\u0443\u0440\u043D\u0430\u043B\u0430 (.xlsx)"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#8593a3"
    }
  }, "\u041E\u0442\u0447\u0451\u0442 \u043F\u043E \u0443\u0447\u0435\u043D\u0438\u043A\u0443 \u2014 \u043A\u043B\u0438\u043A \u043F\u043E \u0438\u043C\u0435\u043D\u0438. \u041E\u0442\u0447\u0451\u0442 \u0437\u0430 \u0434\u0430\u0442\u0443 \u2014 \u043A\u043B\u0438\u043A \u043F\u043E \u0447\u0438\u0441\u043B\u0443 \u0432 \u0448\u0430\u043F\u043A\u0435 \u0442\u0430\u0431\u043B\u0438\u0446\u044B.")), students.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      textAlign: "center",
      padding: 30
    }
  }, "\u0421\u043F\u0438\u0441\u043E\u043A \u043F\u0443\u0441\u0442 \u2014 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u044D\u0442\u043E\u0433\u043E \u043A\u043B\u0430\u0441\u0441\u0430/\u043A\u0443\u0440\u0441\u0430 \u0432\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \xAB\u0421\u043F\u0438\u0441\u043A\u0438 \u043A\u043B\u0430\u0441\u0441\u043E\u0432\xBB.") : /*#__PURE__*/React.createElement(React.Fragment, null, Array.from({
    length: qc
  }).map((_, q) => {
    const dates = datesForQuarter(q);
    if (!dates.length) return null;
    const monthGroups = [];
    dates.forEach(d => {
      const label = shortMon(d);
      const last = monthGroups[monthGroups.length - 1];
      if (last && last.label === label) last.count++;else monthGroups.push({
        label,
        count: 1
      });
    });
    const cellBorder = "1.5px solid #aebdcc";
    return /*#__PURE__*/React.createElement("div", {
      key: q
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 15,
        marginBottom: 8,
        color: THEME.panelText
      }
    }, "\u0427\u0435\u0442\u0432\u0435\u0440\u0442\u044C ", q + 1, gridScale === "100" ? " · 100-балльная шкала" : ""), /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: "auto"
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        borderCollapse: "collapse",
        fontSize: 14.5,
        border: `2.5px solid ${THEME.bgDark}`
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        color: "#5a6b7d",
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement("th", {
      rowSpan: 3,
      style: {
        padding: "6px 10px",
        border: cellBorder
      }
    }, "\u2116"), /*#__PURE__*/React.createElement("th", {
      rowSpan: 3,
      style: {
        padding: "6px 12px",
        textAlign: "left",
        border: cellBorder
      }
    }, "\u0424.\u0418.\u041E."), monthGroups.map((g, i) => /*#__PURE__*/React.createElement("th", {
      key: i,
      colSpan: g.count,
      style: {
        padding: "4px 6px",
        border: cellBorder,
        textTransform: "capitalize"
      }
    }, g.label)), /*#__PURE__*/React.createElement("th", {
      rowSpan: 3,
      style: {
        padding: "6px 12px",
        border: cellBorder
      }
    }, "\u0421\u0440. \u0431\u0430\u043B\u043B"), /*#__PURE__*/React.createElement("th", {
      rowSpan: 3,
      style: {
        padding: "6px 12px",
        border: cellBorder
      }
    }, "\u041A\u043E\u043B-\u0432\u043E")), /*#__PURE__*/React.createElement("tr", {
      style: {
        color: "#8593a3",
        fontSize: 11.5
      }
    }, dates.map(d => /*#__PURE__*/React.createElement("th", {
      key: d,
      style: {
        padding: "2px 4px",
        border: cellBorder,
        fontWeight: 500,
        background: isDateMarked(d) ? JOURNAL_MARKED_BG : undefined
      }
    }, weekdayShort(d)))), /*#__PURE__*/React.createElement("tr", {
      style: {
        fontSize: 13
      }
    }, dates.map(d => /*#__PURE__*/React.createElement("th", {
      key: d,
      onMouseEnter: () => setHoverCell({
        studentId: null,
        date: d
      }),
      onMouseLeave: () => setHoverCell(null),
      style: {
        padding: "3px 6px 6px",
        fontWeight: 800,
        border: cellBorder,
        color: THEME.bgDark,
        background: isDateMarked(d) ? JOURNAL_MARKED_BG : hoverCell?.date === d ? "#eaf2fa" : undefined
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => setReportModal({
        mode: "date",
        date: d
      }),
      title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u0442\u0447\u0451\u0442 \u0437\u0430 \u044D\u0442\u0443 \u0434\u0430\u0442\u0443",
      style: {
        cursor: "pointer"
      }
    }, dayNum(d)), " ", /*#__PURE__*/React.createElement("span", {
      onClick: () => setBulkDate(d),
      title: "\u041F\u0440\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u0432\u0441\u0435\u043C \u043D\u0430 \u044D\u0442\u0443 \u0434\u0430\u0442\u0443",
      style: {
        cursor: "pointer",
        fontSize: 10.5
      }
    }, "\u270F\uFE0F"), " ", /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: isDateMarked(d),
      onChange: () => toggleDateMarked(d),
      title: "\u041E\u0442\u043C\u0435\u0442\u043A\u0438 \u0432\u044B\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u044B \u2014 \u0437\u0430\u043A\u0440\u0430\u0441\u0438\u0442\u044C \u0441\u0442\u043E\u043B\u0431\u0435\u0446",
      style: {
        verticalAlign: "middle",
        cursor: "pointer"
      }
    }))))), /*#__PURE__*/React.createElement("tbody", null, students.map((s, idx) => {
      const marksByDate = {};
      studentMarksOf(data, s.id, gridScale).filter(m => quarterOfDate(data, m.date) === q).forEach(m => marksByDate[m.date] = m);

      // Норма отметок за период (четверть/полугодие) — подсвечиваем имя, если не набрано
      // и времени/уроков до конца периода остаётся мало (тем сильнее, чем меньше уроков впереди).
      const sSettings = settingsForStudent(data, s);
      const periodIdx = sSettings.periodMode === "semester" ? semesterOfQuarter(q) : q;
      const periodQuarters = quartersInPeriod(sSettings.periodMode, periodIdx, qc);
      const haveCount = periodQuarters.reduce((sum, qq) => sum + numericMarksOf(data, s.id, gridScale).filter(m => quarterOfDate(data, m.date) === qq).length, 0);
      const remainingLessons = groupLessons.filter(l => {
        if (isLessonStudied(l)) return false;
        const ld = l.plannedDate || l.actualDate;
        if (!ld || ld < todayIso()) return false;
        return periodQuarters.includes(quarterOfDate(data, ld));
      }).length;
      const nameColor = urgencyColorFor(haveCount, sSettings.requiredMarks, remainingLessons) || THEME.bgDark;
      return /*#__PURE__*/React.createElement("tr", {
        key: s.id,
        style: {
          background: hoverCell?.studentId === s.id ? "#eaf2fa" : undefined
        }
      }, /*#__PURE__*/React.createElement("td", {
        style: {
          padding: "6px 10px",
          textAlign: "center",
          color: "#8593a3",
          border: cellBorder
        }
      }, idx + 1), /*#__PURE__*/React.createElement("td", {
        onClick: () => setReportModal({
          mode: "student",
          studentId: s.id
        }),
        title: sSettings.requiredMarks ? `Отметок за период: ${haveCount} из ${sSettings.requiredMarks}, уроков впереди: ${remainingLessons}` : "Открыть отчёт по ученику",
        style: {
          padding: "7px 12px",
          fontWeight: 700,
          color: nameColor,
          cursor: "pointer",
          whiteSpace: "nowrap",
          border: cellBorder
        }
      }, s.name), dates.map(d => {
        const m = marksByDate[d];
        const highlighted = hoverCell?.studentId === s.id || hoverCell?.date === d;
        return /*#__PURE__*/React.createElement("td", {
          key: d,
          onClick: () => setCellModal({
            studentId: s.id,
            date: d
          }),
          onMouseEnter: () => setHoverCell({
            studentId: s.id,
            date: d
          }),
          onMouseLeave: () => setHoverCell(null),
          title: m ? markTooltip(data, m) : formatDateRu(d),
          style: {
            padding: "4px 4px",
            textAlign: "center",
            cursor: "pointer",
            border: cellBorder,
            background: isDateMarked(d) ? JOURNAL_MARKED_BG : highlighted ? "#eaf2fa" : undefined
          }
        }, m ? /*#__PURE__*/React.createElement("span", {
          style: {
            display: "inline-flex",
            minWidth: 30,
            height: 30,
            padding: "0 4px",
            borderRadius: 6,
            color: "#fff",
            fontWeight: 700,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            background: m.value === "Н" ? m.excused ? "#8593a3" : THEME.red : markColorFor(m.value, m.scale)
          }
        }, m.value) : /*#__PURE__*/React.createElement("span", {
          style: {
            color: "#c3ceda"
          }
        }, "\xB7"));
      }), /*#__PURE__*/React.createElement("td", {
        style: {
          padding: "6px 14px",
          textAlign: "center",
          fontWeight: 800,
          border: cellBorder
        }
      }, fmtAvgNum(quarterAvgOf(data, s.id, q, gridScale))), /*#__PURE__*/React.createElement("td", {
        style: {
          padding: "6px 14px",
          textAlign: "center",
          color: "#7a8a9c",
          border: cellBorder
        }
      }, numericMarksOf(data, s.id, gridScale).filter(m => quarterOfDate(data, m.date) === q).length));
    })))));
  })), cellModal && (() => {
    const cStudent = students.find(s => s.id === cellModal.studentId);
    if (!cStudent) return null;
    const cLesson = lessonForDate(cellModal.date);
    const cExisting = studentMarksOf(data, cellModal.studentId, gridScale).find(m => m.date === cellModal.date);
    return /*#__PURE__*/React.createElement(MarkCellModal, {
      key: `${cellModal.studentId}-${cellModal.date}`,
      student: cStudent,
      date: cellModal.date,
      lesson: cLesson,
      existingMark: cExisting,
      scale: gridScale,
      onSave: patch => {
        saveCellMark(cellModal, patch);
        setCellModal(null);
      },
      onNavigate: (direction, patch) => {
        if (patch) saveCellMark(cellModal, patch);
        navigateCell(direction);
      },
      onClear: () => {
        update(d => {
          const removedIds = d.marks.filter(m => m.studentId === cellModal.studentId && m.date === cellModal.date && (m.scale || "5") === gridScale).map(m => m.id);
          d.marks = d.marks.filter(m => !(m.studentId === cellModal.studentId && m.date === cellModal.date && (m.scale || "5") === gridScale));
          // Убираем ученика и из упражнения в уроке, если отметка была поставлена оттуда —
          // иначе на странице урока осталась бы "призрачная" запись, которой уже нет в журнале.
          d.lessons.forEach(l => {
            (l.items || []).forEach(it => {
              if (Array.isArray(it.students)) {
                it.students = it.students.filter(entry => !removedIds.includes(entry.markId));
              }
            });
          });
          return d;
        });
        setCellModal(null);
      },
      onClose: () => setCellModal(null)
    });
  })(), xlsxOpen && /*#__PURE__*/React.createElement(JournalXlsxImportModal, {
    data: data,
    update: update,
    onClose: () => setXlsxOpen(false)
  }), reportModal && /*#__PURE__*/React.createElement(JournalReportModal, {
    mode: reportModal.mode,
    studentId: reportModal.studentId,
    date: reportModal.date,
    data: data,
    students: students,
    groupLabel: groupLabel,
    qc: qc,
    onClose: () => setReportModal(null)
  }), addMarkOpen && /*#__PURE__*/React.createElement(AddJournalMarkModal, {
    students: students,
    gridScale: gridScale,
    onClose: () => setAddMarkOpen(false),
    onSave: entry => {
      update(d => {
        const l = lessonForDate(entry.date);
        d.marks.push({
          id: uid(),
          lessonId: l?.id || null,
          exerciseId: null,
          ...entry
        });
        return d;
      });
      setAddMarkOpen(false);
    }
  }), bulkDate && /*#__PURE__*/React.createElement(BulkMarkModal, {
    students: students,
    date: bulkDate,
    data: data,
    gridScale: gridScale,
    onClose: () => setBulkDate(null),
    onSave: results => {
      update(d => {
        const l = lessonForDate(bulkDate);
        results.forEach(({
          studentId,
          value,
          excused
        }) => {
          let mark = d.marks.find(m => m.studentId === studentId && m.date === bulkDate && (m.scale || "5") === gridScale);
          if (mark) {
            mark.value = value;
            mark.excused = excused;
            mark.scale = gridScale;
          } else {
            d.marks.push({
              id: uid(),
              studentId,
              date: bulkDate,
              value,
              excused,
              scale: gridScale,
              reason: "",
              lessonId: l?.id || null,
              exerciseId: null
            });
          }
        });
        return d;
      });
      setBulkDate(null);
    }
  }));
}

/* ============================================================
   СТРАНИЦА УРОКА
   ============================================================ */
function LessonPage({
  data,
  update,
  lesson,
  onBack
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTypeChoice, setNewTypeChoice] = useState(data.tags.type[0]?.id || "");
  const [showCreateHomework, setShowCreateHomework] = useState(false);
  const homeworkFileRef = useRef(null);
  const [newHomeworkTypeChoice, setNewHomeworkTypeChoice] = useState(data.tags.type[0]?.id || "");
  const [viewingTheoryId, setViewingTheoryId] = useState(null);
  const [viewingExerciseId, setViewingExerciseId] = useState(null);
  const [openNoteId, setOpenNoteId] = useState(null);
  const [openStudentId, setOpenStudentId] = useState(null);
  const [justAddedEntryId, setJustAddedEntryId] = useState(null);
  const [addingLessonType, setAddingLessonType] = useState(false);
  const [newLessonTypeName, setNewLessonTypeName] = useState("");
  const [newLessonTypeColor, setNewLessonTypeColor] = useState(SWATCHES[0]);
  const [copyLettersOpen, setCopyLettersOpen] = useState(false);
  const [copyLettersChecked, setCopyLettersChecked] = useState([]);
  const [sendStudentId, setSendStudentId] = useState("");
  const [worksheetStudent, setWorksheetStudent] = useState(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState(null); // {kind: "exercise"|"theory"|"homeworkText", id}

  const setLesson = patch => {
    update(d => {
      const l = d.lessons.find(x => x.id === lesson.id);
      Object.assign(l, patch);
      // Дата урока поменялась вручную — порядок в списке "Уроки и курсы" пересчитывается вслед за календарём.
      if ("plannedDate" in patch) resyncOrderForGroup(d, l);
      return d;
    });
  };
  const toggleTopicTag = id => {
    const has = lesson.topicTagIds.includes(id);
    setLesson({
      topicTagIds: has ? lesson.topicTagIds.filter(x => x !== id) : [...lesson.topicTagIds, id]
    });
  };
  const ensureTopicTag = name => {
    let tag = data.tags.topic.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (tag) return tag.id;
    const id = uid();
    update(d => {
      d.tags.topic.push({
        id,
        name,
        color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)]
      });
      return d;
    });
    return id;
  };
  const deleteTopicTagGlobal = id => {
    if (!window.confirm("Удалить тег темы совсем? Он пропадёт из всех упражнений, уроков и теории, где использовался.")) return;
    update(d => {
      d.tags.topic = d.tags.topic.filter(t => t.id !== id);
      d.examples.forEach(ex => ex.topicTagIds = ex.topicTagIds.filter(t => t !== id));
      d.lessons.forEach(l => l.topicTagIds = (l.topicTagIds || []).filter(t => t !== id));
      d.theory.forEach(p => p.topicTagIds = (p.topicTagIds || []).filter(t => t !== id));
      return d;
    });
  };
  const toggleLessonTypeTag = id => {
    const has = (lesson.lessonTypeTagIds || []).includes(id);
    setLesson({
      lessonTypeTagIds: has ? lesson.lessonTypeTagIds.filter(x => x !== id) : [...(lesson.lessonTypeTagIds || []), id]
    });
  };
  const addLessonTypeTag = () => {
    if (!newLessonTypeName.trim()) return;
    const id = uid();
    update(d => {
      d.tags.lessonType.push({
        id,
        name: newLessonTypeName.trim(),
        color: newLessonTypeColor
      });
      return d;
    });
    toggleLessonTypeTag(id);
    setNewLessonTypeName("");
    setNewLessonTypeColor(SWATCHES[0]);
    setAddingLessonType(false);
  };
  const deleteLessonTypeTagGlobal = id => {
    if (!window.confirm("Удалить тег типа урока совсем? Он пропадёт из всех уроков, где использовался.")) return;
    update(d => {
      d.tags.lessonType = d.tags.lessonType.filter(t => t.id !== id);
      d.lessons.forEach(l => l.lessonTypeTagIds = (l.lessonTypeTagIds || []).filter(t => t !== id));
      return d;
    });
  };
  const updateItemNote = (itemId, note) => {
    setLesson({
      items: (lesson.items || []).map(it => it.id === itemId ? {
        ...it,
        note
      } : it)
    });
  };

  // Ученики, вызванные к доске на конкретное упражнение внутри этого урока (можно
  // добавить сразу нескольких), и их отметки. Как только у записи заполнены и имя,
  // и отметка — она сразу же появляется в журнале.
  const addItemStudent = itemId => {
    const newId = uid();
    update(d => {
      const l = d.lessons.find(x => x.id === lesson.id);
      const it = (l.items || []).find(x => x.id === itemId);
      if (!it) return d;
      it.students = [...itemStudents(it), {
        id: newId,
        name: "",
        grade: "",
        gradeScale: "",
        gradeExcused: null,
        markId: null
      }];
      return d;
    });
    setJustAddedEntryId(newId);
  };
  // Быстрое добавление ученика из подсказки "Рекомендуем" — сразу с именем, без пустой строки.
  const quickAddItemStudent = (itemId, name) => {
    update(d => {
      const l = d.lessons.find(x => x.id === lesson.id);
      const it = (l.items || []).find(x => x.id === itemId);
      if (!it) return d;
      if (itemStudents(it).some(s => (s.name || "").trim().toLowerCase() === name.trim().toLowerCase())) return d;
      it.students = [...itemStudents(it), {
        id: uid(),
        name,
        grade: "",
        gradeScale: "",
        gradeExcused: null,
        markId: null
      }];
      return d;
    });
  };
  const updateItemStudentEntry = (itemId, entryId, patch) => {
    update(d => {
      const l = d.lessons.find(x => x.id === lesson.id);
      const it = (l.items || []).find(x => x.id === itemId);
      const entry = it && itemStudents(it).find(s => s.id === entryId);
      if (!entry) return d;
      Object.assign(entry, patch);
      syncStudentEntryMark(d, l, it, entry);
      return d;
    });
  };
  const removeItemStudentEntry = (itemId, entryId) => {
    update(d => {
      const l = d.lessons.find(x => x.id === lesson.id);
      const it = (l.items || []).find(x => x.id === itemId);
      if (!it) return d;
      const entry = itemStudents(it).find(s => s.id === entryId);
      if (entry && entry.markId) d.marks = d.marks.filter(m => m.id !== entry.markId);
      it.students = itemStudents(it).filter(s => s.id !== entryId);
      return d;
    });
  };

  // Переносит упражнение в "Запасные упражнения" для класса/курса этого урока
  // и убирает его из текущего урока.
  const moveItemToReserve = item => {
    update(d => {
      const l = d.lessons.find(x => x.id === lesson.id);
      l.items = (l.items || []).filter(it => it.id !== item.id);
      const groupKind = l.courseId ? "course" : "class";
      const groupValue = l.courseId || l.class;
      const classLetterId = l.classLetterId || null;
      const already = d.reserves.some(r => r.groupKind === groupKind && r.groupValue === groupValue && (r.classLetterId || null) === classLetterId && r.exerciseId === item.refId);
      if (!already) {
        d.reserves.push({
          id: uid(),
          groupKind,
          groupValue,
          classLetterId,
          exerciseId: item.refId
        });
      }
      return d;
    });
  };

  // Запас этого же класса+литеры (или курса) — показывается прямо на странице урока, внизу после ДЗ.
  const lessonReserveGroupKind = lesson.courseId ? "course" : "class";
  const lessonReserveGroupValue = lesson.courseId || lesson.class;
  const lessonReserveItems = data.reserves.filter(r => r.groupKind === lessonReserveGroupKind && r.groupValue === lessonReserveGroupValue && (r.classLetterId || null) === (lesson.classLetterId || null)).map(r => ({
    r,
    ex: data.examples.find(e => e.id === r.exerciseId)
  })).filter(x => x.ex);
  const addFromReserveToLesson = (reserveId, exId) => {
    update(d => {
      const l = d.lessons.find(x => x.id === lesson.id);
      l.items = l.items || [];
      if (!l.items.some(it => it.type === "exercise" && it.refId === exId)) {
        l.items.push({
          id: uid(),
          type: "exercise",
          refId: exId
        });
      }
      d.reserves = d.reserves.filter(r => r.id !== reserveId);
      return d;
    });
  };
  const removeFromLessonReserve = reserveId => {
    update(d => {
      d.reserves = d.reserves.filter(r => r.id !== reserveId);
      return d;
    });
  };
  const addExerciseToLesson = exId => {
    if ((lesson.items || []).some(it => it.type === "exercise" && it.refId === exId)) return;
    setLesson({
      items: [...(lesson.items || []), {
        id: uid(),
        type: "exercise",
        refId: exId
      }]
    });
  };
  const addTheoryToLesson = theoryId => {
    if ((lesson.items || []).some(it => it.type === "theory" && it.refId === theoryId)) return;
    setLesson({
      items: [...(lesson.items || []), {
        id: uid(),
        type: "theory",
        refId: theoryId
      }]
    });
  };
  const removeItem = itemId => {
    setLesson({
      items: (lesson.items || []).filter(it => it.id !== itemId)
    });
  };
  const removeExerciseFromLesson = exId => {
    setLesson({
      items: (lesson.items || []).filter(it => !(it.type === "exercise" && it.refId === exId))
    });
  };
  const removeTheoryFromLesson = theoryId => {
    setLesson({
      items: (lesson.items || []).filter(it => !(it.type === "theory" && it.refId === theoryId))
    });
  };
  const moveItem = (idx, dir) => {
    const items = lesson.items || [];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const arr = [...items];
    const tmp = arr[idx];
    arr[idx] = arr[swapIdx];
    arr[swapIdx] = tmp;
    setLesson({
      items: arr
    });
  };
  const addExerciseToHomework = exId => {
    if ((lesson.homeworkItems || []).some(it => it.refId === exId)) return;
    setLesson({
      homeworkItems: [...(lesson.homeworkItems || []), {
        id: uid(),
        type: "exercise",
        refId: exId
      }]
    });
  };
  const removeHomeworkItem = itemId => {
    setLesson({
      homeworkItems: (lesson.homeworkItems || []).filter(it => it.id !== itemId)
    });
  };
  const removeExerciseFromHomework = exId => {
    setLesson({
      homeworkItems: (lesson.homeworkItems || []).filter(it => it.refId !== exId)
    });
  };
  const moveHomeworkItem = (idx, dir) => {
    const items = lesson.homeworkItems || [];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const arr = [...items];
    const tmp = arr[idx];
    arr[idx] = arr[swapIdx];
    arr[swapIdx] = tmp;
    setLesson({
      homeworkItems: arr
    });
  };
  const handleHomeworkFiles = async files => {
    const list = Array.from(files);
    const added = [];
    for (const f of list) {
      if (f.type.startsWith("image/")) {
        const dataUrl = await resizeImage(f);
        added.push({
          id: uid(),
          name: f.name,
          kind: "image",
          dataUrl
        });
      } else if (f.size <= MAX_EMBED_FILE_SIZE) {
        const dataUrl = await fileToDataUrl(f);
        added.push({
          id: uid(),
          name: f.name,
          kind: "file",
          dataUrl,
          url: ""
        });
      } else {
        added.push({
          id: uid(),
          name: f.name,
          kind: "file",
          url: "",
          tooLarge: true
        });
      }
    }
    setLesson({
      homeworkAttachments: [...(lesson.homeworkAttachments || []), ...added]
    });
  };
  const removeHomeworkAttachment = id => {
    setLesson({
      homeworkAttachments: (lesson.homeworkAttachments || []).filter(a => a.id !== id)
    });
  };
  const setHomeworkAttachmentUrl = (id, url) => {
    setLesson({
      homeworkAttachments: (lesson.homeworkAttachments || []).map(a => a.id === id ? {
        ...a,
        url
      } : a)
    });
  };
  const theorySuggestions = useMemo(() => {
    const topicWords = (lesson.topic || "").toLowerCase().split(/\s+/).filter(Boolean);
    const chosenTopicTagIds = new Set(lesson.topicTagIds);
    const attachedIds = new Set((lesson.items || []).filter(it => it.type === "theory").map(it => it.refId));
    return data.theory.filter(p => !attachedIds.has(p.id)).map(p => {
      let score = 0;
      const hay = (p.title + " " + (p.html || "").replace(/<[^>]+>/g, " ")).toLowerCase();
      topicWords.forEach(w => {
        if (w.length > 2 && hay.includes(w)) score += 1;
      });
      (p.topicTagIds || []).forEach(t => {
        if (chosenTopicTagIds.has(t)) score += 3;
      });
      if ((p.classTags || []).includes(lesson.class)) score += 2;
      if (lesson.courseId && (p.courseTagIds || []).includes(lesson.courseId)) score += 2;
      return {
        p,
        score
      };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  }, [data.theory, lesson.topic, lesson.topicTagIds, lesson.items, lesson.class, lesson.courseId]);
  const suggestions = useMemo(() => {
    const topicWords = (lesson.topic || "").toLowerCase().split(/\s+/).filter(Boolean);
    const chosenTopicTagIds = new Set(lesson.topicTagIds);
    const attachedIds = new Set((lesson.items || []).filter(it => it.type === "exercise").map(it => it.refId));
    return data.examples.filter(ex => !attachedIds.has(ex.id)).map(ex => {
      let score = 0;
      const hay = (stripHtml(ex.text) + " " + ex.note).toLowerCase();
      topicWords.forEach(w => {
        if (w.length > 2 && hay.includes(w)) score += 1;
      });
      ex.topicTagIds.forEach(t => {
        if (chosenTopicTagIds.has(t)) score += 3;
      });
      return {
        ex,
        score
      };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  }, [data.examples, lesson.topic, lesson.topicTagIds, lesson.items]);
  const attachedItems = (lesson.items || []).map(it => ({
    it,
    obj: it.type === "exercise" ? data.examples.find(e => e.id === it.refId) : data.theory.find(p => p.id === it.refId)
  })).filter(x => x.obj);
  const attachedExerciseIds = (lesson.items || []).filter(it => it.type === "exercise").map(it => it.refId);
  const attachedTheoryIds = (lesson.items || []).filter(it => it.type === "theory").map(it => it.refId);
  const homeworkAttachedItems = (lesson.homeworkItems || []).map(it => ({
    it,
    obj: data.examples.find(e => e.id === it.refId)
  })).filter(x => x.obj);
  const attachedHomeworkExerciseIds = (lesson.homeworkItems || []).map(it => it.refId);
  const grayed = lesson.completed;
  const lessonGradingSystem = settingsForLesson(data, lesson).gradingSystem;

  // Список учеников этого класса/литеры/курса — для выбора "ученик у доски" и авторекомендации.
  const lessonRoster = sortedStudents(data.students.filter(s => (s.class || null) === (lesson.class || null) && (s.courseId || null) === (lesson.courseId || null) && (s.classLetterId || null) === (lesson.classLetterId || null)));
  // Рекомендуем вызывать тех, у кого меньше всего отметок и/или больше всего пропусков —
  // так со временем набор отметок у класса выравнивается.
  const rosterScore = s => numericMarksOf(data, s.id).length - studentMarksOf(data, s.id).filter(m => m.value === "Н").length;
  const recommendedStudents = [...lessonRoster].sort((a, b) => rosterScore(a) - rosterScore(b)).slice(0, 3);

  // Переносит тему/теги/материалы/ДЗ этого урока в выбранные литеры того же класса —
  // независимыми копиями (дата, статус "пройден" и отметки каждой литеры не трогаются).
  const otherLetters = !lesson.courseId ? lettersForGrade(data, lesson.class).filter(cl => cl.id !== (lesson.classLetterId || null)) : [];
  const copyToOtherLetters = () => {
    if (copyLettersChecked.length === 0) return;
    update(d => {
      copyLettersChecked.forEach(letterId => {
        duplicateLessonInto(d, lesson.id, {
          kind: "class",
          value: lesson.class,
          classLetterId: letterId
        });
      });
      return d;
    });
    setCopyLettersOpen(false);
    setCopyLettersChecked([]);
  };

  // Ученики этого урока с настроенной папкой автообмена + входящие ответы, уже привязанные
  // к этому уроку (последний раз, когда ему что-то отправляли).
  const exchangeRoster = lessonRoster.filter(s => window.lcShareMode || s.exchangeFolder);
  const lessonIncoming = (data.incomingAnswers || []).filter(a => a.lessonId === lesson.id);
  const openWorksheetForStudent = () => {
    const student = data.students.find(s => s.id === sendStudentId);
    if (student) setWorksheetStudent(student);
  };
  const sendWorksheetToStudent = async html => {
    const ok = await sendDocToStudent(update, worksheetStudent, lesson.topic || "Урок", html, {
      lessonId: lesson.id,
      kind: "lesson"
    });
    if (ok) alert(`Отправлено ученику «${worksheetStudent.name}»: ${lesson.topic || "Урок"}`);
    return ok;
  };
  const openIncoming = a => {
    const student = data.students.find(s => s.id === a.studentId);
    if (student?.exchangeFolder) window.lcAPI.openExchangeFile(student.exchangeFolder, a.fileName);
  };
  const markIncomingReviewed = async a => {
    const student = data.students.find(s => s.id === a.studentId);
    if (student?.exchangeFolder) await window.lcAPI.markExchangeReviewed(student.exchangeFolder, a.fileName);
    update(d => {
      d.incomingAnswers = (d.incomingAnswers || []).filter(x => x.id !== a.id);
      return d;
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      opacity: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      flexWrap: "wrap",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onBack
  }, "\u2190 \u041D\u0430\u0437\u0430\u0434"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 14,
      color: "#5a6b7d"
    }
  }, "\u0423\u0440\u043E\u043A \u2116", lessonNumber(lesson, data))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(ExportButtons, {
    onWord: () => downloadWord(lesson.topic || "urok", lesson.topic || "Урок", lessonToHtml(lesson, data)),
    onPdf: () => printAsPdf(lesson.topic || "Урок", lessonToHtml(lesson, data)),
    labeled: true
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => downloadJson(sanitizeFileName(lesson.topic || "urok"), lessonExportPayload(lesson, data), "lsnrus")
  }, "\uD83D\uDCE4 \u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0443\u0440\u043E\u043A \u0432 \u0444\u0430\u0439\u043B (.lsnrus)"), exchangeRoster.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: sendStudentId,
    onChange: e => setSendStudentId(e.target.value),
    style: {
      ...inputStyle,
      padding: "6px 8px",
      fontSize: 12.5,
      maxWidth: 170
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0443\u0447\u0435\u043D\u0438\u043A\u0443\u2026"), exchangeRoster.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name))), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    disabled: !sendStudentId,
    onClick: openWorksheetForStudent
  }, "\uD83D\uDCDD \u0421\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u043B\u0438\u0441\u0442"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    title: "\u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u0447\u0435\u043A-\u043B\u0438\u0441\u0442 \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u043B\u0438\u0441\u0442\u0430",
    onClick: () => setChecklistOpen(true)
  }, "\u2699")), otherLetters.length > 0 && /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => {
      setCopyLettersOpen(!copyLettersOpen);
      setCopyLettersChecked([]);
    }
  }, "\uD83D\uDCBE \u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0432 \u0434\u0440\u0443\u0433\u0438\u0435 \u043B\u0438\u0442\u0435\u0440\u044B"), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontWeight: 700,
      fontSize: 13.5
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!lesson.needsWork,
    onChange: e => setLesson({
      needsWork: e.target.checked
    })
  }), "\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438"))), copyLettersOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: -8,
      marginBottom: 16,
      padding: 10,
      background: "#f6fbfe",
      borderRadius: 8,
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "#5a6b7d"
    }
  }, "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0442\u0435\u043C\u0443, \u0442\u0435\u0433\u0438, \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u0438 \u0414\u0417 \u044D\u0442\u043E\u0433\u043E \u0443\u0440\u043E\u043A\u0430 \u0432 \u043B\u0438\u0442\u0435\u0440\u044B (\u0434\u0430\u0442\u0430 \u0438 \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u043A\u0430\u0436\u0434\u043E\u0439 \u043B\u0438\u0442\u0435\u0440\u044B \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0442\u0441\u044F):"), otherLetters.map(cl => /*#__PURE__*/React.createElement("label", {
    key: cl.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      fontSize: 12.5,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: copyLettersChecked.includes(cl.id),
    onChange: e => setCopyLettersChecked(prev => e.target.checked ? [...prev, cl.id] : prev.filter(x => x !== cl.id))
  }), lesson.class, cl.name)), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    disabled: copyLettersChecked.length === 0,
    onClick: copyToOtherLetters
  }, "\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438")), lessonIncoming.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16,
      padding: 10,
      background: "#f6fbfe",
      borderRadius: 8,
      display: "grid",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "#5a6b7d"
    }
  }, "\uD83D\uDCE5 \u041E\u0442\u0432\u0435\u0442\u044B \u0443\u0447\u0435\u043D\u0438\u043A\u043E\u0432 \u043F\u043E \u044D\u0442\u043E\u043C\u0443 \u0443\u0440\u043E\u043A\u0443"), lessonIncoming.map(a => {
    const student = data.students.find(s => s.id === a.studentId);
    return /*#__PURE__*/React.createElement("div", {
      key: a.id,
      style: {
        ...cardStyle,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 140
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 12.5
      }
    }, student?.name || "Ученик удалён"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#7a8a9c"
      }
    }, a.fileName)), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => openIncoming(a)
    }, "\u041E\u0442\u043A\u0440\u044B\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
      kind: "pastel",
      small: true,
      onClick: () => markIncomingReviewed(a)
    }, "\u2713 \u041E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E"));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      color: grayed ? "#9aa4ae" : "#12233a"
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0435\u043C\u0430 \u0443\u0440\u043E\u043A\u0430"
  }, /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    value: lesson.topic,
    onChange: e => setLesson({
      topic: e.target.value
    }),
    placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u041F\u0440\u0430\u0432\u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u0441\u0442\u0430\u0432\u043E\u043A \u043F\u0440\u0435- \u0438 \u043F\u0440\u0438-"
  })), !lesson.courseId && lettersForGrade(data, lesson.class).length > 0 && /*#__PURE__*/React.createElement(Field, {
    label: "\u041B\u0438\u0442\u0435\u0440\u0430 (\u043A\u0430\u043A\u043E\u0439 \u0438\u0437 \u043F\u0430\u0440\u0430\u043B\u043B\u0435\u043B\u044C\u043D\u044B\u0445 \u043A\u043B\u0430\u0441\u0441\u043E\u0432)"
  }, /*#__PURE__*/React.createElement("select", {
    style: {
      ...inputStyle,
      maxWidth: 220
    },
    value: lesson.classLetterId || "",
    onChange: e => setLesson({
      classLetterId: e.target.value || null
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u0411\u0435\u0437 \u043B\u0438\u0442\u0435\u0440\u044B"), lettersForGrade(data, lesson.class).map(cl => /*#__PURE__*/React.createElement("option", {
    key: cl.id,
    value: cl.id
  }, lesson.class, cl.name)))), /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0435\u0433\u0438 \xAB\u0422\u0435\u043C\u0430 \u0443\u0440\u043E\u043A\u0430\xBB"
  }, /*#__PURE__*/React.createElement(TopicTagPicker, {
    data: data,
    selectedIds: lesson.topicTagIds,
    onToggle: toggleTopicTag,
    ensureTopicTag: ensureTopicTag,
    onDeleteTag: deleteTopicTagGlobal
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0435\u0433\u0438 \xAB\u0422\u0438\u043F \u0443\u0440\u043E\u043A\u0430\xBB"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 8
    }
  }, data.tags.lessonType.map(t => /*#__PURE__*/React.createElement(Badge, {
    key: t.id,
    tag: t,
    active: (lesson.lessonTypeTagIds || []).includes(t.id),
    onClick: () => toggleLessonTypeTag(t.id),
    onRemove: () => deleteLessonTypeTagGlobal(t.id)
  })), data.tags.lessonType.length === 0 && !addingLessonType && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "#8593a3"
    }
  }, "\u0422\u0435\u0433\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442.")), !addingLessonType ? /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px dashed #9bb6c9"
    },
    onClick: () => setAddingLessonType(true)
  }, "+ \u041D\u043E\u0432\u044B\u0439 \u0442\u0438\u043F \u0443\u0440\u043E\u043A\u0430") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    style: {
      ...inputStyle,
      maxWidth: 200
    },
    placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
    value: newLessonTypeName,
    onChange: e => setNewLessonTypeName(e.target.value),
    onKeyDown: e => e.key === "Enter" && addLessonTypeTag()
  }), /*#__PURE__*/React.createElement(ColorPicker, {
    value: newLessonTypeColor,
    onChange: setNewLessonTypeColor
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addLessonTypeTag
  }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C"), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setAddingLessonType(false)
  }, "\u041E\u0442\u043C\u0435\u043D\u0430")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 16,
    style: {
      color: THEME.panelText,
      marginBottom: 10
    }
  }, "\u0414\u0430\u0442\u0430 \u0443\u0440\u043E\u043A\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      flexWrap: "wrap",
      color: grayed ? "#9aa4ae" : "#12233a"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 180
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\u041F\u043B\u0430\u043D\u0438\u0440\u0443\u0435\u043C\u0430\u044F \u0434\u0430\u0442\u0430"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: inputStyle,
    value: lesson.plannedDate || "",
    onChange: e => setLesson({
      plannedDate: e.target.value
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 180
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\u0424\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0434\u0430\u0442\u0430"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: inputStyle,
    value: lesson.actualDate || "",
    onChange: e => setLesson({
      actualDate: e.target.value
    })
  })))), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      fontWeight: 700,
      marginTop: 4,
      color: grayed ? "#9aa4ae" : "#12233a"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!lesson.excludeFromSchedule,
    onChange: e => setLesson({
      excludeFromSchedule: e.target.checked
    })
  }), "\u041D\u0435 \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0442\u044C \u0443\u0440\u043E\u043A (\u043A\u0430\u043B\u044C\u043A\u0443\u043B\u044F\u0442\u043E\u0440 \u0431\u0443\u0434\u0435\u0442 \u0441\u0447\u0438\u0442\u0430\u0442\u044C \u0435\u0433\u043E \u0438\u0437\u0443\u0447\u0435\u043D\u043D\u044B\u043C)"), (() => {
    const diffDays = lessonDateDiffDays(lesson);
    if (diffDays === null) return null;
    let label, color;
    if (diffDays === 0) {
      label = "Проведён точно по плану";
      color = "#12233a";
    } else if (diffDays < 0) {
      label = `Опережение на ${Math.abs(diffDays)} ${pluralizeRu(Math.abs(diffDays), "день", "дня", "дней")}`;
      color = "#1b5e20";
    } else {
      label = `Отставание на ${diffDays} ${pluralizeRu(diffDays, "день", "дня", "дней")}`;
      color = THEME.red;
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        fontWeight: 800,
        fontSize: 13,
        color
      }
    }, "\uD83D\uDCCA ", label);
  })()), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 16,
    style: {
      color: THEME.panelText,
      marginBottom: 10
    }
  }, "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u0443\u0440\u043E\u043A\u0430"), attachedItems.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#8593a3",
      marginBottom: 10
    }
  }, "\u0423\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F \u0438 \u0442\u0435\u043E\u0440\u0438\u044F \u0435\u0449\u0451 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8,
      marginBottom: 14
    }
  }, attachedItems.map(({
    it,
    obj
  }, idx) => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    className: "lc-row",
    onClick: () => it.type === "theory" ? setViewingTheoryId(obj.id) : setViewingExerciseId(obj.id),
    style: {
      ...cardStyle,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      opacity: grayed ? 0.55 : 1,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: "#8a97a5",
      fontSize: 12.5,
      minWidth: 18
    }
  }, idx + 1, "."), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, it.type === "exercise" ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      flexWrap: "wrap"
    }
  }, data.tags.type.find(t => t.id === obj.typeTagId) && /*#__PURE__*/React.createElement(Badge, {
    tag: data.tags.type.find(t => t.id === obj.typeTagId)
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 13.5
    },
    dangerouslySetInnerHTML: {
      __html: obj.text
    }
  }), obj.redNote && /*#__PURE__*/React.createElement("span", {
    style: {
      color: THEME.red,
      fontWeight: 700,
      fontSize: 11.5
    }
  }, "\u2691 ", obj.redNote)) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "#5a6b7d"
    }
  }, "\uD83D\uDCD8"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 13.5
    }
  }, obj.title)), it.note && openNoteId !== it.id && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#8a6d1f",
      fontStyle: "italic",
      marginTop: 3
    }
  }, "\uD83D\uDCDD ", it.note), openNoteId === it.id && /*#__PURE__*/React.createElement("textarea", {
    autoFocus: true,
    rows: 2,
    style: {
      ...inputStyle,
      fontSize: 12,
      marginTop: 6,
      resize: "vertical"
    },
    placeholder: "\u0417\u0430\u043C\u0435\u0442\u043A\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0443\u0440\u043E\u043A\u0430\u2026",
    value: it.note || "",
    onClick: e => e.stopPropagation(),
    onChange: e => updateItemNote(it.id, e.target.value)
  }), it.type === "exercise" && itemStudents(it).length > 0 && openStudentId !== it.id && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 3,
      flexWrap: "wrap"
    },
    onClick: e => {
      e.stopPropagation();
      setOpenStudentId(it.id);
    }
  }, itemStudents(it).map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "#12233a"
    }
  }, "\uD83C\uDF93 ", s.name || "(без имени)"), s.grade && /*#__PURE__*/React.createElement("span", {
    style: s.grade === "Н" ? {
      fontSize: 11,
      fontWeight: 800,
      color: "#fff",
      background: s.gradeExcused === false ? THEME.red : "#8593a3",
      borderRadius: 6,
      padding: "1px 7px"
    } : {
      fontSize: 11,
      fontWeight: 800,
      color: THEME.bgDark,
      background: THEME.pastel,
      borderRadius: 6,
      padding: "1px 7px"
    }
  }, s.grade, s.gradeScale === "100" ? "/100" : "")))), it.type === "exercise" && openStudentId === it.id && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    },
    onClick: e => e.stopPropagation()
  }, itemStudents(it).length === 0 && recommendedStudents.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
      width: "100%",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: "#8593a3"
    }
  }, "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C (\u043C\u0435\u043D\u044C\u0448\u0435 \u043E\u0442\u043C\u0435\u0442\u043E\u043A / \u0431\u043E\u043B\u044C\u0448\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u043E\u0432):"), recommendedStudents.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    onClick: () => quickAddItemStudent(it.id, s.name),
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: THEME.bgDark,
      background: THEME.pastel,
      borderRadius: 6,
      padding: "2px 8px",
      cursor: "pointer"
    }
  }, s.name))), itemStudents(it).map(entry => /*#__PURE__*/React.createElement("div", {
    key: entry.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: entry.id === justAddedEntryId,
    onBlur: () => setJustAddedEntryId(null),
    list: `roster-${lesson.id}`,
    style: {
      ...inputStyle,
      fontSize: 12,
      maxWidth: 170,
      padding: "5px 8px"
    },
    placeholder: "\u0423\u0447\u0435\u043D\u0438\u043A \u0443 \u0434\u043E\u0441\u043A\u0438\u2026",
    value: entry.name || "",
    onChange: e => updateItemStudentEntry(it.id, entry.id, {
      name: e.target.value
    })
  }), entry.grade === "Н" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u0423\u0432\u0430\u0436.",
    active: entry.gradeExcused !== false,
    onClick: () => updateItemStudentEntry(it.id, entry.id, {
      gradeExcused: true
    })
  }), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041D\u0435\u0443\u0432\u0430\u0436.",
    active: entry.gradeExcused === false,
    onClick: () => updateItemStudentEntry(it.id, entry.id, {
      gradeExcused: false
    })
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, lessonGradingSystem === "combined" && /*#__PURE__*/React.createElement("select", {
    style: {
      ...inputStyle,
      fontSize: 11,
      maxWidth: 58,
      padding: "5px 6px"
    },
    title: "\u0428\u043A\u0430\u043B\u0430",
    value: entry.gradeScale || "5",
    onChange: e => updateItemStudentEntry(it.id, entry.id, {
      gradeScale: e.target.value,
      grade: ""
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "5"
  }, "5-\u0431"), /*#__PURE__*/React.createElement("option", {
    value: "100"
  }, "100-\u0431")), lessonGradingSystem === "100" || lessonGradingSystem === "combined" && (entry.gradeScale || "5") === "100" ? /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: "100",
    style: {
      ...inputStyle,
      fontSize: 12,
      maxWidth: 60,
      padding: "5px 8px"
    },
    title: "\u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u2014 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435",
    placeholder: "0\u2013100",
    value: entry.grade || "",
    onChange: e => updateItemStudentEntry(it.id, entry.id, {
      grade: e.target.value,
      gradeScale: "100"
    })
  }) : /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "5",
    style: {
      ...inputStyle,
      fontSize: 12,
      maxWidth: 50,
      padding: "5px 8px"
    },
    title: "\u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u2014 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0432 \u0436\u0443\u0440\u043D\u0430\u043B\u0435",
    placeholder: "1\u20135",
    value: entry.grade || "",
    onChange: e => updateItemStudentEntry(it.id, entry.id, {
      grade: e.target.value,
      gradeScale: "5"
    })
  })), /*#__PURE__*/React.createElement(LetterChip, {
    label: "\u041D",
    active: entry.grade === "Н",
    onClick: () => updateItemStudentEntry(it.id, entry.id, entry.grade === "Н" ? {
      grade: "",
      gradeExcused: null
    } : {
      grade: "Н",
      gradeExcused: true,
      gradeScale: "5"
    })
  }), /*#__PURE__*/React.createElement("span", {
    title: "\u0423\u0431\u0440\u0430\u0442\u044C \u044D\u0442\u043E\u0433\u043E \u0443\u0447\u0435\u043D\u0438\u043A\u0430",
    onClick: () => removeItemStudentEntry(it.id, entry.id),
    style: {
      cursor: "pointer",
      color: THEME.red,
      fontWeight: 900,
      fontSize: 14
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement("datalist", {
    id: `roster-${lesson.id}`
  }, lessonRoster.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.name
  }))), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px dashed #9bb6c9"
    },
    onClick: () => addItemStudent(it.id)
  }, "+ \u0415\u0449\u0451 \u0443\u0447\u0435\u043D\u0438\u043A")))), /*#__PURE__*/React.createElement("div", {
    className: "lc-reveal",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 2,
      flexShrink: 0
    },
    onClick: e => e.stopPropagation()
  }, it.type === "exercise" && /*#__PURE__*/React.createElement("label", {
    title: "\u0423\u0431\u0440\u0430\u0442\u044C \u0432 \u0437\u0430\u043F\u0430\u0441\u043D\u044B\u0435 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043A\u043B\u0430\u0441\u0441\u0430/\u043A\u0443\u0440\u0441\u0430",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 3,
      fontSize: 10.5,
      color: "#5a6b7d",
      cursor: "pointer",
      marginRight: 4
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    onChange: () => moveItemToReserve(it),
    style: {
      margin: 0
    }
  }), "\u0412 \u0437\u0430\u043F\u0430\u0441"), it.type === "exercise" && /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u0423\u0447\u0435\u043D\u0438\u043A\u0438 \u0443 \u0434\u043E\u0441\u043A\u0438 \u0438 \u043E\u0442\u043C\u0435\u0442\u043A\u0438 \u0437\u0430 \u044D\u0442\u043E \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435",
    onClick: () => setOpenStudentId(openStudentId === it.id ? null : it.id)
  }, "\uD83C\uDF93"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u0417\u0430\u043C\u0435\u0442\u043A\u0430 \u043A \u044D\u0442\u043E\u043C\u0443 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044E",
    onClick: () => setOpenNoteId(openNoteId === it.id ? null : it.id)
  }, "\uD83D\uDCDD"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u041F\u0435\u0447\u0430\u0442\u044C / \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 (\u043C\u043E\u0436\u043D\u043E \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u043F\u0438\u0439 \u043D\u0430 \u043B\u0438\u0441\u0442\u0435)",
    onClick: () => setPrintTarget({
      kind: it.type,
      id: obj.id
    })
  }, "\uD83D\uDDA8"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u0412\u044B\u0448\u0435",
    onClick: () => moveItem(idx, -1),
    style: idx === 0 ? {
      opacity: 0.3,
      pointerEvents: "none"
    } : undefined
  }, "\u2191"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u041D\u0438\u0436\u0435",
    onClick: () => moveItem(idx, 1),
    style: idx === attachedItems.length - 1 ? {
      opacity: 0.3,
      pointerEvents: "none"
    } : undefined
  }, "\u2193"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u0423\u0431\u0440\u0430\u0442\u044C",
    onClick: () => removeItem(it.id),
    style: {
      color: THEME.red
    }
  }, "\u2715"))))), suggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: "#5a6b7d",
      marginBottom: 6
    }
  }, "\u0423\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F \u2014 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u043F\u043E\u0434\u043E\u0439\u0434\u0451\u0442 \u043F\u043E \u0442\u0435\u043C\u0435:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, suggestions.map(({
    ex
  }) => /*#__PURE__*/React.createElement("div", {
    key: ex.id,
    style: {
      ...cardStyle,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#f6fbfe"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, stripHtml(ex.text)), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => addExerciseToLesson(ex.id)
  }, "+ \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, !showCreate ? /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px dashed #9bb6c9"
    },
    onClick: () => setShowCreate(true)
  }, "+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u043E\u0435 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435") : /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0438\u043F \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F"
  }, /*#__PURE__*/React.createElement("select", {
    style: inputStyle,
    value: newTypeChoice,
    onChange: e => setNewTypeChoice(e.target.value)
  }, data.tags.type.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.id,
    value: t.id
  }, t.name)))), /*#__PURE__*/React.createElement(ExampleForm, {
    data: data,
    ensureTopicTag: name => {
      let tag = data.tags.topic.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (tag) return tag.id;
      const id = uid();
      update(d => {
        d.tags.topic.push({
          id,
          name,
          color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)]
        });
        return d;
      });
      return id;
    },
    onCancel: () => setShowCreate(false),
    onSave: ex => {
      const newId = uid();
      update(d => {
        d.examples.push({
          id: newId,
          typeTagId: newTypeChoice,
          richMigrated: true,
          ...ex
        });
        const l = d.lessons.find(x => x.id === lesson.id);
        l.items = [...(l.items || []), {
          id: uid(),
          type: "exercise",
          refId: newId
        }];
        return d;
      });
      setShowCreate(false);
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(ExercisePicker, {
    data: data,
    onPick: addExerciseToLesson,
    onRemove: removeExerciseFromLesson,
    attachedIds: attachedExerciseIds
  })), theorySuggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: "#5a6b7d",
      marginBottom: 6
    }
  }, "\u0422\u0435\u043E\u0440\u0438\u044F \u2014 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u043F\u043E\u0434\u043E\u0439\u0434\u0451\u0442 \u043F\u043E \u0442\u0435\u043C\u0435:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, theorySuggestions.map(({
    p
  }) => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      ...cardStyle,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#f6fbfe"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, p.title), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => addTheoryToLesson(p.id)
  }, "+ \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C"))))), /*#__PURE__*/React.createElement(TheoryPicker, {
    data: data,
    onPick: addTheoryToLesson,
    onRemove: removeTheoryFromLesson,
    attachedIds: attachedTheoryIds
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      color: grayed ? "#9aa4ae" : "#12233a"
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 16,
    style: {
      color: THEME.panelText,
      marginBottom: 10
    }
  }, "\u0414\u043E\u043C\u0430\u0448\u043D\u044F\u044F \u0440\u0430\u0431\u043E\u0442\u0430"), /*#__PURE__*/React.createElement(Field, {
    label: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043A \u0434\u043E\u043C\u0430\u0448\u043D\u0435\u043C\u0443 \u0437\u0430\u0434\u0430\u043D\u0438\u044E"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: 2,
    style: {
      ...inputStyle,
      resize: "vertical"
    },
    value: lesson.homework,
    onChange: e => setLesson({
      homework: e.target.value
    })
  })), (lesson.homework || "").trim() && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: -6,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setPrintTarget({
      kind: "homeworkText",
      id: lesson.id
    })
  }, "\uD83D\uDDA8 \u041F\u0435\u0447\u0430\u0442\u044C / \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0442\u0435\u043A\u0441\u0442 \u0414\u0417")), /*#__PURE__*/React.createElement(Field, {
    label: "\u0424\u0430\u0439\u043B\u044B \u0438 \u0444\u043E\u0442\u043E \u043A \u0434\u043E\u043C\u0430\u0448\u043D\u0435\u043C\u0443 \u0437\u0430\u0434\u0430\u043D\u0438\u044E"
  }, /*#__PURE__*/React.createElement("input", {
    ref: homeworkFileRef,
    type: "file",
    multiple: true,
    onChange: e => handleHomeworkFiles(e.target.files),
    style: {
      fontSize: 12.5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#7a8a9c",
      marginTop: 4
    }
  }, "\u0424\u043E\u0442\u043E \u0438 \u0444\u0430\u0439\u043B\u044B \u0434\u043E 4 \u041C\u0411 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u043F\u0440\u044F\u043C\u043E \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u2014 \u0438\u0445 \u043C\u043E\u0436\u043D\u043E \u0431\u0443\u0434\u0435\u0442 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0438 \u0441\u043A\u0430\u0447\u0430\u0442\u044C. \u0414\u043B\u044F \u0444\u0430\u0439\u043B\u043E\u0432 \u043F\u043E\u043A\u0440\u0443\u043F\u043D\u0435\u0435 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443 \u0432\u0440\u0443\u0447\u043D\u0443\u044E.")), (lesson.homeworkAttachments || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: -6,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(AttachmentThumbs, {
    attachments: lesson.homeworkAttachments
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4,
      marginTop: 8
    }
  }, lesson.homeworkAttachments.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "#5a6b7d"
    }
  }, a.name), a.tooLarge && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: THEME.red
    }
  }, "\u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439, \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443:"), a.kind === "file" && !a.dataUrl && /*#__PURE__*/React.createElement("input", {
    placeholder: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0444\u0430\u0439\u043B (URL)",
    style: {
      ...inputStyle,
      padding: "4px 8px",
      fontSize: 11.5,
      maxWidth: 220
    },
    value: a.url,
    onChange: e => setHomeworkAttachmentUrl(a.id, e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    onClick: () => removeHomeworkAttachment(a.id),
    style: {
      cursor: "pointer",
      color: THEME.red,
      fontWeight: 900
    }
  }, "\xD7"))))), homeworkAttachedItems.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#8593a3",
      marginBottom: 10
    }
  }, "\u0423\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F \u043A \u0434\u043E\u043C\u0430\u0448\u043D\u0435\u043C\u0443 \u0437\u0430\u0434\u0430\u043D\u0438\u044E \u0435\u0449\u0451 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B."), homeworkAttachedItems.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8,
      marginBottom: 14
    }
  }, homeworkAttachedItems.map(({
    it,
    obj
  }, idx) => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    className: "lc-row",
    onClick: () => setViewingExerciseId(obj.id),
    style: {
      ...cardStyle,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      opacity: grayed ? 0.55 : 1,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: "#8a97a5",
      fontSize: 12.5,
      minWidth: 18
    }
  }, idx + 1, "."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      flexWrap: "wrap"
    }
  }, data.tags.type.find(t => t.id === obj.typeTagId) && /*#__PURE__*/React.createElement(Badge, {
    tag: data.tags.type.find(t => t.id === obj.typeTagId)
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 13.5
    },
    dangerouslySetInnerHTML: {
      __html: obj.text
    }
  }), obj.redNote && /*#__PURE__*/React.createElement("span", {
    style: {
      color: THEME.red,
      fontWeight: 700,
      fontSize: 11.5
    }
  }, "\u2691 ", obj.redNote))), /*#__PURE__*/React.createElement("div", {
    className: "lc-reveal",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 2,
      flexShrink: 0
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u041F\u0435\u0447\u0430\u0442\u044C / \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 (\u043C\u043E\u0436\u043D\u043E \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u043F\u0438\u0439 \u043D\u0430 \u043B\u0438\u0441\u0442\u0435)",
    onClick: () => setPrintTarget({
      kind: "exercise",
      id: obj.id
    })
  }, "\uD83D\uDDA8"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u0412\u044B\u0448\u0435",
    onClick: () => moveHomeworkItem(idx, -1),
    style: idx === 0 ? {
      opacity: 0.3,
      pointerEvents: "none"
    } : undefined
  }, "\u2191"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u041D\u0438\u0436\u0435",
    onClick: () => moveHomeworkItem(idx, 1),
    style: idx === homeworkAttachedItems.length - 1 ? {
      opacity: 0.3,
      pointerEvents: "none"
    } : undefined
  }, "\u2193"), /*#__PURE__*/React.createElement("span", {
    className: "lc-iconbtn",
    title: "\u0423\u0431\u0440\u0430\u0442\u044C",
    onClick: () => removeHomeworkItem(it.id),
    style: {
      color: THEME.red
    }
  }, "\u2715"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(ExercisePicker, {
    data: data,
    onPick: addExerciseToHomework,
    onRemove: removeExerciseFromHomework,
    attachedIds: attachedHomeworkExerciseIds
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, !showCreateHomework ? /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px dashed #9bb6c9"
    },
    onClick: () => setShowCreateHomework(true)
  }, "+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u043E\u0435 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435 \u0434\u043B\u044F \u0414\u0417") : /*#__PURE__*/React.createElement("div", {
    style: {
      ...cardStyle,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0438\u043F \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F"
  }, /*#__PURE__*/React.createElement("select", {
    style: inputStyle,
    value: newHomeworkTypeChoice,
    onChange: e => setNewHomeworkTypeChoice(e.target.value)
  }, data.tags.type.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.id,
    value: t.id
  }, t.name)))), /*#__PURE__*/React.createElement(ExampleForm, {
    data: data,
    ensureTopicTag: ensureTopicTag,
    onCancel: () => setShowCreateHomework(false),
    onSave: ex => {
      const newId = uid();
      update(d => {
        d.examples.push({
          id: newId,
          typeTagId: newHomeworkTypeChoice,
          richMigrated: true,
          ...ex
        });
        const l = d.lessons.find(x => x.id === lesson.id);
        l.homeworkItems = [...(l.homeworkItems || []), {
          id: uid(),
          type: "exercise",
          refId: newId
        }];
        return d;
      });
      setShowCreateHomework(false);
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      color: grayed ? "#9aa4ae" : "#12233a"
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 16,
    style: {
      color: THEME.panelText,
      marginBottom: 10
    }
  }, "\u0417\u0430\u043F\u0430\u0441\u043D\u044B\u0435 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F"), lessonReserveItems.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#8593a3"
    }
  }, "\u041F\u0443\u0441\u0442\u043E. \u0423\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u0435 \xAB\u0432 \u0437\u0430\u043F\u0430\u0441\xBB \u0432 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430\u0445 \u0443\u0440\u043E\u043A\u0430 \u2014 \u043E\u043D\u043E \u043E\u043A\u0430\u0436\u0435\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C (\u0441\u0432\u043E\u0439 \u0437\u0430\u043F\u0430\u0441 \u0434\u043B\u044F ", lessonPlaceLabel(lesson, data), ").") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, lessonReserveItems.map(({
    r,
    ex
  }) => {
    const missingIn = !lesson.courseId ? lettersMissingExercise(data, lesson.class, ex.id, lesson.classLetterId || null) : [];
    return /*#__PURE__*/React.createElement("div", {
      key: r.id,
      style: {
        ...cardStyle,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 3,
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, data.tags.type.find(t => t.id === ex.typeTagId) && /*#__PURE__*/React.createElement(Badge, {
      tag: data.tags.type.find(t => t.id === ex.typeTagId)
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      },
      dangerouslySetInnerHTML: {
        __html: ex.text
      }
    })), missingIn.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: THEME.gold
      }
    }, "\u0422\u0430\u043A\u0436\u0435 \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043E \u0432 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430\u0445: ", missingIn.join(", "))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      kind: "pastel",
      small: true,
      onClick: () => addFromReserveToLesson(r.id, ex.id)
    }, "+ \u0412 \u044D\u0442\u043E\u0442 \u0443\u0440\u043E\u043A"), /*#__PURE__*/React.createElement(Btn, {
      kind: "ghost",
      small: true,
      style: {
        color: "#12233a",
        border: "1.5px solid #cfe3f2"
      },
      onClick: () => removeFromLessonReserve(r.id)
    }, "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0437\u0430\u043F\u0430\u0441\u0430")));
  }))), viewingTheoryId && data.theory.find(p => p.id === viewingTheoryId) && /*#__PURE__*/React.createElement(TheoryViewerModal, {
    page: data.theory.find(p => p.id === viewingTheoryId),
    onClose: () => setViewingTheoryId(null)
  }), viewingExerciseId && data.examples.find(e => e.id === viewingExerciseId) && (() => {
    const ex = data.examples.find(e => e.id === viewingExerciseId);
    const usedIn = data.lessons.filter(l => (l.items || []).some(it => it.type === "exercise" && it.refId === ex.id));
    const topicTags = ex.topicTagIds.map(id => data.tags.topic.find(t => t.id === id)).filter(Boolean);
    return /*#__PURE__*/React.createElement(ExercisePeekModal, {
      ex: ex,
      data: data,
      usedIn: usedIn,
      topicTags: topicTags,
      ensureTopicTag: ensureTopicTag,
      onUpdate: patch => update(d => {
        Object.assign(d.examples.find(e => e.id === ex.id), patch);
        return d;
      }),
      onAddToLesson: lessonId => update(d => {
        const l = d.lessons.find(x => x.id === lessonId);
        if (!l) return d;
        l.items = l.items || [];
        if (!l.items.some(it => it.type === "exercise" && it.refId === ex.id)) {
          l.items.push({
            id: uid(),
            type: "exercise",
            refId: ex.id
          });
        }
        return d;
      }),
      removeLabel: "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0443\u0440\u043E\u043A\u0430",
      onRemove: () => {
        const item = (lesson.items || []).find(it => it.type === "exercise" && it.refId === ex.id);
        if (item) removeItem(item.id);
        setViewingExerciseId(null);
      },
      onClose: () => setViewingExerciseId(null)
    });
  })(), worksheetStudent && /*#__PURE__*/React.createElement(WorksheetEditorModal, {
    studentName: worksheetStudent.name,
    initialHtml: lessonWorksheetHtml(lesson, data, data.worksheetChecklist),
    onSend: sendWorksheetToStudent,
    onClose: () => setWorksheetStudent(null)
  }), checklistOpen && /*#__PURE__*/React.createElement(WorksheetChecklistModal, {
    checklist: data.worksheetChecklist,
    update: update,
    onClose: () => setChecklistOpen(false)
  }), printTarget && /*#__PURE__*/React.createElement(PrintElementModal, {
    data: data,
    lesson: lesson,
    target: printTarget,
    onClose: () => setPrintTarget(null)
  }));
}
function TheoryViewerModal({
  page,
  onClose
}) {
  const [lightbox, setLightbox] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    },
    onClick: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      color: "#12233a",
      borderRadius: 16,
      padding: 22,
      width: "min(760px, 95vw)",
      maxHeight: "90vh",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Heading, {
    size: 20,
    style: {
      color: "#12233a"
    }
  }, page.title), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0417\u0430\u043A\u0440\u044B\u0442\u044C")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: "#5a6b7d",
      marginBottom: 6
    }
  }, "\u0422\u0435\u043A\u0441\u0442:"), /*#__PURE__*/React.createElement(ExportButtons, {
    onWord: () => downloadWord(page.title || "teoriya", page.title || "Теория", theoryPageToHtml(page)),
    onPdf: () => printAsPdf(page.title || "Теория", theoryPageToHtml(page))
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      border: "1px solid #d7e6f0",
      borderRadius: 8,
      padding: "12px 14px",
      fontSize: 14,
      lineHeight: 1.5,
      marginBottom: 18
    },
    dangerouslySetInnerHTML: {
      __html: page.html || "<span style='color:#8593a3'>Текст пуст</span>"
    }
  }), (page.diagrams || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "#5a6b7d",
      marginBottom: 8
    }
  }, "\u0421\u0445\u0435\u043C\u044B:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, page.diagrams.map(dg => /*#__PURE__*/React.createElement("div", {
    key: dg.id,
    style: cardStyle
  }, /*#__PURE__*/React.createElement(DiagramPreview, {
    diagram: dg
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 6,
      flexWrap: "wrap",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 700
    }
  }, dg.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => downloadDataUrl(diagramToImageDataUrl(dg), (dg.title || "shema") + ".png")
  }, "\u2B07 PNG"), /*#__PURE__*/React.createElement(ExportButtons, {
    onWord: () => downloadWord(dg.title || "shema", dg.title || "Схема", diagramToHtmlWithImage(dg)),
    onPdf: () => printAsPdf(dg.title || "Схема", diagramToHtmlWithImage(dg))
  }))))))), (page.attachments || []).length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "#5a6b7d",
      marginBottom: 8
    }
  }, "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u043B\u0451\u043D\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, page.attachments.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      ...cardStyle,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, a.kind === "image" ? /*#__PURE__*/React.createElement("img", {
    src: a.dataUrl,
    alt: a.name,
    title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435",
    onClick: () => setLightbox(a),
    style: {
      width: 40,
      height: 40,
      objectFit: "cover",
      borderRadius: 5,
      cursor: "pointer"
    }
  }) : /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCCE"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, a.name)), a.kind === "image" ? /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => downloadDataUrl(a.dataUrl, a.name || "image.jpg")
  }, "\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C") : a.dataUrl ? /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => downloadDataUrl(a.dataUrl, a.name || "file")
  }, "\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C") : a.url ? /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => window.open(a.url, "_blank")
  }, "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443") : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "#8593a3"
    }
  }, "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430")))))), lightbox && /*#__PURE__*/React.createElement(ImageLightboxModal, {
    src: lightbox.dataUrl,
    name: lightbox.name,
    onClose: () => setLightbox(null)
  }));
}
function TheoryPicker({
  data,
  onPick,
  onRemove,
  attachedIds
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = data.theory.filter(p => q ? p.title.toLowerCase().includes(q.toLowerCase()) : true);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setOpen(!open)
  }, open ? "Скрыть список теории" : "Выбрать из теории"), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      marginBottom: 8
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6,
      maxHeight: 220,
      overflowY: "auto"
    }
  }, results.map(p => {
    const attached = attachedIds.includes(p.id);
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      style: {
        ...cardStyle,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13
      }
    }, p.title), /*#__PURE__*/React.createElement(Btn, {
      kind: attached ? "ghost" : "pastel",
      small: true,
      style: attached ? {
        color: "#1b7a3d",
        border: "1.5px solid #bfe3cc"
      } : undefined,
      onClick: () => attached ? onRemove(p.id) : onPick(p.id)
    }, attached ? "✓ добавлено" : "+ добавить"));
  }), results.length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "#8593a3"
    }
  }, "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E."))));
}
function ExercisePicker({
  data,
  onPick,
  onRemove,
  attachedIds
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const exerciseTopicTags = ex => ex.topicTagIds.map(id => data.tags.topic.find(t => t.id === id)).filter(Boolean);

  // Ищем и по тексту/заметке самого упражнения, и (это важнее) по названиям
  // тегов "Тема урока", которыми оно помечено — так учитель может найти всё
  // по нужной теме, даже если в тексте упражнения этого слова нет.
  const results = data.examples.map(ex => {
    if (!q.trim()) return {
      ex,
      matchedByTopic: false
    };
    const query = q.trim().toLowerCase();
    const topicNames = exerciseTopicTags(ex).map(t => t.name.toLowerCase());
    const matchedByTopic = topicNames.some(name => name.includes(query));
    const matchedByText = (stripHtml(ex.text) + " " + ex.note).toLowerCase().includes(query);
    if (!matchedByTopic && !matchedByText) return null;
    return {
      ex,
      matchedByTopic
    };
  }).filter(Boolean);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => setOpen(!open)
  }, open ? "Скрыть банк упражнений" : "Выбрать из банка упражнений"), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      marginBottom: 8
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0442\u0435\u043A\u0441\u0442\u0443 \u0443\u043F\u0440\u0430\u0436\u043D\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u043F\u043E \u0442\u0435\u043C\u0435 \u0443\u0440\u043E\u043A\u0430\u2026",
    value: q,
    onChange: e => setQ(e.target.value),
    autoFocus: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6,
      maxHeight: 280,
      overflowY: "auto"
    }
  }, results.map(({
    ex,
    matchedByTopic
  }) => {
    const typeTag = data.tags.type.find(t => t.id === ex.typeTagId);
    const topicTags = exerciseTopicTags(ex);
    const attached = attachedIds.includes(ex.id);
    return /*#__PURE__*/React.createElement("div", {
      key: ex.id,
      style: {
        ...cardStyle,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        marginBottom: 3
      }
    }, typeTag && /*#__PURE__*/React.createElement(Badge, {
      tag: typeTag
    }), topicTags.map(t => /*#__PURE__*/React.createElement(Badge, {
      key: t.id,
      tag: t
    })), matchedByTopic && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: "#1b5e20",
        fontWeight: 700
      }
    }, "\u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u043F\u043E \u0442\u0435\u043C\u0435")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13
      }
    }, stripHtml(ex.text))), /*#__PURE__*/React.createElement(Btn, {
      kind: attached ? "ghost" : "pastel",
      small: true,
      style: attached ? {
        color: "#1b7a3d",
        border: "1.5px solid #bfe3cc"
      } : undefined,
      onClick: () => attached ? onRemove(ex.id) : onPick(ex.id)
    }, attached ? "✓ добавлено" : "+ добавить"));
  }), results.length === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "#8593a3"
    }
  }, "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E."))));
}

/* ============================================================
   ВКЛАДКА: ТЕОРИЯ (текстовый редактор + карты-схемы)
   ============================================================ */
function TheoryTab({
  data,
  update
}) {
  const [activeId, setActiveId] = useState(data.theory[0]?.id || null);
  const pages = data.theory;
  const addPage = () => {
    const id = uid();
    update(d => {
      d.theory.push({
        id,
        title: "Новая страница",
        html: "",
        attachments: [],
        diagrams: [],
        topicTagIds: [],
        classTags: [],
        courseTagIds: []
      });
      return d;
    });
    setActiveId(id);
  };
  const deletePage = id => {
    update(d => {
      d.theory = d.theory.filter(p => p.id !== id);
      d.lessons.forEach(l => {
        l.items = (l.items || []).filter(it => !(it.type === "theory" && it.refId === id));
      });
      return d;
    });
    if (activeId === id) setActiveId(null);
  };
  const ensureTopicTag = name => {
    let tag = data.tags.topic.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (tag) return tag.id;
    const id = uid();
    update(d => {
      d.tags.topic.push({
        id,
        name,
        color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)]
      });
      return d;
    });
    return id;
  };
  const page = pages.find(p => p.id === activeId);
  const exportAllWord = () => {
    const body = pages.map(p => theoryPageToHtml(p)).join("");
    downloadWord("theoriya-vsya", "Вся теория", body || "<div>Пока пусто</div>");
  };
  const exportAllPdf = () => {
    const body = pages.map(p => theoryPageToHtml(p)).join("");
    printAsPdf("Вся теория", body || "<div>Пока пусто</div>");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...panelStyle,
      padding: 16,
      height: "fit-content"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 8,
      color: "#5a6b7d"
    }
  }, "\u0421\u0422\u0420\u0410\u041D\u0418\u0426\u042B \u0422\u0415\u041E\u0420\u0418\u0418"), pages.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#8593a3",
      marginBottom: 8
    }
  }, "\u0421\u0442\u0440\u0430\u043D\u0438\u0446 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442."), pages.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    onClick: () => setActiveId(p.id),
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 10px",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: activeId === p.id ? 800 : 500,
      background: activeId === p.id ? THEME.pastel : "transparent"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, p.title || "Без названия"), /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      deletePage(p.id);
    },
    style: {
      color: THEME.red,
      fontWeight: 900,
      fontSize: 13
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      marginTop: 8,
      color: "#12233a",
      border: "1.5px dashed #9bb6c9",
      width: "100%"
    },
    onClick: addPage
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      paddingTop: 12,
      borderTop: "1px solid #d7e6f0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#7a8a9c",
      marginBottom: 6
    }
  }, "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432\u0441\u0435\u0439 \u0442\u0435\u043E\u0440\u0438\u0438:"), /*#__PURE__*/React.createElement(ExportButtons, {
    onWord: exportAllWord,
    onPdf: exportAllPdf
  }))), /*#__PURE__*/React.createElement("div", {
    style: panelStyle
  }, !page ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "#5a6b7d"
    }
  }, "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0441\u043B\u0435\u0432\u0430 \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u0443\u044E.") : /*#__PURE__*/React.createElement(TheoryPageEditor, {
    key: page.id,
    page: page,
    data: data,
    ensureTopicTag: ensureTopicTag,
    onChange: patch => update(d => {
      Object.assign(d.theory.find(x => x.id === page.id), patch);
      return d;
    })
  })));
}
function ToolBtn({
  children,
  onClick,
  active
}) {
  return /*#__PURE__*/React.createElement("button", {
    onMouseDown: e => e.preventDefault(),
    onClick: onClick,
    style: {
      fontFamily: BODY_FONT,
      fontSize: 12.5,
      fontWeight: 700,
      padding: "5px 10px",
      borderRadius: 6,
      border: active ? "1.5px solid #12233a" : "1px solid #b9cfe0",
      background: "#fff",
      cursor: "pointer",
      color: "#12233a"
    }
  }, children);
}
const toolSelectStyle = {
  fontFamily: BODY_FONT,
  fontSize: 12.5,
  fontWeight: 700,
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid #b9cfe0",
  background: "#fff",
  cursor: "pointer",
  color: "#12233a"
};
function TheoryPageEditor({
  page,
  onChange,
  data,
  ensureTopicTag
}) {
  const editorRef = useRef(null);
  const fileRef = useRef(null);
  const [diagramOpenId, setDiagramOpenId] = useState(null);
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = page.html || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);
  const saveHtml = () => onChange({
    html: editorRef.current.innerHTML
  });
  const exec = (cmd, value) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    saveHtml();
  };
  const execHighlight = color => {
    editorRef.current?.focus();
    let ok = document.execCommand("hiliteColor", false, color);
    if (!ok) document.execCommand("backColor", false, color);
    saveHtml();
  };
  const getClosestTable = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node = sel.anchorNode;
    if (!node) return null;
    let el = node.nodeType === 3 ? node.parentElement : node;
    if (!el || !editorRef.current || !editorRef.current.contains(el)) return null;
    return el.closest("table");
  };
  const getClosestCell = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node = sel.anchorNode;
    if (!node) return null;
    let el = node.nodeType === 3 ? node.parentElement : node;
    if (!el || !editorRef.current || !editorRef.current.contains(el)) return null;
    return el.closest("td,th");
  };
  const insertTable = () => {
    const rowsStr = window.prompt("Сколько строк в таблице?", "3");
    if (rowsStr === null) return;
    const colsStr = window.prompt("Сколько столбцов?", "3");
    if (colsStr === null) return;
    const rows = Math.max(1, Math.min(30, parseInt(rowsStr, 10) || 1));
    const cols = Math.max(1, Math.min(15, parseInt(colsStr, 10) || 1));
    let html = '<table style="border-collapse:collapse;width:100%;margin:10px 0;">';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += '<td style="border:1px solid #b9cfe0;padding:6px 8px;min-width:40px;">&nbsp;</td>';
      }
      html += "</tr>";
    }
    html += "</table><p><br></p>";
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    saveHtml();
  };
  const addTableRow = () => {
    const table = getClosestTable();
    if (!table) {
      window.alert("Сначала кликните курсором внутри таблицы.");
      return;
    }
    const firstRow = table.querySelector("tr");
    const cols = firstRow ? firstRow.children.length : 1;
    const tr = document.createElement("tr");
    for (let c = 0; c < cols; c++) {
      const td = document.createElement("td");
      td.style.border = "1px solid #b9cfe0";
      td.style.padding = "6px 8px";
      td.innerHTML = "&nbsp;";
      tr.appendChild(td);
    }
    table.appendChild(tr);
    saveHtml();
  };
  const addTableColumn = () => {
    const table = getClosestTable();
    if (!table) {
      window.alert("Сначала кликните курсором внутри таблицы.");
      return;
    }
    table.querySelectorAll("tr").forEach(tr => {
      const td = document.createElement("td");
      td.style.border = "1px solid #b9cfe0";
      td.style.padding = "6px 8px";
      td.innerHTML = "&nbsp;";
      tr.appendChild(td);
    });
    saveHtml();
  };
  const deleteTableRow = () => {
    const cell = getClosestCell();
    const row = cell?.closest("tr");
    if (!row) {
      window.alert("Сначала кликните курсором внутри строки таблицы.");
      return;
    }
    row.remove();
    saveHtml();
  };
  const deleteTableColumn = () => {
    const cell = getClosestCell();
    const table = getClosestTable();
    if (!cell || !table) {
      window.alert("Сначала кликните курсором внутри ячейки таблицы.");
      return;
    }
    const colIndex = Array.from(cell.parentElement.children).indexOf(cell);
    table.querySelectorAll("tr").forEach(tr => {
      if (tr.children[colIndex]) tr.children[colIndex].remove();
    });
    saveHtml();
  };
  const deleteTable = () => {
    const table = getClosestTable();
    if (!table) {
      window.alert("Сначала кликните курсором внутри таблицы.");
      return;
    }
    table.remove();
    saveHtml();
  };
  const handleFiles = async files => {
    const list = Array.from(files);
    const added = [];
    for (const f of list) {
      if (f.type.startsWith("image/")) {
        const dataUrl = await resizeImage(f);
        added.push({
          id: uid(),
          name: f.name,
          kind: "image",
          dataUrl
        });
      } else if (f.size <= MAX_EMBED_FILE_SIZE) {
        const dataUrl = await fileToDataUrl(f);
        added.push({
          id: uid(),
          name: f.name,
          kind: "file",
          dataUrl,
          url: ""
        });
      } else {
        added.push({
          id: uid(),
          name: f.name,
          kind: "file",
          url: "",
          tooLarge: true
        });
      }
    }
    onChange({
      attachments: [...(page.attachments || []), ...added]
    });
  };
  const removeAttachment = id => onChange({
    attachments: page.attachments.filter(a => a.id !== id)
  });
  const setAttachmentUrl = (id, url) => onChange({
    attachments: page.attachments.map(a => a.id === id ? {
      ...a,
      url
    } : a)
  });
  const addDiagram = () => {
    const id = uid();
    const diagram = {
      id,
      title: "Новая схема",
      nodes: [],
      edges: [],
      texts: [],
      lines: []
    };
    onChange({
      diagrams: [...(page.diagrams || []), diagram]
    });
    setDiagramOpenId(id);
  };
  const updateDiagram = (id, patch) => onChange({
    diagrams: page.diagrams.map(dg => dg.id === id ? {
      ...dg,
      ...patch
    } : dg)
  });
  const deleteDiagram = id => onChange({
    diagrams: page.diagrams.filter(dg => dg.id !== id)
  });
  const openDiagram = page.diagrams?.find(d => d.id === diagramOpenId);
  const toggleTopic = id => {
    const has = (page.topicTagIds || []).includes(id);
    onChange({
      topicTagIds: has ? page.topicTagIds.filter(x => x !== id) : [...(page.topicTagIds || []), id]
    });
  };
  const toggleClassTag = c => {
    const has = (page.classTags || []).includes(c);
    onChange({
      classTags: has ? page.classTags.filter(x => x !== c) : [...(page.classTags || []), c]
    });
  };
  const toggleCourseTag = id => {
    const has = (page.courseTagIds || []).includes(id);
    onChange({
      courseTagIds: has ? page.courseTagIds.filter(x => x !== id) : [...(page.courseTagIds || []), id]
    });
  };
  const exportWord = () => downloadWord(page.title || "teoriya", page.title || "Теория", theoryPageToHtml(page));
  const exportPdf = () => printAsPdf(page.title || "Теория", theoryPageToHtml(page));
  const exportDiagramWord = dg => downloadWord(dg.title || "shema", dg.title || "Схема", diagramToHtmlWithImage(dg));
  const exportDiagramPdf = dg => printAsPdf(dg.title || "Схема", diagramToHtmlWithImage(dg));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B"
  }, /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    value: page.title,
    onChange: e => onChange({
      title: e.target.value
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 22
    }
  }, /*#__PURE__*/React.createElement(ExportButtons, {
    onWord: exportWord,
    onPdf: exportPdf
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "\u0422\u0435\u043C\u0430 (\u0442\u0435\u0433\u0438)"
  }, /*#__PURE__*/React.createElement(TopicTagPicker, {
    data: data,
    selectedIds: page.topicTagIds || [],
    onToggle: toggleTopic,
    ensureTopicTag: ensureTopicTag
  })), /*#__PURE__*/React.createElement(Field, {
    label: "\u041A\u043B\u0430\u0441\u0441\u044B, \u043A \u043A\u043E\u0442\u043E\u0440\u044B\u043C \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, CLASSES.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    onClick: () => toggleClassTag(c),
    style: {
      padding: "4px 12px",
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 700,
      cursor: "pointer",
      background: (page.classTags || []).includes(c) ? THEME.pastel : "#eef3f7",
      border: (page.classTags || []).includes(c) ? "2px solid #12233a" : "2px solid transparent"
    }
  }, c, " \u043A\u043B\u0430\u0441\u0441")))), data.courses.length > 0 && /*#__PURE__*/React.createElement(Field, {
    label: "\u041A\u0443\u0440\u0441\u044B, \u043A \u043A\u043E\u0442\u043E\u0440\u044B\u043C \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, data.courses.map(c => /*#__PURE__*/React.createElement("span", {
    key: c.id,
    onClick: () => toggleCourseTag(c.id),
    style: {
      padding: "4px 12px",
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 700,
      cursor: "pointer",
      background: (page.courseTagIds || []).includes(c.id) ? THEME.pastel : "#eef3f7",
      border: (page.courseTagIds || []).includes(c.id) ? "2px solid #12233a" : "2px solid transparent"
    }
  }, c.name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 6,
      background: "#dfeaf3",
      padding: "6px 8px",
      borderRadius: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("bold")
  }, /*#__PURE__*/React.createElement("b", null, "\u0416")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("italic")
  }, /*#__PURE__*/React.createElement("i", null, "\u041A")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("underline")
  }, /*#__PURE__*/React.createElement("u", null, "\u0427")), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("formatBlock", "H3")
  }, "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("formatBlock", "P")
  }, "\u0410\u0431\u0437\u0430\u0446"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("insertUnorderedList")
  }, "\u2022 \u0421\u043F\u0438\u0441\u043E\u043A"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("insertOrderedList")
  }, "1. \u0421\u043F\u0438\u0441\u043E\u043A"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => exec("removeFormat")
  }, "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C"), /*#__PURE__*/React.createElement("select", {
    defaultValue: "",
    onChange: e => {
      if (e.target.value) exec("fontName", e.target.value);
      e.target.value = "";
    },
    style: toolSelectStyle
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u0428\u0440\u0438\u0444\u0442\u2026"), /*#__PURE__*/React.createElement("option", {
    value: "PT Sans"
  }, "PT Sans"), /*#__PURE__*/React.createElement("option", {
    value: "Playfair Display"
  }, "Playfair Display"), /*#__PURE__*/React.createElement("option", {
    value: "Arial"
  }, "Arial"), /*#__PURE__*/React.createElement("option", {
    value: "Georgia"
  }, "Georgia"), /*#__PURE__*/React.createElement("option", {
    value: "'Times New Roman'"
  }, "Times New Roman"), /*#__PURE__*/React.createElement("option", {
    value: "'Courier New'"
  }, "Courier New"), /*#__PURE__*/React.createElement("option", {
    value: "Verdana"
  }, "Verdana")), /*#__PURE__*/React.createElement("select", {
    defaultValue: "",
    onChange: e => {
      if (e.target.value) exec("fontSize", e.target.value);
      e.target.value = "";
    },
    style: toolSelectStyle
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "\u0420\u0430\u0437\u043C\u0435\u0440\u2026"), /*#__PURE__*/React.createElement("option", {
    value: "1"
  }, "\u041E\u0447\u0435\u043D\u044C \u043C\u0435\u043B\u043A\u0438\u0439"), /*#__PURE__*/React.createElement("option", {
    value: "2"
  }, "\u041C\u0435\u043B\u043A\u0438\u0439"), /*#__PURE__*/React.createElement("option", {
    value: "3"
  }, "\u041E\u0431\u044B\u0447\u043D\u044B\u0439"), /*#__PURE__*/React.createElement("option", {
    value: "4"
  }, "\u041A\u0440\u0443\u043F\u043D\u0435\u0435"), /*#__PURE__*/React.createElement("option", {
    value: "5"
  }, "\u041A\u0440\u0443\u043F\u043D\u044B\u0439"), /*#__PURE__*/React.createElement("option", {
    value: "6"
  }, "\u041E\u0447\u0435\u043D\u044C \u043A\u0440\u0443\u043F\u043D\u044B\u0439"), /*#__PURE__*/React.createElement("option", {
    value: "7"
  }, "\u041E\u0433\u0440\u043E\u043C\u043D\u044B\u0439"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 8,
      background: "#dfeaf3",
      padding: "6px 8px",
      borderRadius: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: "#5a6b7d",
      marginRight: 2
    }
  }, "\u041C\u0430\u0440\u043A\u0435\u0440:"), HIGHLIGHT_COLORS.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    onMouseDown: e => e.preventDefault(),
    onClick: () => execHighlight(c),
    title: "\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0430\u0440\u043A\u0435\u0440\u043E\u043C",
    style: {
      width: 22,
      height: 22,
      borderRadius: 5,
      background: c,
      cursor: "pointer",
      border: "1.5px solid #b9cfe0"
    }
  })), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: () => execHighlight("transparent")
  }, "\u0423\u0431\u0440\u0430\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 8,
      background: "#dfeaf3",
      padding: "6px 8px",
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: insertTable
  }, "\u25A6 \u0412\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0442\u0430\u0431\u043B\u0438\u0446\u0443"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: addTableRow
  }, "+ \u0421\u0442\u0440\u043E\u043A\u0430"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: addTableColumn
  }, "+ \u0421\u0442\u043E\u043B\u0431\u0435\u0446"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: deleteTableRow
  }, "\u2212 \u0421\u0442\u0440\u043E\u043A\u0430"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: deleteTableColumn
  }, "\u2212 \u0421\u0442\u043E\u043B\u0431\u0435\u0446"), /*#__PURE__*/React.createElement(ToolBtn, {
    onClick: deleteTable
  }, "\u2715 \u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u0430\u0431\u043B\u0438\u0446\u0443")), /*#__PURE__*/React.createElement("div", {
    ref: editorRef,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onInput: saveHtml,
    onBlur: saveHtml,
    style: {
      minHeight: 180,
      background: "#fff",
      border: "1.5px solid #cfe3f2",
      borderRadius: 8,
      padding: "12px 14px",
      fontSize: 14,
      lineHeight: 1.5,
      color: "#12233a",
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 6,
      color: "#5a6b7d"
    }
  }, "\u0424\u0430\u0439\u043B\u044B \u0438 \u043C\u0435\u0434\u0438\u0430"), /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    multiple: true,
    onChange: e => handleFiles(e.target.files),
    style: {
      fontSize: 12.5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#7a8a9c",
      marginTop: 4
    }
  }, "\u0424\u043E\u0442\u043E \u0438 \u0444\u0430\u0439\u043B\u044B \u0434\u043E 4 \u041C\u0411 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u043F\u0440\u044F\u043C\u043E \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u2014 \u0438\u0445 \u043C\u043E\u0436\u043D\u043E \u0431\u0443\u0434\u0435\u0442 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0438 \u0441\u043A\u0430\u0447\u0430\u0442\u044C. \u0414\u043B\u044F \u0444\u0430\u0439\u043B\u043E\u0432 \u043F\u043E\u043A\u0440\u0443\u043F\u043D\u0435\u0435 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0441\u0441\u044B\u043B\u043A\u0443 \u0432\u0440\u0443\u0447\u043D\u0443\u044E."), page.attachments?.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6,
      marginTop: 8
    }
  }, page.attachments.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap"
    }
  }, a.kind === "image" ? /*#__PURE__*/React.createElement("img", {
    src: a.dataUrl,
    style: {
      width: 40,
      height: 40,
      objectFit: "cover",
      borderRadius: 5
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12
    }
  }, "\uD83D\uDCCE ", a.name), a.kind === "file" && a.dataUrl && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("a", {
    href: a.dataUrl,
    target: "_blank",
    rel: "noreferrer",
    style: {
      fontSize: 11.5,
      color: "#12233a"
    }
  }, "\u041E\u0442\u043A\u0440\u044B\u0442\u044C"), /*#__PURE__*/React.createElement("a", {
    href: a.dataUrl,
    download: a.name,
    style: {
      fontSize: 11.5,
      color: "#12233a"
    }
  }, "\u2B07 \u0421\u043A\u0430\u0447\u0430\u0442\u044C")), a.kind === "file" && !a.dataUrl && /*#__PURE__*/React.createElement("input", {
    placeholder: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0444\u0430\u0439\u043B (URL)",
    style: {
      ...inputStyle,
      padding: "4px 8px",
      fontSize: 11.5,
      maxWidth: 220
    },
    value: a.url,
    onChange: e => setAttachmentUrl(a.id, e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    onClick: () => removeAttachment(a.id),
    style: {
      cursor: "pointer",
      color: THEME.red,
      fontWeight: 900
    }
  }, "\xD7"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: "#5a6b7d"
    }
  }, "\u041A\u0430\u0440\u0442\u044B-\u0441\u0445\u0435\u043C\u044B"), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addDiagram
  }, "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0441\u0445\u0435\u043C\u0443")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
      gap: 12
    }
  }, (page.diagrams || []).map(dg => /*#__PURE__*/React.createElement("div", {
    key: dg.id,
    style: {
      ...cardStyle
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setDiagramOpenId(dg.id),
    style: {
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(DiagramPreview, {
    diagram: dg
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      cursor: "pointer"
    },
    onClick: () => setDiagramOpenId(dg.id)
  }, dg.title), /*#__PURE__*/React.createElement("span", {
    onClick: e => {
      e.stopPropagation();
      deleteDiagram(dg.id);
    },
    style: {
      color: THEME.red,
      fontWeight: 900
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(ExportButtons, {
    onWord: () => exportDiagramWord(dg),
    onPdf: () => exportDiagramPdf(dg)
  })))), (page.diagrams || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#8593a3"
    }
  }, "\u0421\u0445\u0435\u043C \u043F\u043E\u043A\u0430 \u043D\u0435\u0442."))), openDiagram && /*#__PURE__*/React.createElement(DiagramEditor, {
    diagram: openDiagram,
    onChange: patch => updateDiagram(openDiagram.id, patch),
    onClose: () => setDiagramOpenId(null)
  }));
}
function DiagramPreview({
  diagram
}) {
  const nodes = diagram.nodes || [];
  const edges = diagram.edges || [];
  const texts = diagram.texts || [];
  const lines = diagram.lines || [];
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 1100 580",
    style: {
      width: "100%",
      height: 110,
      background: "#f6fbfe",
      borderRadius: 8,
      border: "1px solid #d7e6f0"
    }
  }, lines.map(l => /*#__PURE__*/React.createElement("line", {
    key: l.id,
    x1: l.x1,
    y1: l.y1,
    x2: l.x2,
    y2: l.y2,
    stroke: l.color || "#7fa0bd",
    strokeWidth: 3
  })), edges.map(e => {
    const a = nodes.find(n => n.id === e.from);
    const b = nodes.find(n => n.id === e.to);
    if (!a || !b) return null;
    return /*#__PURE__*/React.createElement("line", {
      key: e.id,
      x1: a.x + 60,
      y1: a.y + 20,
      x2: b.x + 60,
      y2: b.y + 20,
      stroke: "#8fa9bd",
      strokeWidth: 3
    });
  }), nodes.map(n => {
    const shape = n.shape || "rect";
    return /*#__PURE__*/React.createElement("g", {
      key: n.id
    }, shape === "ellipse" ? /*#__PURE__*/React.createElement("ellipse", {
      cx: n.x + 60,
      cy: n.y + 20,
      rx: 60,
      ry: 20,
      fill: n.color || THEME.pastel,
      stroke: "#12233a",
      strokeWidth: 1
    }) : shape === "diamond" ? /*#__PURE__*/React.createElement("polygon", {
      points: `${n.x + 60},${n.y} ${n.x + 120},${n.y + 20} ${n.x + 60},${n.y + 40} ${n.x},${n.y + 20}`,
      fill: n.color || THEME.pastel,
      stroke: "#12233a",
      strokeWidth: 1
    }) : /*#__PURE__*/React.createElement("rect", {
      x: n.x,
      y: n.y,
      width: 120,
      height: 40,
      rx: 8,
      fill: n.color || THEME.pastel,
      stroke: "#12233a",
      strokeWidth: 1
    }), /*#__PURE__*/React.createElement("text", {
      x: n.x + 60,
      y: n.y + 25,
      fontSize: "13",
      textAnchor: "middle",
      fill: "#12233a"
    }, (n.text || "").slice(0, 14)));
  }), texts.map(t => /*#__PURE__*/React.createElement("text", {
    key: t.id,
    x: t.x,
    y: t.y + 14,
    fontSize: "14",
    fontWeight: "700",
    fill: t.color || "#12233a"
  }, t.text)), nodes.length === 0 && texts.length === 0 && lines.length === 0 && /*#__PURE__*/React.createElement("text", {
    x: "550",
    y: "290",
    fontSize: "20",
    textAnchor: "middle",
    fill: "#9bb6c9"
  }, "\u041F\u0443\u0441\u0442\u043E"));
}
function DiagramEditor({
  diagram,
  onChange,
  onClose
}) {
  const [nodes, setNodes] = useState(diagram.nodes || []);
  const [edges, setEdges] = useState(diagram.edges || []);
  const [texts, setTexts] = useState(diagram.texts || []);
  const [lines, setLines] = useState(diagram.lines || []);
  const [selected, setSelected] = useState(null); // { kind: 'node'|'text'|'line', id }
  const [connectMode, setConnectMode] = useState(false);
  const connectFirst = useRef(null);
  const canvasRef = useRef(null);
  const dragInfo = useRef(null);
  useEffect(() => {
    setNodes(diagram.nodes || []);
    setEdges(diagram.edges || []);
    setTexts(diagram.texts || []);
    setLines(diagram.lines || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram.id]);
  const sync = (n, e, t, l) => onChange({
    nodes: n,
    edges: e,
    texts: t,
    lines: l
  });
  const addNode = shape => {
    const id = uid();
    const nn = [...nodes, {
      id,
      x: 80 + Math.random() * 500,
      y: 60 + Math.random() * 300,
      text: "Узел",
      color: THEME.pastel,
      shape
    }];
    setNodes(nn);
    sync(nn, edges, texts, lines);
    setSelected({
      kind: "node",
      id
    });
  };
  const addText = () => {
    const id = uid();
    const tt = [...texts, {
      id,
      x: 100 + Math.random() * 400,
      y: 80 + Math.random() * 300,
      text: "Подпись",
      color: "#12233a"
    }];
    setTexts(tt);
    sync(nodes, edges, tt, lines);
    setSelected({
      kind: "text",
      id
    });
  };
  const addLine = () => {
    const id = uid();
    const x0 = 120 + Math.random() * 300;
    const y0 = 120 + Math.random() * 250;
    const ll = [...lines, {
      id,
      x1: x0,
      y1: y0,
      x2: x0 + 140,
      y2: y0 + 60,
      color: "#7fa0bd"
    }];
    setLines(ll);
    sync(nodes, edges, texts, ll);
    setSelected({
      kind: "line",
      id
    });
  };
  const updateNodeText = (id, text) => {
    const nn = nodes.map(n => n.id === id ? {
      ...n,
      text
    } : n);
    setNodes(nn);
    sync(nn, edges, texts, lines);
  };
  const updateNodeColor = (id, color) => {
    const nn = nodes.map(n => n.id === id ? {
      ...n,
      color
    } : n);
    setNodes(nn);
    sync(nn, edges, texts, lines);
  };
  const updateNodeShape = (id, shape) => {
    const nn = nodes.map(n => n.id === id ? {
      ...n,
      shape
    } : n);
    setNodes(nn);
    sync(nn, edges, texts, lines);
  };
  const deleteNode = id => {
    const nn = nodes.filter(n => n.id !== id);
    const ee = edges.filter(e => e.from !== id && e.to !== id);
    setNodes(nn);
    setEdges(ee);
    sync(nn, ee, texts, lines);
    setSelected(null);
  };
  const deleteEdge = id => {
    const ee = edges.filter(e => e.id !== id);
    setEdges(ee);
    sync(nodes, ee, texts, lines);
  };
  const updateTextContent = (id, text) => {
    const tt = texts.map(t => t.id === id ? {
      ...t,
      text
    } : t);
    setTexts(tt);
    sync(nodes, edges, tt, lines);
  };
  const updateTextColor = (id, color) => {
    const tt = texts.map(t => t.id === id ? {
      ...t,
      color
    } : t);
    setTexts(tt);
    sync(nodes, edges, tt, lines);
  };
  const deleteText = id => {
    const tt = texts.filter(t => t.id !== id);
    setTexts(tt);
    sync(nodes, edges, tt, lines);
    setSelected(null);
  };
  const updateLineColor = (id, color) => {
    const ll = lines.map(l => l.id === id ? {
      ...l,
      color
    } : l);
    setLines(ll);
    sync(nodes, edges, texts, ll);
  };
  const deleteLine = id => {
    const ll = lines.filter(l => l.id !== id);
    setLines(ll);
    sync(nodes, edges, texts, ll);
    setSelected(null);
  };
  const onNodeClick = id => {
    if (connectMode) {
      if (!connectFirst.current) {
        connectFirst.current = id;
        setSelected({
          kind: "node",
          id
        });
      } else if (connectFirst.current !== id) {
        const exists = edges.some(e => e.from === connectFirst.current && e.to === id || e.from === id && e.to === connectFirst.current);
        if (!exists) {
          const ee = [...edges, {
            id: uid(),
            from: connectFirst.current,
            to: id
          }];
          setEdges(ee);
          sync(nodes, ee, texts, lines);
        }
        connectFirst.current = null;
        setSelected(null);
      }
    } else {
      setSelected({
        kind: "node",
        id
      });
    }
  };
  const startDrag = (kind, id, e) => {
    if (connectMode && kind === "node") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const list = kind === "node" ? nodes : texts;
    const item = list.find(n => n.id === id);
    const w = kind === "node" ? 120 : 6;
    const h = kind === "node" ? 40 : 6;
    dragInfo.current = {
      kind,
      id,
      offX: e.clientX - rect.left - item.x,
      offY: e.clientY - rect.top - item.y
    };
    const onMove = ev => {
      const r = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(r.width - w, ev.clientX - r.left - dragInfo.current.offX));
      const y = Math.max(0, Math.min(r.height - h, ev.clientY - r.top - dragInfo.current.offY));
      if (dragInfo.current.kind === "node") {
        setNodes(prev => prev.map(n => n.id === dragInfo.current.id ? {
          ...n,
          x,
          y
        } : n));
      } else {
        setTexts(prev => prev.map(t => t.id === dragInfo.current.id ? {
          ...t,
          x,
          y
        } : t));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (dragInfo.current.kind === "node") {
        setNodes(prev => {
          sync(prev, edges, texts, lines);
          return prev;
        });
      } else {
        setTexts(prev => {
          sync(nodes, edges, prev, lines);
          return prev;
        });
      }
      dragInfo.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const startDragLineEndpoint = (id, which, e) => {
    e.stopPropagation();
    setSelected({
      kind: "line",
      id
    });
    const onMove = ev => {
      const r = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(r.width, ev.clientX - r.left));
      const y = Math.max(0, Math.min(r.height, ev.clientY - r.top));
      setLines(prev => prev.map(l => l.id === id ? {
        ...l,
        [which === 1 ? "x1" : "x2"]: x,
        [which === 1 ? "y1" : "y2"]: y
      } : l));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setLines(prev => {
        sync(nodes, edges, texts, prev);
        return prev;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const selectedNode = selected?.kind === "node" ? nodes.find(n => n.id === selected.id) : null;
  const selectedText = selected?.kind === "text" ? texts.find(t => t.id === selected.id) : null;
  const selectedLine = selected?.kind === "line" ? lines.find(l => l.id === selected.id) : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(19,44,83,0.75)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    },
    onClick: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: THEME.panel,
      borderRadius: 16,
      padding: 20,
      width: "min(1180px, 97vw)",
      maxHeight: "94vh",
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      maxWidth: 300,
      fontWeight: 700
    },
    value: diagram.title,
    onChange: e => onChange({
      title: e.target.value
    })
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "ghost",
    small: true,
    style: {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: onClose
  }, "\u0413\u043E\u0442\u043E\u0432\u043E")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 8,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => addNode("rect")
  }, "\u25AD \u041F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A"), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => addNode("ellipse")
  }, "\u25EF \u041E\u0432\u0430\u043B"), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: () => addNode("diamond")
  }, "\u25C7 \u0420\u043E\u043C\u0431"), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addLine
  }, "\u2571 \u041B\u0438\u043D\u0438\u044F"), /*#__PURE__*/React.createElement(Btn, {
    kind: "pastel",
    small: true,
    onClick: addText
  }, "\u0422 \u0422\u0435\u043A\u0441\u0442"), /*#__PURE__*/React.createElement(Btn, {
    kind: connectMode ? "primary" : "ghost",
    small: true,
    style: connectMode ? {} : {
      color: "#12233a",
      border: "1.5px solid #cfe3f2"
    },
    onClick: () => {
      setConnectMode(!connectMode);
      connectFirst.current = null;
      setSelected(null);
    }
  }, connectMode ? "Кликните 2 узла, чтобы соединить" : "Соединить узлы")), selectedNode && !connectMode && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10,
      flexWrap: "wrap",
      alignItems: "center",
      background: "#eaf4fb",
      padding: "8px 10px",
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      maxWidth: 180,
      padding: "6px 10px"
    },
    value: selectedNode.text,
    onChange: e => updateNodeText(selectedNode.id, e.target.value)
  }), /*#__PURE__*/React.createElement("select", {
    value: selectedNode.shape || "rect",
    onChange: e => updateNodeShape(selectedNode.id, e.target.value),
    style: {
      ...toolSelectStyle,
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "rect"
  }, "\u041F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A"), /*#__PURE__*/React.createElement("option", {
    value: "ellipse"
  }, "\u041E\u0432\u0430\u043B"), /*#__PURE__*/React.createElement("option", {
    value: "diamond"
  }, "\u0420\u043E\u043C\u0431")), /*#__PURE__*/React.createElement(ColorPicker, {
    value: selectedNode.color,
    onChange: c => updateNodeColor(selectedNode.id, c)
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: () => deleteNode(selectedNode.id)
  }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0444\u0438\u0433\u0443\u0440\u0443")), selectedText && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10,
      flexWrap: "wrap",
      alignItems: "center",
      background: "#eaf4fb",
      padding: "8px 10px",
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...inputStyle,
      maxWidth: 220,
      padding: "6px 10px"
    },
    value: selectedText.text,
    onChange: e => updateTextContent(selectedText.id, e.target.value)
  }), /*#__PURE__*/React.createElement(ColorPicker, {
    value: selectedText.color,
    onChange: c => updateTextColor(selectedText.id, c)
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: () => deleteText(selectedText.id)
  }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0442\u0435\u043A\u0441\u0442")), selectedLine && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10,
      flexWrap: "wrap",
      alignItems: "center",
      background: "#eaf4fb",
      padding: "8px 10px",
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "#5a6b7d"
    }
  }, "\u041B\u0438\u043D\u0438\u044F:"), /*#__PURE__*/React.createElement(ColorPicker, {
    value: selectedLine.color,
    onChange: c => updateLineColor(selectedLine.id, c)
  }), /*#__PURE__*/React.createElement(Btn, {
    kind: "danger",
    small: true,
    onClick: () => deleteLine(selectedLine.id)
  }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043B\u0438\u043D\u0438\u044E")), /*#__PURE__*/React.createElement("div", {
    ref: canvasRef,
    style: {
      position: "relative",
      width: "100%",
      height: 580,
      background: "#f6fbfe",
      border: "1.5px solid #cfe3f2",
      borderRadius: 10,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "100%",
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none"
    }
  }, lines.map(l => /*#__PURE__*/React.createElement("line", {
    key: l.id,
    x1: l.x1,
    y1: l.y1,
    x2: l.x2,
    y2: l.y2,
    stroke: l.color || "#7fa0bd",
    strokeWidth: selected?.kind === "line" && selected.id === l.id ? 4.5 : 3,
    style: {
      pointerEvents: "stroke",
      cursor: "pointer"
    },
    onClick: () => setSelected({
      kind: "line",
      id: l.id
    })
  })), edges.map(e => {
    const a = nodes.find(n => n.id === e.from);
    const b = nodes.find(n => n.id === e.to);
    if (!a || !b) return null;
    return /*#__PURE__*/React.createElement("line", {
      key: e.id,
      x1: a.x + 60,
      y1: a.y + 20,
      x2: b.x + 60,
      y2: b.y + 20,
      stroke: "#7fa0bd",
      strokeWidth: 2.5,
      style: {
        pointerEvents: "stroke",
        cursor: "pointer"
      },
      onClick: () => deleteEdge(e.id)
    });
  })), lines.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id
  }, /*#__PURE__*/React.createElement("div", {
    onMouseDown: e => startDragLineEndpoint(l.id, 1, e),
    style: {
      position: "absolute",
      left: l.x1 - 6,
      top: l.y1 - 6,
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: "#fff",
      border: `2px solid ${l.color || "#7fa0bd"}`,
      cursor: "grab"
    }
  }), /*#__PURE__*/React.createElement("div", {
    onMouseDown: e => startDragLineEndpoint(l.id, 2, e),
    style: {
      position: "absolute",
      left: l.x2 - 6,
      top: l.y2 - 6,
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: "#fff",
      border: `2px solid ${l.color || "#7fa0bd"}`,
      cursor: "grab"
    }
  }))), nodes.map(n => {
    const shape = n.shape || "rect";
    const isSelected = selected?.kind === "node" && selected.id === n.id;
    const isConnectFirst = connectMode && connectFirst.current === n.id;
    return /*#__PURE__*/React.createElement("div", {
      key: n.id,
      onMouseDown: e => {
        e.stopPropagation();
        startDrag("node", n.id, e);
      },
      onClick: e => {
        e.stopPropagation();
        onNodeClick(n.id);
      },
      style: {
        position: "absolute",
        left: n.x,
        top: n.y,
        width: 120,
        height: 40,
        background: n.color || THEME.pastel,
        borderRadius: shape === "rect" ? 8 : shape === "ellipse" ? "50%" : 0,
        clipPath: shape === "diamond" ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12.5,
        fontWeight: 700,
        color: contrastTextColor(n.color || THEME.pastel),
        textAlign: "center",
        padding: shape === "diamond" ? "0 24px" : "0 8px",
        cursor: connectMode ? "crosshair" : "grab",
        border: isSelected ? "2.5px solid #12233a" : isConnectFirst ? "2.5px solid #c0392b" : "2px solid transparent",
        boxShadow: shape === "diamond" ? "none" : "0 2px 6px rgba(0,0,0,0.15)",
        userSelect: "none"
      }
    }, n.text);
  }), texts.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    onMouseDown: e => {
      e.stopPropagation();
      startDrag("text", t.id, e);
    },
    onClick: e => {
      e.stopPropagation();
      setSelected({
        kind: "text",
        id: t.id
      });
    },
    style: {
      position: "absolute",
      left: t.x,
      top: t.y,
      fontSize: 14,
      fontWeight: 700,
      color: t.color || "#12233a",
      cursor: "grab",
      userSelect: "none",
      padding: 3,
      border: selected?.kind === "text" && selected.id === t.id ? "1.5px dashed #12233a" : "1.5px dashed transparent",
      whiteSpace: "nowrap"
    }
  }, t.text)), nodes.length === 0 && texts.length === 0 && lines.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#9bb6c9",
      fontSize: 14
    }
  }, "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0444\u0438\u0433\u0443\u0440\u0443, \u043B\u0438\u043D\u0438\u044E \u0438\u043B\u0438 \u0442\u0435\u043A\u0441\u0442, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C \u0441\u0445\u0435\u043C\u0443")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#7a8a9c",
      marginTop: 8
    }
  }, "\u041F\u0435\u0440\u0435\u0442\u0430\u0441\u043A\u0438\u0432\u0430\u0439\u0442\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u043C\u044B\u0448\u044C\u044E. \u0423 \u043B\u0438\u043D\u0438\u0438 \u0442\u044F\u043D\u0438\u0442\u0435 \u0437\u0430 \u043A\u0440\u0443\u0436\u043A\u0438 \u043D\u0430 \u043A\u043E\u043D\u0446\u0430\u0445. \u041A\u043B\u0438\u043A\u043D\u0438\u0442\u0435 \u043F\u043E \u043B\u0438\u043D\u0438\u0438 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u043C\u0435\u0436\u0434\u0443 \u0443\u0437\u043B\u0430\u043C\u0438, \u0447\u0442\u043E\u0431\u044B \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u0432\u044F\u0437\u044C.")));
}

/* ============================================================
   ЗАЩИТНЫЙ ЭКРАН (Error Boundary)
   Если где-то в приложении возникнет ошибка рендера, вместо
   полностью пустого экрана покажем сообщение и кнопку "Продолжить".
   Сами данные при этом не теряются — они уже сохранены в хранилище.
   ============================================================ */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null
    };
  }
  static getDerivedStateFromError(error) {
    return {
      error
    };
  }
  componentDidCatch(error, info) {
    console.error("Lesson Constructor error:", error, info);
  }
  render() {
    if (this.state.error) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          minHeight: "100vh",
          background: THEME.bg,
          fontFamily: BODY_FONT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          background: THEME.panel,
          color: THEME.panelText,
          borderRadius: 16,
          padding: "26px 30px",
          maxWidth: 560
        }
      }, /*#__PURE__*/React.createElement(Heading, {
        size: 20,
        style: {
          color: THEME.panelText,
          marginBottom: 10
        }
      }, "\u0427\u0442\u043E-\u0442\u043E \u043F\u043E\u0448\u043B\u043E \u043D\u0435 \u0442\u0430\u043A \u043D\u0430 \u044D\u0442\u043E\u043C \u044D\u043A\u0440\u0430\u043D\u0435"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13.5,
          marginBottom: 14,
          lineHeight: 1.5
        }
      }, "\u0412\u0430\u0448\u0438 \u0434\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u043F\u043E\u0442\u0435\u0440\u044F\u043D\u044B \u2014 \u043E\u043D\u0438 \u0443\u0436\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0432\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u043D\u0430\u0437\u0430\u0434. \u0415\u0441\u043B\u0438 \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F \u043D\u0430 \u043E\u0434\u043D\u043E\u043C \u0438 \u0442\u043E\u043C \u0436\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0438, \u043F\u043E\u043B\u0435\u0437\u043D\u043E \u0431\u0443\u0434\u0435\u0442 \u043E\u043F\u0438\u0441\u0430\u0442\u044C \u044D\u0442\u043E \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0443 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u0442\u0435\u043A\u0441\u0442\u043E\u043C \u043D\u0438\u0436\u0435."), /*#__PURE__*/React.createElement("div", {
        style: {
          background: "#fff",
          border: "1px solid #d7e6f0",
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 11.5,
          fontFamily: "monospace",
          color: "#7a2020",
          marginBottom: 16,
          maxHeight: 140,
          overflow: "auto",
          whiteSpace: "pre-wrap"
        }
      }, String(this.state.error && this.state.error.message || this.state.error)), /*#__PURE__*/React.createElement(Btn, {
        kind: "pastel",
        onClick: () => this.setState({
          error: null
        })
      }, "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C")));
    }
    return this.props.children;
  }
}
function LessonConstructor() {
  return /*#__PURE__*/React.createElement(ErrorBoundary, null, /*#__PURE__*/React.createElement(LessonConstructorInner, null));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render( /*#__PURE__*/React.createElement(LessonConstructor, null));
window.__lcMounted = true;